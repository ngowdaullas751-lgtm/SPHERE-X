"""
Pydantic v2 Schemas for COSMIC LENS - NASA SPHEREx Sky Explorer API
"""
from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class ObservationResult(BaseModel):
    obs_id: str
    ra: float
    dec: float
    target_ra: Optional[float] = None
    target_dec: Optional[float] = None
    pointing_center_ra: Optional[float] = None
    pointing_center_dec: Optional[float] = None
    separation_arcmin: Optional[float] = None
    detector_fov_deg: Optional[float] = None
    date: str
    instrument: str
    band: str
    collection: Optional[str] = None
    access_url: Optional[str] = None
    url: Optional[str] = None
    image_base64: Optional[str] = None
    footprint_status: Optional[str] = "TARGET FOOTPRINT VERIFIED"
    quality_status: Optional[str] = "ARCHIVE RESULT"
    spatial_validation: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CutoutResult(BaseModel):
    image_base64: Optional[str] = None
    wcs_info: dict[str, Any] = Field(default_factory=dict)
    obs_metadata: dict[str, Any] = Field(default_factory=dict)
    fits_download_url: Optional[str] = None
    dataset_source: Optional[str] = "NASA/IPAC IRSA SPHEREx Cutout Service"
    source_attribution: Optional[str] = "NASA/SPHEREx and NASA/IPAC IRSA"
    warning: Optional[str] = None


class ProcessedImage(BaseModel):
    image_base64: str
    normalized: bool = True
    source_count: int = 0
    stats: dict[str, Any] = Field(default_factory=dict)


class ComparisonResult(BaseModel):
    image1_b64: str
    image2_b64: str
    diff_b64: Optional[str] = None
    heatmap_b64: Optional[str] = None
    stats: dict[str, Any] = Field(default_factory=dict)


class MotionCandidate(BaseModel):
    candidate_id: str
    ra: float
    dec: float
    date1: str
    date2: str
    displacement_arcsec: float
    speed_arcsec_per_year: float
    direction_deg: float
    confidence: float = Field(ge=0.0, le=1.0)
    status: str = "candidate"  # always "candidate", never "confirmed"
    classification: str = "possible_moving_source"  # possible_moving_source, stationary_source, variable_brightness_source, uncertain_detection, image_artifact
    classification_label: str = "Possible Moving Source (Unverified)"
    verification_status: str = "UNVERIFIED (Requires independent confirmation)"
    uncertainty_arcsec: float = 0.0
    uncertainty_speed: float = 0.0
    significance_sigma: float = 0.0
    snr1: float = 0.0
    snr2: float = 0.0
    flux1: float = 0.0
    flux2: float = 0.0
    delta_mag: float = 0.0
    sharpness1: Optional[float] = None
    roundness1: Optional[float] = None
    fwhm_px: float = 2.5
    notes: Optional[str] = None
    _px: Optional[dict[str, Any]] = None


class MotionDetectionResult(BaseModel):
    candidates: list[MotionCandidate] = Field(default_factory=list)
    matched_sources: list[MotionCandidate] = Field(default_factory=list)
    total_sources_1: int = 0
    total_sources_2: int = 0
    matched: int = 0
    image1_b64: Optional[str] = None
    image2_b64: Optional[str] = None
    reprojected_b64: Optional[str] = None
    diff_b64: Optional[str] = None
    dt_years: Optional[float] = None
    dt_days: Optional[float] = None
    alignment_status: Optional[str] = "REPROJECT_WCS_ALIGNED"
    background1_stats: Optional[dict[str, float]] = None
    background2_stats: Optional[dict[str, float]] = None
    quality_assessment: Optional[dict[str, Any]] = None
    scientific_notes: Optional[str] = None
    disclaimer: Optional[str] = (
        "These are unverified CANDIDATES only. Expert review and independent confirmation "
        "are required before any discovery claim can be made."
    )


class SpectralChannelPoint(BaseModel):
    channel_index: int
    wavelength_um: float
    fwhm_um: float
    flux_mjy: float
    flux_mjy_sr: float
    flux_error: float
    snr: float
    detector: int
    band_name: str
    date_obs: str
    obs_id: str
    quality_flag: int = 0
    quality_status: str = "VALID_CALIBRATED"
    image_b64: Optional[str] = None


