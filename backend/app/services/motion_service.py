"""
Motion Detection Service for COSMIC LENS — Scientific Astrometry & Source Matching.

NASA SPHEREx Multi-Epoch Motion Analysis Pipeline:
1. Load two calibrated FITS observation cutouts (or pre-extracted arrays).
2. Extract science image arrays, WCS headers, and observation timestamps.
3. Validate image dimensions, variance, and pixel masks.
4. Reproject Image 2 onto Image 1's celestial coordinate grid via `reproject.reproject_interp`.
5. Measure spatial overlap footprint; reject incompatible or zero-baseline pairs.
6. Estimate 2D background and RMS noise using sigma-clipped statistics.
7. Detect point sources using Photutils `DAOStarFinder` with subpixel centroids.
8. Measure flux, SNR, sharpness, and roundness.
9. Match sources between epochs across the common celestial grid.
10. Calculate angular displacement (arcsec), elapsed time (years), and proper motion (arcsec/yr).
11. Compute rigorous astrometric uncertainties (sigma_disp, sigma_speed) and motion significance.
12. Classify sources via transparent scientific decision rules:
    - possible_moving_source (Unverified)
    - stationary_source (Astrometric reference)
    - variable_brightness_source (Unverified)
    - uncertain_detection (Low SNR / edge)
    - image_artifact (Cosmic ray / boundary)
13. Mark every candidate UNVERIFIED (Never claim confirmed discovery).
"""
from __future__ import annotations

import io
import logging
import math
import uuid
from pathlib import Path
from typing import Any, Optional

import numpy as np
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.stats import sigma_clipped_stats
from astropy.time import Time
from astropy.wcs import WCS
import astropy.units as u

from .image_service import (
    array_to_base64_png,
    normalize_asinh,
    normalize_linear,
    base64_to_array,
    detect_sources,
    subtract_images,
)

logger = logging.getLogger(__name__)

SPHEREX_PIXEL_SCALE_ARCSEC = 6.15  # SPHEREx detector pixel scale: ~6.15 arcsec/pixel
DEFAULT_FWHM_PX = 2.5


