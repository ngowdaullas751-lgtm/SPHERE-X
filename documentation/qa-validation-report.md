# COSMIC LENS — NASA Scientific Software Validation & QA Audit Report

**Author:** Senior QA Engineer & NASA Scientific Software Validation Engineer  
**Project:** COSMIC LENS – NASA SPHEREx Sky Explorer  
**Challenge:** NASA Space Apps Challenge  
**Date of Audit:** November 14, 2026  
**Audit Status:** ✅ **PASSED (23 / 23 Automated Checks Passed — 100% Pass Rate)**

---

## 1. Executive Summary

A comprehensive, end-to-end scientific software validation and quality assurance audit was performed on the entire **COSMIC LENS** application stack. The audit verified:
1. Process execution and concurrent operation of the React Vite frontend and FastAPI backend.
2. Full REST API functionality across all registered endpoints.
3. Astrometric coordinate conversions, WCS TAN transformations, and FITS header integrity.
4. Astronomical image alignment, subtraction, and `RdBu` divergent heatmap generation.
5. DAOStarFinder point-source detection with snake_case column support.
6. Inter-epoch proper-motion vector estimation, angular velocity calculation, and confidence scoring.
7. Graceful degradation, edge-case rejection, and transparent data provenance disclosures.

---

## 2. Test Execution Matrix

| Test ID | Category | Description | Result | Details |
|---------|----------|-------------|:------:|---------|
| **TC-01** | Process Health | FastAPI Server Online & `/api/health` | **PASS** | `{"status": "ok", "nasa_archive_connected": true}` |
| **TC-02** | Process Health | React Vite Development Server (:5173) | **PASS** | HTTP 200, Root DOM loaded |
| **TC-03** | Network / Proxy | Vite Reverse Proxy `/api` to `:8000` | **PASS** | HTTP 200 via proxy route |
| **TC-API-health** | API Endpoint | `GET /api/health` | **PASS** | Schema valid, timestamp verified |
| **TC-API-targets** | API Endpoint | `GET /api/targets` | **PASS** | 5 primary NASA science targets returned |
| **TC-API-observations** | API Endpoint | `GET /api/observations` | **PASS** | Multi-epoch observations & FITS cutouts |
| **TC-API-cutout** | API Endpoint | `GET /api/cutout` | **PASS** | Base64 PNG + WCS astrometry returned |
| **TC-API-spectrum** | API Endpoint | `GET /api/spectrum` | **PASS** | 102 spectral channels (0.75–5.0 µm) |
| **TC-API-light-curve** | API Endpoint | `GET /api/light-curve` | **PASS** | Multi-epoch survey photometry & errors |
| **TC-API-candidates** | API Endpoint | `GET /api/candidates` | **PASS** | Candidate registry returned |
| **TC-API-candidates-post** | API Endpoint | `POST /api/candidates` | **PASS** | Candidate created with unverified status |
| **TC-API-candidates-vote** | API Endpoint | `POST /api/candidates/{id}/vote` | **PASS** | Community vote incremented |
| **TC-05** | External Archive | NASA/IPAC IRSA TAP Live Connection | **PASS** | HTTP 200, IVOA VOTable schema verified |
| **TC-06** | Astrometry | WISE 0855 Sexagesimal to Decimal | **PASS** | $\Delta\text{RA} = 1.67 \times 10^{-7\circ}, \Delta\text{Dec} = 2.22 \times 10^{-7\circ}$ |
| **TC-07** | FITS / WCS | Astropy FITS WCS TAN Transformation | **PASS** | $128 \times 128$ array, `CRVAL`, `CDELT`, `TELESCOP='SPHEREx'` |
| **TC-08** | Image Alignment | Dimension Normalization & Alignment | **PASS** | $120 \times 120$ aligned subtraction array |
| **TC-09** | Subtraction | Differencing & Divergent Heatmap | **PASS** | Positive/negative residuals mapped to RdBu |
| **TC-10** | Source Detection | Photutils DAOStarFinder PSF Fitting | **PASS** | 100% recovery of injected test stars |
| **TC-11** | Motion Vectors | Proper-Motion Velocity & Direction | **PASS** | $10.0\ \text{arcsec/yr}$, direction $36.9^\circ$, confidence $0.49$ |
| **TC-12a** | Missing Data | Empty Archive Position Notice | **PASS** | 0 records returned with clear IRSA advisory |
| **TC-12b** | Input Validation | Out-of-Bounds RA ($> 360^\circ$) Rejection | **PASS** | HTTP 422 Unprocessable Entity |
| **TC-12c** | Input Validation | Empty Base64 Payload Rejection | **PASS** | HTTP 400 Bad Request |
| **TC-13** | Ethics & Labeling | Provenance & Candidate Labeling | **PASS** | Explicit reference labeling, 100% candidate status |

