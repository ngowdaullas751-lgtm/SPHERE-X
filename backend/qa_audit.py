"""
COSMIC LENS - Automated QA Audit & Scientific Validation Test Suite
Senior QA Engineer & NASA Scientific Software Validation Engineer
"""
import sys
import os
import math
import json
import base64
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import requests
from astropy.io import fits
from astropy.wcs import WCS
from astropy.coordinates import SkyCoord
import astropy.units as u

results = {
    "passed": [],
    "failed": [],
    "fixed": [],
    "limitations": [],
}

def log_test(test_id, name, passed, details=""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {test_id}: {name}")
    if details:
        print(f"       Details: {details}")
    if passed:
        results["passed"].append({"id": test_id, "name": name, "details": details})
    else:
        results["failed"].append({"id": test_id, "name": name, "details": details})

print("=" * 80)
print("COSMIC LENS — SCIENTIFIC SOFTWARE VALIDATION & AUDIT SUITE")
print("=" * 80)

# -----------------------------------------------------------------------------
# TASK 1 & 2: Server Verification
# -----------------------------------------------------------------------------
print("\n--- Tasks 1 & 2: Process & Health Checks ---")

try:
    r = requests.get("http://localhost:8000/api/health", timeout=5)
    health_data = r.json()
    fastapi_ok = (r.status_code == 200 and health_data.get("status") == "ok")
    log_test("TC-01", "FastAPI Server Online & /api/health Responding", fastapi_ok, str(health_data))
except Exception as e:
    log_test("TC-01", "FastAPI Server Online & /api/health Responding", False, str(e))

try:
    r = requests.get("http://localhost:5173", timeout=5)
    react_ok = (r.status_code == 200 and "<div id=\"root\">" in r.text)
    log_test("TC-02", "React Vite Frontend Server Online on Port 5173", react_ok, f"Status code: {r.status_code}")
except Exception as e:
    log_test("TC-02", "React Vite Frontend Server Online on Port 5173", False, str(e))

# -----------------------------------------------------------------------------
# TASK 3: React-FastAPI Communication
# -----------------------------------------------------------------------------
print("\n--- Task 3: Client-Server Cross-Origin & Reverse Proxy Communication ---")

try:
    # Test proxying through frontend port 5173
    r = requests.get("http://localhost:5173/api/health", timeout=5)
    proxy_ok = (r.status_code == 200 and r.json().get("status") == "ok")
    log_test("TC-03", "Frontend-to-Backend Reverse Proxy (/api -> :8000)", proxy_ok, f"Proxy status: {r.status_code}")
except Exception as e:
    log_test("TC-03", "Frontend-to-Backend Reverse Proxy (/api -> :8000)", False, str(e))

# -----------------------------------------------------------------------------
# TASK 4: Complete API Endpoint Audit
# -----------------------------------------------------------------------------
print("\n--- Task 4: API Endpoints Audit ---")

endpoints_to_test = [
    ("GET", "/api/health", {}),
    ("GET", "/api/targets", {}),
    ("GET", "/api/observations?ra=269.4521&dec=4.6933&radius=0.25", {}),
    ("GET", "/api/cutout?ra=269.4521&dec=4.6933&size=5", {}),
    ("GET", "/api/spectrum?ra=269.4521&dec=4.6933", {}),
    ("GET", "/api/light-curve?ra=75.7954&dec=30.4013", {}),
    ("GET", "/api/candidates", {}),
]

for method, path, _ in endpoints_to_test:
    url = f"http://localhost:8000{path}"
    try:
        r = requests.get(url, timeout=15)
        passed = (r.status_code == 200)
        log_test(f"TC-API-{path.split('?')[0].replace('/api/', '')}", f"{method} {path.split('?')[0]}", passed, f"Status: {r.status_code}")
    except Exception as e:
        log_test(f"TC-API-{path.split('?')[0].replace('/api/', '')}", f"{method} {path.split('?')[0]}", False, str(e))

# Test POST /api/candidates and /api/candidates/{id}/vote
try:
    test_cand = {
        "id": "QA-TEST-001",
        "ra": 133.7930,
        "dec": -7.2451,
        "type": "QA Validation Candidate",
        "confidence": 0.95,
        "dates": ["2025-01-01", "2025-06-01"],
        "notes": "Automated QA submission test",
    }
    r = requests.post("http://localhost:8000/api/candidates", json=test_cand, timeout=5)
    cand_post_ok = (r.status_code == 200 and r.json().get("id") == "QA-TEST-001")
    log_test("TC-API-candidates-post", "POST /api/candidates submission", cand_post_ok, f"Created id: {r.json().get('id')}")

    # Vote on this candidate
    r_vote = requests.post("http://localhost:8000/api/candidates/QA-TEST-001/vote", timeout=5)
    vote_ok = (r_vote.status_code == 200 and r_vote.json().get("community_votes") == 1)
    log_test("TC-API-candidates-vote", "POST /api/candidates/{id}/vote", vote_ok, f"Votes: {r_vote.json().get('community_votes')}")
except Exception as e:
    log_test("TC-API-candidates-post", "POST /api/candidates", False, str(e))
    log_test("TC-API-candidates-vote", "POST /api/candidates/{id}/vote", False, str(e))

# -----------------------------------------------------------------------------
# TASK 5: NASA IRSA Live Connectivity
# -----------------------------------------------------------------------------
print("\n--- Task 5: NASA IRSA Live Archive Connectivity ---")

try:
    irsa_url = "https://irsa.ipac.caltech.edu/TAP/sync?QUERY=SELECT+TOP+1+table_name+FROM+TAP_SCHEMA.tables&FORMAT=json"
    r = requests.get(irsa_url, timeout=10)
    irsa_live = (r.status_code == 200 and "VOTABLE" in r.text)
    log_test("TC-05", "NASA/IPAC IRSA TAP Live Endpoint Connection", irsa_live, f"Status: {r.status_code}")
except Exception as e:
    log_test("TC-05", "NASA/IPAC IRSA TAP Live Endpoint Connection", False, f"IRSA ping note: {e}")

# -----------------------------------------------------------------------------
# TASK 6: Coordinate Conversion using WISE 0855
# -----------------------------------------------------------------------------
print("\n--- Task 6: Astrometric Coordinate Conversion (WISE 0855) ---")

# Official sexagesimal coordinates from prompt:
# RA: 08h 55m 10.831s
# Dec: -07° 14' 42.53"
def sexagesimal_to_decimal(ra_str, dec_str):
    # Parse RA "08h 55m 10.831s"
    coord = SkyCoord(f"{ra_str} {dec_str}", unit=(u.hourangle, u.deg), frame="icrs")
    return coord.ra.deg, coord.dec.deg

ra_str = "08h 55m 10.831s"
dec_str = "-07d 14m 42.53s"
ra_deg, dec_deg = sexagesimal_to_decimal(ra_str, dec_str)

# Expected decimal values:
# 8*15 + 55*15/60 + 10.831*15/3600 = 133.795129 deg
# -(7 + 14/60 + 42.53/3600) = -7.245147 deg
expected_ra = 133.795129
expected_dec = -7.245147

ra_err = abs(ra_deg - expected_ra)
dec_err = abs(dec_deg - expected_dec)
coord_ok = (ra_err < 1e-4 and dec_err < 1e-4)

log_test("TC-06", "WISE 0855 Sexagesimal to Decimal Degree Conversion", coord_ok,
         f"Calculated: RA={ra_deg:.6f}°, Dec={dec_deg:.6f}° (ΔRA={ra_err:.2e}°, ΔDec={dec_err:.2e}°)")

# -----------------------------------------------------------------------------
# TASK 7: FITS Reading & Astropy WCS Processing
# -----------------------------------------------------------------------------
print("\n--- Task 7: FITS Image Reading & Astropy WCS Transformation ---")

fits_file = Path(__file__).parent / "data" / "samples" / "barnard_epoch_1.fits"
fits_ok = False
wcs_details = ""
if fits_file.exists():
    try:
        with fits.open(fits_file) as hdul:
            hdr = hdul[0].header
            data = hdul[0].data
            w = WCS(hdr)

            # Test world coordinate at center pixel (64, 64)
            sky_coord = w.pixel_to_world(64, 64)
            c_ra = sky_coord.ra.deg
            c_dec = sky_coord.dec.deg

            telescop = hdr.get("TELESCOP")
            bunit = hdr.get("BUNIT")
            shape = data.shape

            fits_ok = (shape == (128, 128) and telescop == "SPHEREx" and abs(c_ra - 269.4521) < 0.1)
            wcs_details = f"Shape: {shape}, Telescope: {telescop}, Unit: {bunit}, Center: ({c_ra:.4f}°, {c_dec:.4f}°)"
    except Exception as e:
        wcs_details = str(e)

log_test("TC-07", "Astropy FITS Header & WCS World Coordinate Transformation", fits_ok, wcs_details)

# -----------------------------------------------------------------------------
# TASK 8 & 9: Image Alignment & Subtraction
# -----------------------------------------------------------------------------
print("\n--- Tasks 8 & 9: Astronomical Image Alignment & Subtraction ---")

from app.services import image_service

try:
    # Test subtraction with different shapes (auto-alignment)
    arr_a = np.ones((120, 120), dtype=np.float32) * 50.0
    arr_b = np.ones((128, 128), dtype=np.float32) * 45.0
    arr_a[60, 60] = 500.0  # transient peak

    sub_res = image_service.subtract_images(arr_a, arr_b)
    diff = sub_res["diff_array"]
    stats = sub_res["stats"]

    align_sub_ok = (diff.shape == (120, 120) and abs(stats["mean_diff"] - 5.0) < 0.5 and stats["max_abs_diff"] > 400)
    log_test("TC-08", "Astronomical Dimension Alignment on Different Shapes", align_sub_ok, f"Aligned shape: {diff.shape}")

    heatmap_b64 = image_service.generate_heatmap(diff)
    heatmap_ok = (isinstance(heatmap_b64, str) and len(heatmap_b64) > 1000)
    log_test("TC-09", "Multi-Epoch Image Subtraction & RdBu Diverging Heatmap", heatmap_ok, f"Heatmap PNG length: {len(heatmap_b64)} bytes")
except Exception as e:
    log_test("TC-08", "Image Alignment", False, str(e))
    log_test("TC-09", "Image Subtraction", False, str(e))

# -----------------------------------------------------------------------------
# TASK 10: Astronomical Source Detection
# -----------------------------------------------------------------------------
print("\n--- Task 10: Source Detection (Photutils & SciPy) ---")

try:
    # Create test field with 3 known point sources
    test_field = np.random.normal(loc=100.0, scale=5.0, size=(100, 100)).astype(np.float32)
    # Inject 3 Gaussian stars:
    # Star 1: (30, 30), flux 500
    # Star 2: (70, 70), flux 800
    # Star 3: (30, 70), flux 300
    for sx, sy, f in [(30, 30, 500), (70, 70, 800), (30, 70, 300)]:
        y, x = np.indices((100, 100))
        psf = f * np.exp(-0.5 * ((x - sx)**2 + (y - sy)**2) / (1.5**2))
        test_field += psf.astype(np.float32)

    detected = image_service.detect_sources(test_field, threshold_sigma=3.0)
    # Check if 3 primary sources are detected near coordinates
    found_1 = any(abs(s["x"] - 30) < 2 and abs(s["y"] - 30) < 2 for s in detected)
    found_2 = any(abs(s["x"] - 70) < 2 and abs(s["y"] - 70) < 2 for s in detected)
    found_3 = any(abs(s["x"] - 30) < 2 and abs(s["y"] - 70) < 2 for s in detected)

    src_ok = (len(detected) >= 3 and found_1 and found_2 and found_3)
    log_test("TC-10", "Astronomical Point-Source Detection (DAOStarFinder)", src_ok,
             f"Detected {len(detected)} sources. Recovered injected stars: 1={found_1}, 2={found_2}, 3={found_3}")
except Exception as e:
    log_test("TC-10", "Astronomical Point-Source Detection", False, str(e))

# -----------------------------------------------------------------------------
# TASK 11: Motion Calculations & Uncertainty Handling
# -----------------------------------------------------------------------------
print("\n--- Task 11: Motion Vectors, Velocity & Confidence Handling ---")

from app.services import motion_service

try:
    # 2 epochs: stationary background stars + 1 moving star
    epoch1_sources = [
        {"x": 20.0, "y": 20.0, "flux": 500.0, "id": 1},
        {"x": 80.0, "y": 80.0, "flux": 600.0, "id": 2},
        {"x": 50.0, "y": 50.0, "flux": 1200.0, "id": 3}, # Moving star
    ]
    # In epoch 2, moving star moves by dx=6, dy=8 (displacement = 10 px)
    epoch2_sources = [
        {"x": 20.1, "y": 19.9, "flux": 510.0, "id": 10},
        {"x": 80.0, "y": 80.2, "flux": 590.0, "id": 20},
        {"x": 56.0, "y": 58.0, "flux": 1180.0, "id": 30}, # Displaced by 10 px
    ]

    # Baseline 1.0 year, 1.0 arcsec/px
    candidates = motion_service.calculate_motion_candidates(
        epoch1_sources,
        epoch2_sources,
        pixel_scale_arcsec=1.0,
        dt_years=1.0,
        min_displacement_px=2.0,
        image_shape=(100, 100)
    )

    moving_cand = [c for c in candidates if abs(c["displacement_arcsec"] - 10.0) < 0.5]
    motion_calc_ok = (len(moving_cand) == 1)

    details = ""
    if motion_calc_ok:
        c = moving_cand[0]
        # Speed should be ~10 arcsec/yr
        # Direction: atan2(6, 8) in degrees = ~36.87 deg
        details = (f"Displacement: {c['displacement_arcsec']:.2f} arcsec, "
                   f"Speed: {c['speed_arcsec_per_year']:.2f} \"/yr, "
                   f"Direction: {c['direction_deg']:.1f}°, "
                   f"Confidence: {c['confidence']:.2f}, "
                   f"Status: '{c['status']}'")
        motion_calc_ok = (c["status"] == "candidate" and 0.0 <= c["confidence"] <= 1.0)

    log_test("TC-11", "Proper-Motion Vector, Angular Speed & Confidence Scoring", motion_calc_ok, details)
except Exception as e:
    log_test("TC-11", "Proper-Motion Calculations", False, str(e))

# -----------------------------------------------------------------------------
# TASK 12: Missing-Data & Edge Case Handling
# -----------------------------------------------------------------------------
print("\n--- Task 12: Missing Data & Edge Case Auditing ---")

# 12a: Coordinates with no archive coverage
try:
    r_empty = requests.get("http://localhost:8000/api/observations?ra=0.0001&dec=0.0001&radius=0.01", timeout=15)
    data = r_empty.json()
    empty_ok = (r_empty.status_code == 200 and data.get("total") == 0 and data.get("warning") is not None)
    log_test("TC-12a", "Graceful Handling of Coordinates with No Observations", empty_ok,
             f"Total: {data.get('total')}, Notice: {data.get('warning')[:60]}...")
except Exception as e:
    log_test("TC-12a", "Graceful Handling of Empty Coordinates", False, str(e))

# 12b: Coordinate validation (out-of-bounds RA)
try:
    r_invalid = requests.get("http://localhost:8000/api/observations?ra=450.0&dec=0.0", timeout=5)
    val_ok = (r_invalid.status_code == 422) # FastAPI validation error
    log_test("TC-12b", "Input Validation on Out-of-Bounds RA (>360°)", val_ok, f"HTTP status: {r_invalid.status_code}")
except Exception as e:
    log_test("TC-12b", "Input Validation on RA", False, str(e))

# 12c: Missing image payloads on /api/process-image
try:
    r_corrupt = requests.post("http://localhost:8000/api/process-image", json={"image_base64": ""}, timeout=5)
    corrupt_ok = (r_corrupt.status_code == 400)
    log_test("TC-12c", "Rejection of Empty Image Payload (400 Bad Request)", corrupt_ok, f"HTTP status: {r_corrupt.status_code}")
except Exception as e:
    log_test("TC-12c", "Rejection of Empty Image", False, str(e))

# -----------------------------------------------------------------------------
# TASK 13: Sample Data Provenance & Ethical Disclosures
# -----------------------------------------------------------------------------
print("\n--- Task 13: Data Provenance & Ethical Disclosures ---")

try:
    r_obs = requests.get("http://localhost:8000/api/observations?ra=269.4521&dec=4.6933", timeout=5)
    data_obs = r_obs.json()
    source_tag = data_obs.get("dataset_source", "")
    has_disclosure = "Reference" in source_tag or "Simulation" in source_tag or "Official" in source_tag

    r_motion = requests.get("http://localhost:8000/api/candidates", timeout=5)
    cands = r_motion.json()
    all_candidates_unconfirmed = all(c.get("status", "candidate") == "candidate" or not c.get("verified") for c in cands)

    log_test("TC-13", "Transparent Data Provenance & Ethics Disclosures", has_disclosure and all_candidates_unconfirmed,
             f"Dataset Source: '{source_tag}', Ethical Candidate Verification Policy Active")
except Exception as e:
    log_test("TC-13", "Sample Data Provenance", False, str(e))

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
print("\n" + "=" * 80)
print(f"AUDIT SUMMARY: {len(results['passed'])} PASSED, {len(results['failed'])} FAILED")
print("=" * 80)

with open(Path(__file__).parent.parent / "documentation" / "qa_validation_results.json", "w") as f:
    json.dump(results, f, indent=2)

