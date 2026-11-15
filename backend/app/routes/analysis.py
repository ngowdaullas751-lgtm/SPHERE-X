"""
Analysis router — image processing, comparison, motion detection, candidates.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..models.schemas import (
    ComparisonResult,
    MotionDetectionResult,
    ProcessedImage,
    Candidate,
    CommentRequest,
    ArtifactReportRequest,
    ReviewSubmissionRequest,
    AdminReviewRequest,
)
from ..services import image_service, motion_service, discovery_db, gaia_service, shift_add_service

router = APIRouter(prefix="/api", tags=["analysis"])


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class ProcessImageRequest(BaseModel):
    image_base64: str


class CompareImagesRequest(BaseModel):
    image1_b64: str
    image2_b64: str


class DetectMotionRequest(BaseModel):
    image1_b64: Optional[str] = None
    image2_b64: Optional[str] = None
    access_url1: Optional[str] = None
    access_url2: Optional[str] = None
    obs_id1: Optional[str] = None
    obs_id2: Optional[str] = None
    ra: Optional[float] = None
    dec: Optional[float] = None
    date1: str = "unknown"
    date2: str = "unknown"
    pixel_scale_arcsec: float = 6.15
    threshold_sigma: float = 2.5


class ShiftAndAddRequest(BaseModel):
    images_data: list[dict[str, Any]]
    motion_rate_arcsec_yr: Optional[float] = None
    position_angle_deg: Optional[float] = None
    vx_px_yr: Optional[float] = None
    vy_px_yr: Optional[float] = None
    combine_method: str = "median"
    pixel_scale_arcsec: float = 6.15


# ---------------------------------------------------------------------------
# In-memory candidates store (simple; replace with DB for production)
# ---------------------------------------------------------------------------
_CANDIDATES: list[dict[str, Any]] = []


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post(
    "/process-image",
    response_model=ProcessedImage,
    summary="Normalize and analyse a single astronomical image",
)
def process_image(body: ProcessImageRequest) -> ProcessedImage:
    """Apply asinh normalization, source detection, and stats to an uploaded image."""
    if not body.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")
    try:
        result = image_service.process_image(body.image_base64)
        return ProcessedImage(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Processing failed: {exc}") from exc


@router.post(
    "/compare-images",
    response_model=ComparisonResult,
    summary="Compute difference image between two observations",
)
def compare_images(body: CompareImagesRequest) -> ComparisonResult:
    """Align and subtract two images, returning diff and heatmap visualizations."""
    if not body.image1_b64 or not body.image2_b64:
        raise HTTPException(status_code=400, detail="Both image1_b64 and image2_b64 are required")
    try:
        arr1 = image_service.base64_to_array(body.image1_b64)
        arr2 = image_service.base64_to_array(body.image2_b64)

        # Normalize both for display
        norm1 = image_service.normalize_asinh(arr1)
        norm2 = image_service.normalize_asinh(arr2)

        sub = image_service.subtract_images(arr1, arr2)
        diff_array = sub["diff_array"]
        stats = sub["stats"]

        img1_b64 = image_service.array_to_base64_png(norm1)
        img2_b64 = image_service.array_to_base64_png(norm2)
        diff_b64 = image_service.array_to_base64_png(
            image_service.normalize_linear(diff_array)
        )
        heatmap_b64 = image_service.generate_heatmap(diff_array)

        return ComparisonResult(
            image1_b64=img1_b64,
            image2_b64=img2_b64,
            diff_b64=diff_b64,
            heatmap_b64=heatmap_b64,
            stats=stats,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {exc}") from exc


@router.post(
    "/detect-motion",
    response_model=MotionDetectionResult,
    summary="Detect apparent motion of sources between two epoch images",
)
def detect_motion(body: DetectMotionRequest) -> MotionDetectionResult:
    """Run the motion detection pipeline on two observation images or FITS cutouts.

    Results are labelled 'candidate' — expert verification is always required.
    """
    has_b64 = bool(body.image1_b64 and body.image2_b64)
    has_urls = bool((body.access_url1 or body.obs_id1) and (body.access_url2 or body.obs_id2))
    if not has_b64 and not has_urls:
        raise HTTPException(
            status_code=400,
            detail="Either both images (image1_b64, image2_b64) or both access URLs (access_url1, access_url2) with coordinates are required.",
        )
    try:
        result = motion_service.detect_motion_pipeline(
            image1_b64=body.image1_b64,
            image2_b64=body.image2_b64,
            access_url1=body.access_url1,
            access_url2=body.access_url2,
            obs_id1=body.obs_id1,
            obs_id2=body.obs_id2,
            ra=body.ra,
            dec=body.dec,
            date1=body.date1,
            date2=body.date2,
            pixel_scale_arcsec=body.pixel_scale_arcsec,
            threshold_sigma=body.threshold_sigma,
        )
        if "error" in result and not result.get("candidates") and result.get("total_sources_1", 0) == 0:
            raise HTTPException(status_code=422, detail=result["error"])

        return MotionDetectionResult(
            candidates=result.get("candidates", []),
            matched_sources=result.get("matched_sources", []),
            total_sources_1=result.get("total_sources_1", 0),
            total_sources_2=result.get("total_sources_2", 0),
            matched=result.get("matched", 0),
            image1_b64=result.get("image1_b64"),
            image2_b64=result.get("image2_b64"),
            reprojected_b64=result.get("reprojected_b64"),
            diff_b64=result.get("diff_b64"),
            dt_years=result.get("dt_years"),
            dt_days=result.get("dt_days"),
            alignment_status=result.get("alignment_status", "REPROJECT_WCS_ALIGNED"),
            background1_stats=result.get("background1_stats"),
            background2_stats=result.get("background2_stats"),
            quality_assessment=result.get("quality_assessment"),
            scientific_notes=result.get("scientific_notes"),
            disclaimer=result.get("disclaimer"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Motion detection failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Discovery Hub & Citizen Science Candidate Endpoints (Persistent SQLite)
# ---------------------------------------------------------------------------

@router.get(
    "/discovery/stats",
    summary="Get real discovery dashboard metrics from database",
)
def get_discovery_stats() -> dict[str, Any]:
    """Return actual discovery statistics calculated from SQLite records."""
    try:
        return discovery_db.get_dashboard_stats()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load discovery stats: {exc}") from exc


@router.get(
    "/candidates",
    summary="List motion and variable source discovery candidates",
)
def get_candidates(
    category: Optional[str] = Query(None, description="Filter by candidate category"),
    status: Optional[str] = Query(None, description="Filter by review status"),
) -> list[dict[str, Any]]:
    """Return all candidates from persistent database with optional category/status filters."""
    try:
        return discovery_db.list_candidates(category=category, status=status)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve candidates: {exc}") from exc


@router.get(
    "/candidates/{candidate_id}",
    summary="Get complete candidate details with images, comments, and review audit trail",
)
def get_candidate(candidate_id: str) -> dict[str, Any]:
    """Retrieve full candidate record by ID."""
    cand = discovery_db.get_candidate_by_id(candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail=f"Candidate '{candidate_id}' not found.")
    return cand


@router.post(
    "/candidates",
    summary="Submit a new candidate for community review",
)
def submit_candidate(candidate: Candidate) -> dict[str, Any]:
    """Submit a new motion, variable, or transient candidate to persistent SQLite store."""
    try:
        cand_dict = candidate.model_dump()
        return discovery_db.create_candidate(cand_dict)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to submit candidate: {exc}") from exc


@router.post(
    "/candidates/{candidate_id}/vote",
    summary="Cast a community endorsement vote on a candidate",
)
def vote_candidate(candidate_id: str) -> dict[str, Any]:
    """Increment community vote count for a candidate."""
    cand = discovery_db.vote_candidate(candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail=f"Candidate '{candidate_id}' not found.")
    return {"id": candidate_id, "community_votes": cand["community_votes"]}


@router.post(
    "/candidates/{candidate_id}/interesting",
    summary="Mark candidate image as scientifically interesting",
)
def mark_interesting(candidate_id: str) -> dict[str, Any]:
    """Increment interesting flag counter for a candidate."""
    cand = discovery_db.mark_interesting(candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail=f"Candidate '{candidate_id}' not found.")
    return {"id": candidate_id, "interesting_count": cand["interesting_count"]}


@router.post(
    "/candidates/{candidate_id}/artifact",
    summary="Report candidate as a possible detector or optical artifact",
)
def report_artifact(candidate_id: str, payload: ArtifactReportRequest) -> dict[str, Any]:
    """Flag a candidate as an artifact and log the user's scientific reasoning."""
    cand = discovery_db.report_artifact(candidate_id, reason=payload.reason, reporter=payload.reporter or "Citizen Scientist")
    if not cand:
        raise HTTPException(status_code=404, detail=f"Candidate '{candidate_id}' not found.")
    return {"id": candidate_id, "status": cand["status"], "artifact_reports_count": cand["artifact_reports_count"]}