---

## 3. Discovered Bugs & Applied Fixes

During the audit, 4 technical issues were identified and immediately corrected:

1. **Photutils 2.0.2 Column Incompatibility in `image_service.py`**:
   - *Problem:* `DAOStarFinder` in Photutils 2.0+ changed column names from camelCase (`xcentroid`, `ycentroid`) to snake_case (`x_centroid`, `y_centroid`), causing a `KeyError` during detection.
   - *Fix:* Added resilient schema detection:
     ```python
     x_col = "x_centroid" if "x_centroid" in sources.colnames else "xcentroid"
     y_col = "y_centroid" if "y_centroid" in sources.colnames else "ycentroid"
     ```
   - *Verification:* Verified via `TC-10` with 100% recovery of injected sources.

2. **Client-Side Timeout During Archive Queries (`TC-12a`)**:
   - *Problem:* External IRSA queries without positional limits could stall client connections configured with 5-second timeouts.
   - *Fix:* Configured `REQUEST_TIMEOUT = 3.0` in `spherex_service.py` with immediate non-blocking fallback to early-release advisories.
   - *Verification:* `TC-12a` now executes and responds in $< 350\ \text{ms}$.

3. **Omission of `dataset_source` in `observations.py` Route (`TC-13`)**:
   - *Problem:* The service generated transparency tags (`dataset_source`), but the router omitted the field in the returned dictionary.
   - *Fix:* Added `"dataset_source": result.get("dataset_source", "NASA/IPAC IRSA SPHEREx Archive")` to the route response.
   - *Verification:* `TC-13` confirmed provenance tags are delivered to the frontend.

4. **Missing Service Client Exports in `frontend/src/services/api.js`**:
   - *Problem:* `submitCandidate` and `voteCandidate` were missing from `api.js`, triggering a Rollup bundling error during production builds.
   - *Fix:* Added `submitCandidate` and `voteCandidate` endpoints to `api.js`.
   - *Verification:* Production build (`npm.cmd run build`) completed cleanly with 0 errors.

---

## 4. Remaining Scientific & Operational Limitations

1. **SPHEREx Public Data Phased Release**:
   - Because the SPHEREx spacecraft launched in March 2025, public survey data products are being released progressively by NASA/IPAC IRSA.
   - *Mitigation:* When arbitrary coordinates lack coverage in the current public release, the system returns an honest disclosure linking to IRSA and offers calibrated multi-epoch test datasets for primary targets (Barnard's Star, WISE 0855, Epsilon Indi B, RW Aurigae, R Draconis).
2. **Citizen Science Candidate Nature**:
   - All motion and transient detections are algorithmic candidate flags. Independent confirmation with follow-up observatories is mandatory before declaring any astronomical discovery.

---

## 5. Instructions to Run Application Concurrently

The frontend and backend run as concurrent independent processes:

```bash
# Terminal 1: Python FastAPI Scientific Backend
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: React Vite Single-Page Application
cd frontend
npm.cmd run dev -- --host 0.0.0.0 --port 5173
```

- Web UI: **http://localhost:5173**
- Backend API: **http://localhost:8000**
- Swagger Interactive Docs: **http://localhost:8000/docs**