class SpectrumResult(BaseModel):
    wavelengths: list[float] = Field(default_factory=list)
    fluxes: list[float] = Field(default_factory=list)
    flux_errors: list[float] = Field(default_factory=list)
    bands: list[str] = Field(default_factory=list)
    obs_id: Optional[str] = None
    channel_points: list[SpectralChannelPoint] = Field(default_factory=list)
    channels_observed: int = 0
    total_nominal_channels: int = 102
    coverage_pct: float = 0.0
    units: str = "mJy"
    surface_brightness_units: str = "MJy/sr"
    spectral_coverage_summary: Optional[str] = None
    detected_features: list[dict[str, Any]] = Field(default_factory=list)
    warning: Optional[str] = None
    dataset_source: Optional[str] = "NASA/IPAC Infrared Science Archive (IRSA)"
    source_attribution: Optional[str] = "NASA/SPHEREx and NASA/IPAC IRSA"
    metadata: dict[str, Any] = Field(default_factory=dict)


class PhotometricEpochPoint(BaseModel):
    epoch_index: int
    date_obs: str
    mjd: Optional[float] = None
    obs_id: str
    band: str
    detector: int
    flux_mjy: float
    flux_error_mjy: float
    flux_mjy_sr: float
    background_mjy_sr: float
    snr: float
    quality_flag: int = 0
    quality_status: str = "VALID_CALIBRATED"
    image_b64: Optional[str] = None


class LightCurveResult(BaseModel):
    epochs: list[PhotometricEpochPoint] = Field(default_factory=list)
    dates: list[str] = Field(default_factory=list)
    fluxes: list[float] = Field(default_factory=list)
    flux_errors: list[float] = Field(default_factory=list)
    bands: list[str] = Field(default_factory=list)
    source_id: Optional[str] = None
    target_name: Optional[str] = None
    ra: float = 0.0
    dec: float = 0.0
    units: str = "mJy"
    variability_statistics: dict[str, Any] = Field(default_factory=dict)
    warning: Optional[str] = None
    dataset_source: Optional[str] = "NASA/IPAC Infrared Science Archive (IRSA) — SPHEREx Multi-Epoch Survey"
    source_attribution: Optional[str] = "NASA/SPHEREx and NASA/IPAC IRSA"
    csv_export: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Candidate(BaseModel):
    id: str
    target_name: Optional[str] = None
    ra: float
    dec: float
    type: str = "Possible Moving Source"
    category: Optional[str] = "Possible Moving Source"
    confidence: float = 0.85
    significance: float = 0.0
    uncertainty: float = 0.0
    status: str = "Unverified candidate"
    collection: str = "spherex_dr1"
    obs_ids: list[str] = Field(default_factory=list)
    dates: list[str] = Field(default_factory=list)
    motion_vector: Optional[dict[str, Any]] = None
    brightness_data: Optional[dict[str, Any]] = None
    image_1_b64: Optional[str] = None
    image_2_b64: Optional[str] = None
    diff_image_b64: Optional[str] = None
    notes: Optional[str] = None
    scientific_notes: Optional[str] = None
    verified: bool = False
    community_votes: int = 0
    interesting_count: int = 0
    artifact_reports_count: int = 0
    comments: list[dict[str, Any]] = Field(default_factory=list)
    review_history: list[dict[str, Any]] = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CommentRequest(BaseModel):
    author: Optional[str] = "Citizen Scientist"
    comment: str


class ArtifactReportRequest(BaseModel):
    reason: str
    reporter: Optional[str] = "Citizen Scientist"


class ReviewSubmissionRequest(BaseModel):
    user_notes: Optional[str] = ""


class AdminReviewRequest(BaseModel):
    new_status: str
    reviewer: Optional[str] = "NASA Science Team Reviewer"
    review_notes: str


class HealthResponse(BaseModel):
    status: str
    version: str
    nasa_archive_connected: bool
    timestamp: str


class Target(BaseModel):
    name: str
    ra: float
    dec: float
    description: str
    type: str


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