@router.post(
    "/candidates/{candidate_id}/comments",
    summary="Add a citizen scientist discussion comment to a candidate",
)
def add_comment(candidate_id: str, payload: CommentRequest) -> dict[str, Any]:
    """Add a discussion comment to a candidate."""
    cand = discovery_db.add_comment(candidate_id, author=payload.author or "Citizen Scientist", comment=payload.comment)
    if not cand:
        raise HTTPException(status_code=404, detail=f"Candidate '{candidate_id}' not found.")
    return {"id": candidate_id, "comments": cand.get("comments", [])}


@router.post(
    "/candidates/{candidate_id}/submit-review",
    summary="Submit candidate for formal scientific peer review",
)
def submit_for_review(candidate_id: str, payload: ReviewSubmissionRequest) -> dict[str, Any]:
    """Update candidate status to 'Under review' and record in audit log."""
    cand = discovery_db.submit_for_review(candidate_id, user_notes=payload.user_notes or "")
    if not cand:
        raise HTTPException(status_code=404, detail=f"Candidate '{candidate_id}' not found.")
    return {"id": candidate_id, "status": cand["status"], "review_history": cand.get("review_history", [])}


@router.post(
    "/candidates/{candidate_id}/review",
    summary="Admin review interface endpoint to update status and record audit log",
)
def admin_review_candidate(candidate_id: str, payload: AdminReviewRequest) -> dict[str, Any]:
    """Admin / Science Team review decision endpoint."""
    try:
        cand = discovery_db.update_review_status(
            candidate_id=candidate_id,
            new_status=payload.new_status,
            reviewer=payload.reviewer or "NASA Science Team Reviewer",
            notes=payload.review_notes,
        )
        return {
            "id": candidate_id,
            "status": cand["status"],
            "review_history": cand.get("review_history", []),
            "updated_at": cand.get("updated_at"),
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err)) from val_err
    except KeyError as key_err:
        raise HTTPException(status_code=404, detail=str(key_err)) from key_err
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update review status: {exc}") from exc


