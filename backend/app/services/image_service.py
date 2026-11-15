"""
Image processing service for astronomical FITS/array data.
Provides normalization, source detection, and image comparison utilities.
"""
from __future__ import annotations

import base64
import io
import logging
from typing import Any, Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

def normalize_asinh(data: np.ndarray, stretch: float = 0.1) -> np.ndarray:
    """Asinh stretch normalization for astronomical images.

    Args:
        data: 2-D float array (raw pixel values).
        stretch: Controls the linear-to-nonlinear transition point.

    Returns:
        Array scaled to [0, 1] with asinh stretch applied.
    """
    data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)
    positive = data[data > 0]
    vmin = float(np.percentile(positive, 1)) if positive.size > 0 else float(data.min())
    vmax = float(np.percentile(data, 99))
    if vmax == vmin:
        return np.zeros_like(data)
    data_norm = (data - vmin) / (vmax - vmin)
    data_stretch = np.arcsinh(data_norm / stretch) / np.arcsinh(1.0 / stretch)
    return np.clip(data_stretch, 0.0, 1.0)


def normalize_linear(data: np.ndarray, low: float = 1.0, high: float = 99.0) -> np.ndarray:
    """Linear percentile normalization."""
    data = np.nan_to_num(data, nan=0.0)
    vmin = np.percentile(data, low)
    vmax = np.percentile(data, high)
    if vmax == vmin:
        return np.zeros_like(data)
    return np.clip((data - vmin) / (vmax - vmin), 0.0, 1.0)


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------

def array_to_base64_png(data: np.ndarray, colormap: str = "inferno") -> str:
    """Convert a 2-D numpy array to a base64-encoded PNG string.

    Uses matplotlib for colormapping when available; falls back to PIL grayscale.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(6, 6), dpi=100)
        fig.patch.set_facecolor("black")
        ax.set_facecolor("black")
        ax.imshow(data, origin="lower", cmap=colormap, interpolation="nearest")
        ax.axis("off")

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0, facecolor="black")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode()
    except Exception as exc:
        logger.warning("matplotlib render failed (%s), falling back to PIL", exc)
        return _array_to_pil_png(data)


def _array_to_pil_png(data: np.ndarray) -> str:
    """Fallback: render array as 8-bit grayscale PNG via PIL."""
    norm = normalize_linear(data)
    uint8 = (norm * 255).astype(np.uint8)
    img = Image.fromarray(uint8, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()


def base64_to_array(image_b64: str) -> np.ndarray:
    """Decode a base64 PNG/JPEG/FITS-preview back to a numpy float array."""
    raw = base64.b64decode(image_b64)
    img = Image.open(io.BytesIO(raw)).convert("L")
    return np.array(img, dtype=np.float64)


def create_placeholder_image(
    width: int = 512,
    height: int = 512,
    message: str = "No image available",
) -> str:
    """Generate a dark placeholder PNG with centred text."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(width / 100, height / 100), dpi=100)
        fig.patch.set_facecolor("#0a0a1a")
        ax.set_facecolor("#0a0a1a")
        ax.text(
            0.5, 0.5, message,
            ha="center", va="center",
            color="#6ee7f7", fontsize=12, wrap=True,
            transform=ax.transAxes,
        )
        ax.axis("off")
        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", facecolor="#0a0a1a")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode()
    except Exception:
        # ultra-minimal fallback
        img = Image.new("RGB", (width, height), color=(10, 10, 26))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return base64.b64encode(buf.read()).decode()


# ---------------------------------------------------------------------------
# Image comparison
# ---------------------------------------------------------------------------

def subtract_images(
    img1: np.ndarray,
    img2: np.ndarray,
) -> dict[str, Any]:
    """Compute difference image between two aligned arrays.

    Arrays are resized to match if their shapes differ (using PIL).
    """
    if img1.shape != img2.shape:
        h, w = min(img1.shape[0], img2.shape[0]), min(img1.shape[1], img2.shape[1])
        img1 = img1[:h, :w]
        img2 = img2[:h, :w]

    diff = img1.astype(np.float64) - img2.astype(np.float64)
    abs_diff = np.abs(diff)
    std = float(np.nanstd(diff)) or 1.0

    stats: dict[str, Any] = {
        "mean_diff": float(np.nanmean(diff)),
        "std_diff": std,
        "max_abs_diff": float(np.nanmax(abs_diff)),
        "changed_pixels": int(np.sum(abs_diff > 3 * std)),
        "shape": list(diff.shape),
    }
    return {"diff_array": diff, "stats": stats}


