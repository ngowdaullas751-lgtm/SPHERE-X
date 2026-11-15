# COSMIC LENS — Testing & Verification Guide

## 1. Environment Verification

```bash
# Verify Python environment
python --version   # Python 3.11+
python -c "import fastapi, uvicorn, astropy, photutils, numpy, scipy, matplotlib, PIL; print('All Backend Packages OK')"

# Verify Node.js & npm
node --version     # v20+
npm.cmd --version
```

---

## 2. Server Execution

Both the backend and frontend development servers are configured to run locally:

```bash
# Terminal 1: FastAPI Backend
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: React + Vite Frontend
cd frontend
npm.cmd run dev -- --host 0.0.0.0 --port 5173
```

- **Frontend Application:** [http://localhost:5173](http://localhost:5173)
- **FastAPI Backend:** [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc API Reference:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 3. Automated API Endpoint Tests

### 3.1. System Health Check
```bash
curl http://localhost:8000/api/health
# Expected: {"status":"ok","version":"1.0.0","nasa_archive_connected":true,...}
```

### 3.2. Curated NASA Target Retrieval
```bash
curl http://localhost:8000/api/targets
# Expected: 5 targets including Barnard's Star, WISE 0855, Epsilon Indi B, RW Aurigae, R Draconis
```

### 3.3. Multi-Epoch Observation Query (Barnard's Star)
```bash
curl "http://localhost:8000/api/observations?ra=269.4521&dec=4.6933&radius=0.25"
# Expected: observations array with multi-epoch observations, image_base64, and WCS calibration metadata
```

### 3.4. 102-Band Infrared Spectrum Query (WISE 0855)
```bash
curl "http://localhost:8000/api/spectrum?ra=133.7930&dec=-7.2451"
# Expected: 102 wavelength channels (0.75-5.00 µm), fluxes, errors, and LVF bands
```

### 3.5. Multi-Epoch Photometry Light Curve (RW Aurigae)
```bash
curl "http://localhost:8000/api/light-curve?ra=75.7954&dec=30.4013"
# Expected: 9 survey epochs showing episodic dimming events
```

### 3.6. Difference Image Generation (POST)
```bash
curl -X POST http://localhost:8000/api/compare-images \
  -H "Content-Type: application/json" \
  -d '{"image1_b64": "<base64_img1>", "image2_b64": "<base64_img2>"}'
# Expected: diff_b64, heatmap_b64, and stats (mean_diff, std_diff, changed_pixels)
```

### 3.7. Astrometric Motion Detection (POST)
```bash
curl -X POST http://localhost:8000/api/detect-motion \
  -H "Content-Type: application/json" \
  -d '{
    "image1_b64": "<base64_epoch1>",
    "image2_b64": "<base64_epoch2>",
    "date1": "2025-04-15",
    "date2": "2025-10-20",
    "pixel_scale_arcsec": 1.0
  }'
# Expected: candidates list with displacement_arcsec, speed_arcsec_per_year, direction_deg, confidence
```

---

## 4. Frontend Production Build Check

```bash
cd frontend
npm.cmd run build
# Expected: Clean build with 0 errors producing dist/ assets
```

---

## 5. End-to-End Workflow Verification Matrix

| Page / Feature | Expected Behavior | Status |
|----------------|-------------------|--------|
| **Home Page** (`/`) | Hero section, animated lens logo, SPHEREx intro, feature navigation | Verified |
| **Sky Explorer** (`/explorer`) | Coordinate search, interactive Aladin Lite v3 sky map, target presets, FITS cards | Verified |
| **Time Machine** (`/timemachine`) | Chronological playback, timeline slider, speed presets, blink comparator, side-by-side mode | Verified |
| **Motion Detector** (`/motion`) | Astrometric vector canvas overlay, proper-motion candidates, speed/direction, review submission | Verified |
| **Diff Lab** (`/difflab`) | Epoch subtraction, RdBu diverging heatmap, contrast/brightness sliders, statistical significance | Verified |
| **102-Band Spectrum** (`/spectrum`) | Interactive Plotly.js chart, 6 LVF array filters, 1-σ error bars, molecular absorption diagnostics | Verified |
| **Brightness Analyzer** (`/brightness`) | Aperture photometry light curve, linear/magnitude scale, variability index, survey visits | Verified |
| **Discovery Hub** (`/discovery`) | Citizen science registry, category filters, human voting workflow, candidate creation modal | Verified |
| **About Page** (`/about`) | Mission science objectives, 102-channel LVF architecture, IRSA links, ethics disclosure | Verified |