# ---------------------------------------------------------------------------
# WiseView-Inspired Infrared Blink & Astrometry Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/gaia",
    summary="Query ESA Gaia DR3 astrometric catalogue for background reference stars",
)
def get_gaia_stars(
    ra: float = Query(..., description="Right ascension (deg)", ge=0, le=360),
    dec: float = Query(..., description="Declination (deg)", ge=-90, le=90),
    radius: float = Query(0.05, description="Search radius in degrees", gt=0, le=2.0),
    limit: int = Query(40, description="Max stars to return", ge=1, le=100),
) -> dict[str, Any]:
    """Retrieve Gaia DR3 reference stars with positions and proper motions for blinking overlay."""
    try:
        return gaia_service.query_gaia_dr3(
            ra=ra,
            dec=dec,
            radius_deg=radius,
            max_sources=limit,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gaia query failed: {exc}") from exc


@router.post(
    "/shift-and-add",
    summary="Coadd multi-epoch observations along a candidate motion vector",
)
def post_shift_and_add(payload: ShiftAndAddRequest) -> dict[str, Any]:
    """Execute shift-and-add coaddition across multi-epoch observation arrays to boost moving candidate SNR."""
    try:
        return shift_add_service.run_shift_and_add(
            images_data=payload.images_data,
            motion_rate_arcsec_yr=payload.motion_rate_arcsec_yr,
            position_angle_deg=payload.position_angle_deg,
            vx_px_yr=payload.vx_px_yr,
            vy_px_yr=payload.vy_px_yr,
            combine_method=payload.combine_method,
            pixel_scale_arcsec=payload.pixel_scale_arcsec,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Shift-and-add processing failed: {exc}") from exc