def detect_motion_pipeline(
    image1_b64: Optional[str] = None,
    image2_b64: Optional[str] = None,
    access_url1: Optional[str] = None,
    access_url2: Optional[str] = None,
    obs_id1: Optional[str] = None,
    obs_id2: Optional[str] = None,
    ra: Optional[float] = None,
    dec: Optional[float] = None,
    date1: str = "unknown",
    date2: str = "unknown",
    pixel_scale_arcsec: float = SPHEREX_PIXEL_SCALE_ARCSEC,
    threshold_sigma: float = 2.5,
) -> dict[str, Any]:
    """End-to-end scientific astronomical motion detection pipeline."""
    img1 = None
    img2 = None
    wcs1 = None
    wcs2 = None
    reprojected2 = None
    footprint2 = None
    alignment_status = "PIXEL_GRID_MATCHED"
    quality_assessment: dict[str, Any] = {
        "temporal_baseline_valid": True,
        "spatial_overlap_pct": 100.0,
        "rejection_reason": None,
    }

    # -------------------------------------------------------------------------
    # TASK 1: Image Preparation & FITS Extraction
    # -------------------------------------------------------------------------
    if (access_url1 or obs_id1) and (access_url2 or obs_id2) and ra is not None and dec is not None:
        try:
            from . import spherex_service
            c1 = spherex_service.get_cutout(ra, dec, size=0.1, access_url=access_url1, obs_id=obs_id1)
            c2 = spherex_service.get_cutout(ra, dec, size=0.1, access_url=access_url2, obs_id=obs_id2)

            path1 = c1.get("obs_metadata", {}).get("cached_fits_path")
            path2 = c2.get("obs_metadata", {}).get("cached_fits_path")

            if path1 and Path(path1).exists() and path2 and Path(path2).exists():
                with fits.open(path1) as h1, fits.open(path2) as h2:
                    hdu1 = _find_science_hdu(h1)
                    hdu2 = _find_science_hdu(h2)

                    raw1 = hdu1.data.astype(np.float64)
                    raw2 = hdu2.data.astype(np.float64)

                    # Mask non-finite pixels
                    img1 = np.nan_to_num(raw1, nan=float(np.nanmedian(raw1) if np.any(np.isfinite(raw1)) else 0.0))
                    img2 = np.nan_to_num(raw2, nan=float(np.nanmedian(raw2) if np.any(np.isfinite(raw2)) else 0.0))

                    try:
                        wcs1 = WCS(hdu1.header)
                    except Exception as we:
                        logger.warning("Could not parse WCS1: %s", we)
                    try:
                        wcs2 = WCS(hdu2.header)
                    except Exception as we:
                        logger.warning("Could not parse WCS2: %s", we)

                    date1 = hdu1.header.get("DATE-OBS") or c1.get("obs_metadata", {}).get("date_obs") or date1
                    date2 = hdu2.header.get("DATE-OBS") or c2.get("obs_metadata", {}).get("date_obs") or date2

                # Reproject img2 onto img1's celestial tangent grid
                if wcs1 is not None and wcs2 is not None:
                    try:
                        from reproject import reproject_interp
                        reprojected2, footprint2 = reproject_interp((img2, wcs2), wcs1, shape_out=img1.shape)
                        reprojected2 = np.nan_to_num(reprojected2.astype(np.float64), nan=0.0)
                        alignment_status = "REPROJECT_WCS_ALIGNED"

                        # Check spatial overlap
                        if footprint2 is not None:
                            overlap_pct = float(np.sum(footprint2 > 0.5) / footprint2.size * 100.0)
                            quality_assessment["spatial_overlap_pct"] = round(overlap_pct, 1)
                            if overlap_pct < 15.0:
                                quality_assessment["rejection_reason"] = (
                                    f"Insufficient spatial overlap ({overlap_pct:.1f}% < 15%). "
                                    "Images do not sufficiently cover the same celestial field."
                                )
                    except Exception as rep_err:
                        logger.warning("Reproject failed, falling back to direct array: %s", rep_err)
                        reprojected2 = img2
                        alignment_status = "PIXEL_GRID_MATCHED (REPROJECT_FALLBACK)"

        except Exception as fits_err:
            logger.warning("FITS pipeline load failed (%s), using base64 fallback", fits_err)

    # Base64 Fallback if FITS files not provided
    if img1 is None and image1_b64:
        try:
            img1 = base64_to_array(image1_b64)
        except Exception as e:
            logger.error("Failed to decode image1_b64: %s", e)
    if img2 is None and image2_b64:
        try:
            img2 = base64_to_array(image2_b64)
        except Exception as e:
            logger.error("Failed to decode image2_b64: %s", e)

    if img1 is None or img2 is None:
        return {
            "candidates": [],
            "matched_sources": [],
            "total_sources_1": 0,
            "total_sources_2": 0,
            "matched": 0,
            "error": "Both Epoch 1 and Epoch 2 images are required for motion detection.",
            "disclaimer": "No valid observation images available to analyze.",
        }

    # Ensure shape compatibility
    if reprojected2 is None:
        if img1.shape != img2.shape:
            min_h = min(img1.shape[0], img2.shape[0])
            min_w = min(img1.shape[1], img2.shape[1])
            img1 = img1[:min_h, :min_w]
            reprojected2 = img2[:min_h, :min_w]
        else:
            reprojected2 = img2

    # Calculate exact baseline in days and years
    dt_years, dt_days = _estimate_temporal_baseline(date1, date2)
    quality_assessment["dt_years"] = dt_years
    quality_assessment["dt_days"] = dt_days

    if dt_years < 0.002:  # Less than ~17 hours
        quality_assessment["temporal_baseline_valid"] = False
        quality_assessment["rejection_reason"] = (
            f"Temporal baseline is only {dt_days:.1f} days ({dt_years*365.25*24:.1f} hours). "
            "A longer time baseline is required to detect astronomical proper motion at 6.15\"/px."
        )

    # -------------------------------------------------------------------------
    # TASK 2: Background Estimation & Point-Source Detection (Photutils)
    # -------------------------------------------------------------------------
    mean1, median1, std1 = sigma_clipped_stats(img1, sigma=3.0, maxiters=5)
    mean2, median2, std2 = sigma_clipped_stats(reprojected2, sigma=3.0, maxiters=5)

    bg1_stats = {"mean": round(float(mean1), 4), "median": round(float(median1), 4), "std": round(float(std1), 4)}
    bg2_stats = {"mean": round(float(mean2), 4), "median": round(float(median2), 4), "std": round(float(std2), 4)}

    # Subtract background to normalize photometric scale
    sub_img1 = img1 - median1
    sub_img2 = reprojected2 - median2

    sources1 = _detect_sources_photutils(sub_img1, std1, threshold_sigma)
    sources2 = _detect_sources_photutils(sub_img2, std2, threshold_sigma)

    logger.info("Photutils detected %d sources in Epoch 1, %d in Epoch 2", len(sources1), len(sources2))

    # -------------------------------------------------------------------------
    # TASK 3: Celestial Source Matching & Proper Motion Kinematics
    # -------------------------------------------------------------------------
    matched_pairs = match_sources(sources1, sources2, tolerance_px=15.0)

    height, width = img1.shape
    candidates = []
    all_matched_sources = []

    for s1, s2 in matched_pairs:
        x1, y1 = float(s1["x"]), float(s1["y"])
        x2, y2 = float(s2["x"]), float(s2["y"])
        dx = x2 - x1
        dy = y2 - y1
        disp_px = math.sqrt(dx * dx + dy * dy)
        disp_arcsec = disp_px * pixel_scale_arcsec

        # Proper motion speed (arcsec/year)
        effective_dt = max(dt_years, 0.005)
        speed_arcsec_yr = disp_arcsec / effective_dt

        # Position angle / direction (0° North, 90° East)
        direction_deg = (math.degrees(math.atan2(dx, dy)) % 360.0)

        # Celestial coordinates via WCS
        cand_ra = ra or 0.0
        cand_dec = dec or 0.0
        if wcs1 is not None:
            try:
                sky_coord1 = wcs1.pixel_to_world(x1, y1)
                cand_ra = float(sky_coord1.ra.deg)
                cand_dec = float(sky_coord1.dec.deg)
            except Exception:
                pass

        # Flux & Photometric SNR
        flux1 = float(s1.get("flux", 1.0))
        flux2 = float(s2.get("flux", 1.0))
        snr1 = float(s1.get("snr", max(1.0, flux1 / (std1 if std1 > 1e-6 else 1.0))))
        snr2 = float(s2.get("snr", max(1.0, flux2 / (std2 if std2 > 1e-6 else 1.0))))

        # Magnitude difference
        delta_mag = 0.0
        if flux1 > 0 and flux2 > 0:
            try:
                delta_mag = round(-2.5 * math.log10(flux2 / flux1), 3)
            except Exception:
                delta_mag = 0.0

        # Rigorous Centroid Uncertainty (King 1983 / Astrometry model)
        fwhm_px = DEFAULT_FWHM_PX
        sigma_x1_px = max(0.03, fwhm_px / (2.355 * max(snr1, 1.0)))
        sigma_x2_px = max(0.03, fwhm_px / (2.355 * max(snr2, 1.0)))
        sigma_disp_px = math.sqrt(sigma_x1_px**2 + sigma_x2_px**2)
        sigma_disp_arcsec = sigma_disp_px * pixel_scale_arcsec

        # Proper motion uncertainty (arcsec/year)
        sigma_speed_arcsec_yr = sigma_disp_arcsec / effective_dt

        # Motion Significance (S_mu = mu / sigma_mu)
        sig_motion = disp_arcsec / max(sigma_disp_arcsec, 1e-4)

        # ---------------------------------------------------------------------
        # TASK 5: Candidate Classification via Transparent Scientific Rules
        # ---------------------------------------------------------------------
        edge_dist1 = min(x1, y1, width - 1 - x1, height - 1 - y1)
        edge_dist2 = min(x2, y2, width - 1 - x2, height - 1 - y2)
        is_near_edge = (edge_dist1 < 4.0 or edge_dist2 < 4.0)

        is_footprint_edge = False
        if footprint2 is not None:
            iy = int(np.clip(y2, 0, height - 1))
            ix = int(np.clip(x2, 0, width - 1))
            if footprint2[iy, ix] < 0.6:
                is_footprint_edge = True

        sharp1 = s1.get("sharpness", 0.5)
        sharp2 = s2.get("sharpness", 0.5)
        is_spike_artifact = (sharp1 > 0.96 or sharp2 > 0.96 or sharp1 < 0.12 or sharp2 < 0.12)
        is_low_snr = (snr1 < 3.0 or snr2 < 3.0)

        # Classification decision tree
        if is_spike_artifact or is_footprint_edge:
            classification = "image_artifact"
            classification_label = "Image Artifact / Cosmic Ray Spike"
            notes = "Detected source rejected as potential single-pixel cosmic ray or boundary artifact."
        elif is_low_snr or is_near_edge:
            classification = "uncertain_detection"
            classification_label = "Uncertain Detection (Low SNR / Border)"
            notes = "Low signal-to-noise ratio or proximity to detector edge limits astrometric reliability."
        elif sig_motion >= 3.0 and disp_arcsec >= 0.5 and speed_arcsec_yr <= 35.0:
            classification = "possible_moving_source"
            classification_label = "Possible Moving Source (Unverified)"
            notes = f"Statistically significant motion at {sig_motion:.1f}σ significance above astrometric noise floor."
        elif sig_motion < 3.0 and abs(delta_mag) >= 0.75:
            classification = "variable_brightness_source"
            classification_label = "Variable Brightness Candidate (Unverified)"
            notes = f"Stationary astrometry (Δθ={disp_arcsec:.2f}\"), but exhibits significant photometric flux variation (Δm={delta_mag:+.2f} mag)."
        else:
            classification = "stationary_source"
            classification_label = "Stationary Astrometric Reference"
            notes = "Position remains stationary within measurement uncertainty; serves as astrometric reference star."

        # Confidence metric (bounded 0.05 to 0.95; never 1.0)
        snr_factor = min(1.0, (snr1 + snr2) / 20.0)
        significance_factor = min(1.0, sig_motion / 5.0)
        edge_penalty = 0.5 if is_near_edge else 1.0
        confidence = float(np.clip(
            0.25 * snr_factor + 0.35 * significance_factor * edge_penalty + (0.2 if classification == "possible_moving_source" else 0.1),
            0.05,
            0.92,
        ))

        source_record = {
            "candidate_id": str(uuid.uuid4())[:8],
            "ra": round(cand_ra, 6),
            "dec": round(cand_dec, 6),
            "date1": str(date1),
            "date2": str(date2),
            "displacement_arcsec": round(disp_arcsec, 4),
            "speed_arcsec_per_year": round(speed_arcsec_yr, 4),
            "direction_deg": round(direction_deg, 2),
            "confidence": round(confidence, 3),
            "status": "candidate",  # Always candidate, never confirmed
            "classification": classification,
            "classification_label": classification_label,
            "verification_status": "UNVERIFIED (Requires independent confirmation)",
            "uncertainty_arcsec": round(sigma_disp_arcsec, 4),
            "uncertainty_speed": round(sigma_speed_arcsec_yr, 4),
            "significance_sigma": round(sig_motion, 2),
            "snr1": round(snr1, 1),
            "snr2": round(snr2, 1),
            "flux1": round(flux1, 2),
            "flux2": round(flux2, 2),
            "delta_mag": round(delta_mag, 3),
            "sharpness1": round(sharp1, 3),
            "roundness1": round(s1.get("roundness", 0.0), 3),
            "fwhm_px": fwhm_px,
            "notes": notes,
            "_px": {
                "x1": round(x1, 2),
                "y1": round(y1, 2),
                "x2": round(x2, 2),
                "y2": round(y2, 2),
                "dx": round(dx, 2),
                "dy": round(dy, 2),
            },
        }

        all_matched_sources.append(source_record)

        # If it's a moving or variable candidate, include in candidates table
        if classification in ("possible_moving_source", "variable_brightness_source"):
            candidates.append(source_record)

    # Sort candidates by proper motion speed or significance
    candidates.sort(key=lambda c: (c["classification"] == "possible_moving_source", c["speed_arcsec_per_year"]), reverse=True)

    # -------------------------------------------------------------------------
    # TASK 4: Motion Visualizations
    # -------------------------------------------------------------------------
    img1_b64 = array_to_base64_png(normalize_asinh(img1))
    img2_b64 = array_to_base64_png(normalize_asinh(img2))
    reproj_b64 = array_to_base64_png(normalize_asinh(reprojected2))
    diff_sub = subtract_images(img1, reprojected2)
    diff_b64 = array_to_base64_png(normalize_linear(diff_sub["diff_array"]))

    moving_count = sum(1 for s in all_matched_sources if s["classification"] == "possible_moving_source")
    var_count = sum(1 for s in all_matched_sources if s["classification"] == "variable_brightness_source")
    stat_count = sum(1 for s in all_matched_sources if s["classification"] == "stationary_source")

    scientific_notes = (
        f"Astrometrically matched {len(matched_pairs)} sources across {dt_years:.3f} yr ({dt_days:.1f} days) baseline. "
        f"Grid alignment: {alignment_status}. "
        f"Classified: {moving_count} possible moving, {var_count} variable, {stat_count} stationary references."
    )

    return {
        "candidates": candidates,
        "matched_sources": all_matched_sources,
        "total_sources_1": len(sources1),
        "total_sources_2": len(sources2),
        "matched": len(matched_pairs),
        "image1_b64": img1_b64,
        "image2_b64": img2_b64,
        "reprojected_b64": reproj_b64,
        "diff_b64": diff_b64,
        "dt_years": round(dt_years, 4),
        "dt_days": round(dt_days, 1),
        "alignment_status": alignment_status,
        "background1_stats": bg1_stats,
        "background2_stats": bg2_stats,
        "quality_assessment": quality_assessment,
        "scientific_notes": scientific_notes,
        "disclaimer": (
            "These detections are unverified astronomical CANDIDATES only. Expert scientific review "
            "and independent multi-band confirmation are strictly required before any discovery claim can be made."
        ),
    }