def generate_heatmap(diff_array: np.ndarray) -> str:
    """Generate a diverging heatmap of the difference image (blue=negative, red=positive)."""
    return array_to_base64_png(diff_array, colormap="RdBu_r")


# ---------------------------------------------------------------------------
# Source detection
# ---------------------------------------------------------------------------

def detect_sources(
    data: np.ndarray,
    threshold_sigma: float = 3.0,
) -> list[dict[str, Any]]:
    """Detect point sources using sigma-clipped statistics + DAOStarFinder.

    Falls back to a simple peak-finding approach if photutils is not available.
    """
    try:
        from photutils.detection import DAOStarFinder
        from astropy.stats import sigma_clipped_stats

        mean, median, std = sigma_clipped_stats(data, sigma=3.0)
        daofind = DAOStarFinder(fwhm=3.0, threshold=threshold_sigma * std)
        sources = daofind(data - median)
        if sources is None or len(sources) == 0:
            return _detect_sources_scipy(data, threshold_sigma)
        
        x_col = "x_centroid" if "x_centroid" in sources.colnames else "xcentroid"
        y_col = "y_centroid" if "y_centroid" in sources.colnames else "ycentroid"
        peak_col = "peak" if "peak" in sources.colnames else "flux"

        return [
            {
                "x": float(s[x_col]),
                "y": float(s[y_col]),
                "flux": float(s[peak_col]),
                "id": int(s["id"]) if "id" in sources.colnames else idx,
            }
            for idx, s in enumerate(sources)
        ]
    except ImportError:
        logger.info("photutils/astropy not available; using scipy peak detection")
        return _detect_sources_scipy(data, threshold_sigma)
    except Exception as exc:
        logger.error("Source detection failed: %s", exc)
        return []


def _detect_sources_scipy(
    data: np.ndarray,
    threshold_sigma: float = 3.0,
) -> list[dict[str, Any]]:
    """Fallback source detection using scipy.ndimage."""
    try:
        from scipy.ndimage import maximum_filter, label

        median = float(np.nanmedian(data))
        std = float(np.nanstd(data)) or 1.0
        threshold = median + threshold_sigma * std

        local_max = maximum_filter(data, size=5) == data
        above_thresh = data > threshold
        peaks = local_max & above_thresh

        labeled, num_features = label(peaks)
        sources = []
        for idx in range(1, num_features + 1):
            ys, xs = np.where(labeled == idx)
            if len(xs) == 0:
                continue
            cy, cx = int(np.mean(ys)), int(np.mean(xs))
            sources.append({
                "x": float(cx),
                "y": float(cy),
                "flux": float(data[cy, cx]),
                "id": idx,
            })
        return sources
    except Exception as exc:
        logger.error("scipy source detection failed: %s", exc)
        return []


def compute_image_stats(data: np.ndarray) -> dict[str, Any]:
    """Compute basic descriptive statistics for an image array."""
    flat = data.flatten()
    flat = flat[np.isfinite(flat)]
    if flat.size == 0:
        return {}
    return {
        "min": float(flat.min()),
        "max": float(flat.max()),
        "mean": float(flat.mean()),
        "median": float(np.median(flat)),
        "std": float(flat.std()),
        "p1": float(np.percentile(flat, 1)),
        "p99": float(np.percentile(flat, 99)),
        "shape": list(data.shape),
    }


def process_image(image_b64: str) -> dict[str, Any]:
    """Full pipeline: decode → normalize → detect sources → encode.

    Returns dict suitable for ProcessedImage schema.
    """
    try:
        raw_array = base64_to_array(image_b64)
    except Exception as exc:
        raise ValueError(f"Failed to decode image: {exc}") from exc

    stats = compute_image_stats(raw_array)
    normalized = normalize_asinh(raw_array)
    sources = detect_sources(raw_array)
    image_out = array_to_base64_png(normalized)

    return {
        "image_base64": image_out,
        "normalized": True,
        "source_count": len(sources),
        "stats": {**stats, "sources": sources[:50]},  # cap list to 50 for payload size
    }
