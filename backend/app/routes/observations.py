"""
Observations router — SPHEREx archive search, cutouts, targets, health check.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..models.schemas import (
    CutoutResult,
    HealthResponse,
    ObservationResult,
    Target,
)
from ..services import spherex_service

router = APIRouter(prefix="/api", tags=["observations"])


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse, summary="API health check")
def health() -> HealthResponse:
    """Return API status and NASA archive connectivity."""
    connected = spherex_service.check_archive_connection()
    return HealthResponse(
        status="ok",
        version="1.0.0",
        nasa_archive_connected=connected,
        timestamp=datetime.utcnow().isoformat(),
    )


# ---------------------------------------------------------------------------
# Observations search
# ---------------------------------------------------------------------------

@router.get(
    "/observations",
    summary="Search SPHEREx archive for observations near coordinates",
)
def get_observations(
    ra: float = Query(..., description="Right ascension in decimal degrees (0–360)", ge=0, le=360),
    dec: float = Query(..., description="Declination in decimal degrees (−90–90)", ge=-90, le=90),
    radius: float = Query(0.05, description="Search radius in degrees", gt=0, le=5.0),
    collection: str = Query("spherex_dr1", description="SPHEREx collection: spherex_dr1, spherex_qr3, spherex_dr1_deep, spherex_qr3_deep, or all"),
    format: str = Query("json", description="Response format (json only)"),
) -> dict:
    """Search the NASA/IPAC IRSA SPHEREx archive for observations using SIA2.

    Returns real query results when available. When SPHEREx public data is not
    found in the requested collection, returns a clear message with archive status and links.
    """
    try:
        result = spherex_service.search_observations(
            ra=ra, dec=dec, radius_deg=radius, collection=collection
        )
        return {
            "ra": ra,
            "dec": dec,
            "radius_deg": radius,
            "collection": collection,
            "observations": result.get("observations", []),
            "total": result.get("total", 0),
            "archive_queried": result.get("archive_queried", True),
            "archive_status": result.get("archive_status", "unknown"),
            "dataset_source": result.get("dataset_source", f"NASA/IPAC IRSA SPHEREx Archive ({collection})"),
            "source_attribution": result.get("source_attribution", "NASA/SPHEREx and NASA/IPAC IRSA"),
            "warning": result.get("warning"),
            "irsa_url": "https://irsa.ipac.caltech.edu/Missions/spherex.html",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Image cutout
# ---------------------------------------------------------------------------

@router.get(
    "/cutout",
    summary="Retrieve image cutout from IRSA for given sky coordinates",
)
def get_cutout(
    ra: float = Query(..., description="Right ascension (decimal degrees)", ge=0, le=360),
    dec: float = Query(..., description="Declination (decimal degrees)", ge=-90, le=90),
    size: float = Query(0.1, description="Cutout size in degrees (default 0.1 deg)", gt=0, le=5.0),
    access_url: Optional[str] = Query(None, description="Direct on-premises image access URL from SIA2 search"),
    obs_id: Optional[str] = Query(None, description="Specific observation ID"),
    format: str = Query("json", description="Response format: 'json' (default) or 'png' for direct image"),
):
    """Retrieve an image cutout from IRSA for the given sky position.
    
    When format='png', returns direct image/png bytes suitable for an HTML <img> tag.
    Otherwise returns CutoutResult JSON with base64 and WCS metadata.
    """
    try:
        result = spherex_service.get_cutout(
            ra=ra, dec=dec, size=size, access_url=access_url, obs_id=obs_id
        )
        if format.lower() in ("png", "image"):
            import base64
            from fastapi.responses import Response
            b64_str = result.get("image_base64")
            if b64_str:
                raw_bytes = base64.b64decode(b64_str)
                return Response(content=raw_bytes, media_type="image/png")
            return Response(status_code=404, content=b"Cutout preview unavailable", media_type="text/plain")

        return CutoutResult(
            image_base64=result.get("image_base64"),
            wcs_info=result.get("wcs_info", {}),
            obs_metadata=result.get("obs_metadata", {"ra": ra, "dec": dec, "size": size}),
            fits_download_url=result.get("fits_download_url"),
            dataset_source=result.get("dataset_source", "NASA/IPAC IRSA SPHEREx Cutout Service"),
            source_attribution=result.get("source_attribution", "NASA/SPHEREx and NASA/IPAC IRSA"),
            warning=result.get("warning"),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Predefined targets
# ---------------------------------------------------------------------------

@router.get(
    "/targets",
    response_model=list[Target],
    summary="Return predefined NASA SPHEREx science targets",
)
def get_targets() -> list[Target]:
    """Return a curated list of real NASA science targets for exploration."""
    raw = spherex_service.get_targets()
    return [
        Target(
            name=t["name"],
            ra=t["ra"],
            dec=t["dec"],
            description=t["description"],
            type=t["type"],
        )
        for t in raw
    ]


# ---------------------------------------------------------------------------
# Spectrum
# ---------------------------------------------------------------------------

@router.get(
    "/spectrum",
    summary="Retrieve SPHEREx spectral data for sky coordinates",
)
def get_spectrum(
    ra: float = Query(..., description="Right ascension (decimal degrees)", ge=0, le=360),
    dec: float = Query(..., description="Declination (decimal degrees)", ge=-90, le=90),
    obs_id: Optional[str] = Query(None, description="Observation ID"),
) -> dict:
    """Retrieve SPHEREx spectral data (102 channels, 0.75–5.0 µm)."""
    try:
        return spherex_service.get_spectrum(ra=ra, dec=dec, obs_id=obs_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Light curve
# ---------------------------------------------------------------------------

@router.get(
    "/light-curve",
    summary="Retrieve multi-epoch photometry (light curve) for a source",
)
def get_light_curve(
    ra: float = Query(..., description="Right ascension (decimal degrees)", ge=0, le=360),
    dec: float = Query(..., description="Declination (decimal degrees)", ge=-90, le=90),
    band: Optional[str] = Query(None, description="Filter by band (e.g. Band 1, Band 2... or all)"),
    collection: str = Query("spherex_dr1", description="SPHEREx collection"),
    source_id: Optional[str] = Query(None, description="Source identifier"),
) -> dict:
    """Retrieve time-series photometric data and variability statistics from SPHEREx all-sky survey."""
    try:
        return spherex_service.get_light_curve(
            ra=ra, dec=dec, source_id=source_id, band=band, collection=collection
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