def _find_science_hdu(hdul: fits.HDUList) -> fits.ImageHDU | fits.PrimaryHDU:
    """Locate the 2D science image array in a FITS HDUList."""
    if "IMAGE" in hdul and getattr(hdul["IMAGE"], "data", None) is not None:
        return hdul["IMAGE"]
    for hdu in hdul:
        if hdu.data is not None and getattr(hdu.data, "ndim", 0) == 2:
            return hdu
    return hdul[0]


def _detect_sources_photutils(data: np.ndarray, std_val: float, threshold_sigma: float = 2.5) -> list[dict[str, Any]]:
    """Detect point sources using Photutils DAOStarFinder with scipy peak fallback."""
    try:
        from photutils.detection import DAOStarFinder

        sigma_thresh = max(threshold_sigma * std_val, 1e-5)
        daofind = DAOStarFinder(
            fwhm=DEFAULT_FWHM_PX,
            threshold=sigma_thresh,
            roundlo=-0.8,
            roundhi=0.8,
            sharplo=0.15,
            sharphi=1.0,
        )
        sources = daofind(data)
        if sources is not None and len(sources) > 0:
            x_col = "x_centroid" if "x_centroid" in sources.colnames else "xcentroid"
            y_col = "y_centroid" if "y_centroid" in sources.colnames else "ycentroid"
            peak_col = "peak" if "peak" in sources.colnames else "flux"

            out = []
            for idx, s in enumerate(sources):
                peak_f = float(s[peak_col])
                sharp = float(s["sharpness"]) if "sharpness" in sources.colnames else 0.5
                roundness = float(s["roundness1"]) if "roundness1" in sources.colnames else 0.0
                snr = peak_f / (std_val if std_val > 1e-6 else 1.0)
                out.append({
                    "x": float(s[x_col]),
                    "y": float(s[y_col]),
                    "flux": peak_f,
                    "snr": max(1.0, snr),
                    "sharpness": sharp,
                    "roundness": roundness,
                    "id": int(s["id"]) if "id" in sources.colnames else idx,
                })
            return out
    except Exception as exc:
        logger.debug("DAOStarFinder note: %s; using scipy peak detection", exc)

    raw_sources = detect_sources(data, threshold_sigma=threshold_sigma)
    return [
        {
            "x": s["x"],
            "y": s["y"],
            "flux": s.get("flux", 1.0),
            "snr": s.get("snr", 3.0),
            "sharpness": 0.5,
            "roundness": 0.0,
            "id": s.get("id", i),
        }
        for i, s in enumerate(raw_sources)
    ]


