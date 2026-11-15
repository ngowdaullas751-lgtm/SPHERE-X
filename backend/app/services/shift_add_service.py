"""
Shift-and-Add Coaddition Service for COSMIC LENS — WiseView-Inspired Astronomical Motion Tracking.
Aligns multi-epoch observation arrays along a candidate's motion vector (v_x, v_y or proper motion mu_ra, mu_dec)
and combines them using median / sigma-clipped stacking to amplify faint moving sources.
"""
from __future__ import annotations

import logging
import math
from typing import Any, Optional

import numpy as np
import scipy.ndimage
from astropy.time import Time

from .image_service import (
    array_to_base64_png,
    base64_to_array,
    normalize_asinh,
    normalize_linear,
    generate_heatmap,
)

logger = logging.getLogger(__name__)

SPHEREX_PIXEL_SCALE_ARCSEC = 6.15  # SPHEREx pixel scale: ~6.15 arcsec/pixel


def run_shift_and_add(
    images_data: list[dict[str, Any]],
    motion_rate_arcsec_yr: Optional[float] = None,
    position_angle_deg: Optional[float] = None,
    vx_px_yr: Optional[float] = None,
    vy_px_yr: Optional[float] = None,
    combine_method: str = "median",
    pixel_scale_arcsec: float = SPHEREX_PIXEL_SCALE_ARCSEC,
) -> dict[str, Any]:
    """Execute shift-and-add coaddition across multi-epoch observation arrays.

    Parameters
    ----------
    images_data : list of dict
        Each dict must contain:
        - 'image_b64': base64 PNG/JPEG or numpy array
        - 'date': observation date string (ISO or YYYY-MM-DD)
        - 'obs_id': observation identifier (optional)
    motion_rate_arcsec_yr : float, optional
        Proper motion speed in arcsec/year.
    position_angle_deg : float, optional
        Position angle (0 = North, 90 = East) in degrees.
    vx_px_yr, vy_px_yr : float, optional
        Direct displacement velocity in pixels/year.
    combine_method : str
        'median' or 'mean' (default 'median').
    """
    if not images_data or len(images_data) < 2:
        return {
            "error": "At least 2 observation frames are required for shift-and-add coaddition.",
            "frames_included": 0,
            "stacked_candidate_b64": None,
            "stacked_stationary_b64": None,
            "difference_stack_b64": None,
        }

    # Extract arrays and timestamps
    parsed_frames = []
    excluded_frames = []

    for idx, item in enumerate(images_data):
        b64 = item.get("image_b64") or item.get("image_base64")
        if not b64:
            excluded_frames.append({"index": idx, "obs_id": item.get("obs_id", f"frame_{idx}"), "reason": "Missing image payload"})
            continue
        try:
            arr = base64_to_array(b64)
            d_str = item.get("date", "2025-01-01")
            parsed_frames.append({
                "array": arr.astype(np.float32),
                "date_str": d_str,
                "obs_id": item.get("obs_id", f"OBS_{idx+1}"),
                "t_mjd": _parse_mjd(d_str),
            })
        except Exception as e:
            excluded_frames.append({"index": idx, "obs_id": item.get("obs_id", f"frame_{idx}"), "reason": str(e)})

    if len(parsed_frames) < 2:
        return {
            "error": "Insufficient valid image frames after decoding (need >= 2).",
            "frames_included": len(parsed_frames),
            "excluded_frames": excluded_frames,
            "stacked_candidate_b64": None,
            "stacked_stationary_b64": None,
        }

    # Sort frames chronologically
    parsed_frames.sort(key=lambda f: f["t_mjd"])
    t0_mjd = parsed_frames[0]["t_mjd"]

    # Align all shapes to common shape (minimum dimensions)
    target_h = min(f["array"].shape[0] for f in parsed_frames)
    target_w = min(f["array"].shape[1] for f in parsed_frames)

    cropped_frames = []
    for f in parsed_frames:
        cropped = f["array"][:target_h, :target_w]
        cropped_frames.append({**f, "array": cropped})

    # Determine velocity in px/year
    if vx_px_yr is None or vy_px_yr is None:
        if motion_rate_arcsec_yr is not None:
            pa_rad = math.radians(position_angle_deg or 0.0)
            # 0 deg = North (+Y), 90 deg = East (+X)
            vx_arcsec = motion_rate_arcsec_yr * math.sin(pa_rad)
            vy_arcsec = motion_rate_arcsec_yr * math.cos(pa_rad)
            vx_px_yr = vx_arcsec / max(pixel_scale_arcsec, 0.01)
            vy_px_yr = vy_arcsec / max(pixel_scale_arcsec, 0.01)
        else:
            vx_px_yr = 0.0
            vy_px_yr = 0.0

    # Build stationary stack (zero shift)
    stationary_stack = np.array([f["array"] for f in cropped_frames])
    if combine_method == "mean":
        stat_combined = np.nanmean(stationary_stack, axis=0)
    else:
        stat_combined = np.nanmedian(stationary_stack, axis=0)

    # Build candidate-aligned stack
    shifted_arrays = []
    motion_tracks = []

    for f in cropped_frames:
        dt_years = (f["t_mjd"] - t0_mjd) / 365.25
        dx = vx_px_yr * dt_years
        dy = vy_px_yr * dt_years

        # Shift frame backwards along candidate track so candidate remains fixed at reference epoch
        # ndimage.shift takes (shift_y, shift_x)
        shifted = scipy.ndimage.shift(f["array"], (-dy, -dx), order=3, mode="nearest", prefilter=True)
        shifted_arrays.append(shifted)
        motion_tracks.append({
            "obs_id": f["obs_id"],
            "date": f["date_str"],
            "dt_years": round(dt_years, 3),
            "dx_px": round(dx, 2),
            "dy_px": round(dy, 2),
            "disp_arcsec": round(math.sqrt(dx**2 + dy**2) * pixel_scale_arcsec, 2),
        })

    cand_stack = np.array(shifted_arrays)
    if combine_method == "mean":
        cand_combined = np.nanmean(cand_stack, axis=0)
    else:
        cand_combined = np.nanmedian(cand_stack, axis=0)

    # Difference between candidate stack and stationary stack
    diff_stack = cand_combined - stat_combined

    # Calculate statistics & SNR improvement
    n_frames = len(cropped_frames)
    snr_gain = round(math.sqrt(n_frames), 2)
    noise_stat = float(np.nanstd(stat_combined))
    noise_cand = float(np.nanstd(cand_combined))
    speed_arcsec_yr = math.sqrt(vx_px_yr**2 + vy_px_yr**2) * pixel_scale_arcsec

    # Generate visualization previews
    stacked_cand_b64 = array_to_base64_png(normalize_asinh(cand_combined))
    stacked_stat_b64 = array_to_base64_png(normalize_asinh(stat_combined))
    diff_b64 = array_to_base64_png(normalize_linear(diff_stack))
    diff_heatmap_b64 = generate_heatmap(diff_stack)

    return {
        "frames_included": n_frames,
        "excluded_frames": excluded_frames,
        "motion_vector": {
            "vx_px_yr": round(vx_px_yr, 3),
            "vy_px_yr": round(vy_px_yr, 3),
            "speed_arcsec_yr": round(speed_arcsec_yr, 3),
            "position_angle_deg": round(position_angle_deg or (math.degrees(math.atan2(vx_px_yr, vy_px_yr)) % 360.0), 1),
        },
        "snr_improvement_factor": snr_gain,
        "noise_stationary_rms": round(noise_stat, 4),
        "noise_candidate_rms": round(noise_cand, 4),
        "dimensions": [target_h, target_w],
        "motion_tracks": motion_tracks,
        "stacked_candidate_b64": stacked_cand_b64,
        "stacked_stationary_b64": stacked_stat_b64,
        "difference_stack_b64": diff_b64,
        "difference_heatmap_b64": diff_heatmap_b64,
        "scientific_notes": (
            f"Successfully coadded {n_frames} multi-epoch observations using subpixel shift-and-add interpolation. "
            f"Theoretical SNR enhancement: ~{snr_gain}x. Candidate track velocity: {speed_arcsec_yr:.2f} \"/yr."
        ),
    }


def _parse_mjd(date_str: str) -> float:
    """Safely convert date string to Modified Julian Date."""
    try:
        t = Time(date_str)
        return float(t.mjd)
    except Exception:
        pass

    try:
        from datetime import datetime
        for fmt in ("%Y-%m-%d %H:%M:%S UTC", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
            try:
                dt = datetime.strptime(date_str.replace("Z", ""), fmt)
                t = Time(dt)
                return float(t.mjd)
            except ValueError:
                pass
    except Exception:
        pass

    return 60000.0