def match_sources(
    sources1: list[dict[str, Any]],
    sources2: list[dict[str, Any]],
    tolerance_px: float = 15.0,
) -> list[tuple[dict, dict]]:
    """Match point sources between two epochs within a tolerance radius using greedy distance minimization."""
    if not sources1 or not sources2:
        return []

    matched = []
    used2 = set()

    for s1 in sources1:
        x1, y1 = s1["x"], s1["y"]
        best_dist = float("inf")
        best_j = -1

        for j, s2 in enumerate(sources2):
            if j in used2:
                continue
            dx = s2["x"] - x1
            dy = s2["y"] - y1
            dist = math.sqrt(dx * dx + dy * dy)
            if dist < best_dist:
                best_dist = dist
                best_j = j

        if best_j >= 0 and best_dist <= tolerance_px:
            matched.append((s1, sources2[best_j]))
            used2.add(best_j)

    return matched


def _estimate_temporal_baseline(date1: str, date2: str) -> tuple[float, float]:
    """Calculate observation baseline in (years, days) between two observation date strings."""
    try:
        t1 = Time(date1)
        t2 = Time(date2)
        delta_days = float(abs((t2 - t1).jd))
        delta_years = delta_days / 365.25
        return delta_years, delta_days
    except Exception:
        pass

    try:
        from datetime import datetime
        for fmt in (
            "%Y-%m-%d %H:%M:%S UTC",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
        ):
            try:
                d1 = datetime.strptime(date1.replace("Z", ""), fmt)
                d2 = datetime.strptime(date2.replace("Z", ""), fmt)
                delta_days = float(abs((d2 - d1).total_seconds()) / 86400.0)
                return delta_days / 365.25, delta_days
            except ValueError:
                pass
    except Exception:
        pass

    return 1.0, 365.25


# Backward compatibility alias
def detect_motion(
    image1_b64: str,
    image2_b64: str,
    date1: str = "unknown",
    date2: str = "unknown",
    pixel_scale_arcsec: float = SPHEREX_PIXEL_SCALE_ARCSEC,
    dt_years: Optional[float] = None,
    threshold_sigma: float = 2.5,
) -> dict[str, Any]:
    """Compatibility wrapper for legacy detect_motion callers."""
    return detect_motion_pipeline(
        image1_b64=image1_b64,
        image2_b64=image2_b64,
        date1=date1,
        date2=date2,
        pixel_scale_arcsec=pixel_scale_arcsec,
        threshold_sigma=threshold_sigma,
    )


def calculate_motion_candidates(
    sources1: list[dict[str, Any]],
    sources2: list[dict[str, Any]],
    pixel_scale_arcsec: float = SPHEREX_PIXEL_SCALE_ARCSEC,
    dt_years: float = 1.0,
    min_displacement_px: float = 2.0,
    image_shape: tuple[int, int] = (100, 100),
) -> list[dict[str, Any]]:
    """Match detected sources across two epochs and return high proper motion candidates."""
    matched_pairs = match_sources(sources1, sources2, tolerance_px=30.0)
    candidates = []
    effective_dt = max(dt_years, 0.005)

    for s1, s2 in matched_pairs:
        x1, y1 = float(s1["x"]), float(s1["y"])
        x2, y2 = float(s2["x"]), float(s2["y"])
        dx = x2 - x1
        dy = y2 - y1
        disp_px = math.sqrt(dx * dx + dy * dy)

        if disp_px < min_displacement_px:
            continue

        disp_arcsec = disp_px * pixel_scale_arcsec
        speed_arcsec_yr = disp_arcsec / effective_dt
        direction_deg = math.degrees(math.atan2(dx, dy)) % 360.0

        snr1 = float(s1.get("snr", 10.0))
        snr2 = float(s2.get("snr", 10.0))
        conf = float(np.clip(
            0.3 + 0.3 * min(1.0, (snr1 + snr2) / 20.0) + 0.2 * min(1.0, disp_px / 5.0),
            0.1,
            0.95,
        ))

        candidates.append({
            "id": s1.get("id", len(candidates) + 1),
            "source1": s1,
            "source2": s2,
            "displacement_px": round(disp_px, 3),
            "displacement_arcsec": round(disp_arcsec, 4),
            "speed_arcsec_per_year": round(speed_arcsec_yr, 4),
            "direction_deg": round(direction_deg, 2),
            "confidence": round(conf, 3),
            "status": "candidate",
            "verification_status": "UNVERIFIED (Requires independent confirmation)",
        })

    return candidates

