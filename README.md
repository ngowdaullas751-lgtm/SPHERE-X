# COSMIC LENS – NASA SPHEREx Sky Explorer

<p align="center">
  <strong>"Explore the Changing Universe. Discover What Others Cannot See."</strong><br>
  <em>A full-stack astronomical discovery platform powered by NASA SPHEREx observations. Built for the NASA Space Apps Challenge.</em>
</p>

---

## 🚀 Mission Overview

On **March 11, 2025**, NASA launched the **SPHEREx** (Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer) space telescope into Sun-synchronous low Earth orbit. SPHEREx maps the entire celestial sphere every six months in **102 distinct near-infrared spectral channels** (0.75 – 5.00 µm).

**COSMIC LENS** is an interactive, scientific discovery dashboard connecting citizen scientists, researchers, and space enthusiasts to official NASA/IPAC IRSA SPHEREx survey data. It enables users to navigate sky coordinates, compare astronomical images chronologically, perform image subtraction, detect high proper-motion celestial bodies, explore 102-band spectra, and analyze time-domain light curves.

---

## 🌟 Key Features

| Section | Route | Description |
|---------|-------|-------------|
| 🌌 **Home Page** | `/` | Mission introduction, feature guide, and cosmic navigation |
| 🔭 **Sky Explorer** | `/explorer` | Coordinate-based IRSA search, interactive **Aladin Lite v3** sky map, target presets, and multi-epoch FITS cutouts |
| ⏰ **Cosmic Time Machine** | `/timemachine` | Multi-epoch chronological playback, interactive timeline, speed controls (0.5x–4x), **Blink Comparator**, and side-by-side mode |
| 🌠 **Motion Detector** | `/motion` | Sub-pixel point-source astrometry via **DAOStarFinder**, motion vector canvas overlay, velocity & direction calculation, and candidate ranking |
| 🔬 **Diff Lab** | `/difflab` | Multi-epoch flux subtraction, **RdBu diverging heatmaps**, contrast/brightness adjustment, and statistical significance analysis |
| 📊 **102-Band Spectrum** | `/spectrum` | High-precision **Plotly.js** SED charts spanning all 6 LVF arrays (0.75–5.0 µm) with error bars and molecular absorption diagnostics (H₂O, CH₄, CO, CO₂) |
| 💡 **Brightness Analyzer** | `/brightness` | Time-domain aperture photometry, interactive light curves, linear flux and magnitude scales, and variability indices |
| 🏆 **Discovery Hub** | `/discovery` | Community-driven citizen science registry, candidate dossier inspection, voting consensus workflow, and candidate submission modal |
| ℹ️ **About Page** | `/about` | SPHEREx mission science, 102-band instrument architecture, documented NASA/IPAC IRSA endpoints, and research references |

---

## 🛠️ Technology Stack

### Frontend:
- **React 19** & **Vite 6**
- **Tailwind CSS v4** with a custom dark-navy space glassmorphism design system
- **Plotly.js** (`plotly.js-dist-min`) for high-performance interactive scientific charts
- **Aladin Lite v3** (CDS Strasbourg) for interactive all-sky astrometric map projection
- **Lucide React** astronomical and operational iconography
- **HTML5 Canvas** particle starfield with subtle glowing nebulae

### Backend:
- **Python 3.11+** with **FastAPI** & **Uvicorn**
- **Astropy** (FITS image reading, World Coordinate System [WCS] TAN transformations)
- **Photutils** (`DAOStarFinder` point-source detection, sigma-clipped background statistics)
- **SciPy & NumPy** (Gaussian kernel PSFs, asinh stretching, linear regression, array operations)
- **Matplotlib** (Astronomical diverging heatmaps and colormapping)
- **Requests & HTTPX** (NASA/IPAC IRSA TAP queries and data retrieval)

### NASA Data Integration:
- Official **NASA/IPAC Infrared Science Archive (IRSA)** TAP Service (`spherex.obscore`, `spherex.observation`, `spherex.artifact`)
- IRSA Simple Cone Search (SCS) and Cutouts API
- Predefined NASA test targets calibrated with **Gaia DR3** and **AllWISE** reference standards:
  1. **Barnard's Star** (High proper motion star, ~10.3 arcsec/yr)
  2. **WISE J085510.83-071442.5** (Substellar Y-dwarf, ~250 K)
  3. **Epsilon Indi B** (Binary T-dwarf companion with methane bands)
  4. **RW Aurigae** (Classical T Tauri star showing circumstellar occultations)
  5. **R Draconis** (Mira-type pulsating red giant)

---

## ⚡ Quick Start

### 1. Prerequisites
- **Python 3.11+**
- **Node.js v20+** and **npm**

### 2. Start the Backend API Server
```bash
cd backend

# Install Python requirements
pip install -r requirements.txt

# Start FastAPI server on port 8000
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- API Base: `http://localhost:8000`
- Interactive Swagger UI: `http://localhost:8000/docs`
- ReDoc Documentation: `http://localhost:8000/redoc`

### 3. Start the React Frontend Application
```bash
cd frontend

# Install Node modules
npm.cmd install

# Start Vite dev server on port 5173
npm.cmd run dev -- --host 0.0.0.0 --port 5173
```
- Web Application: `http://localhost:5173`

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Service health status and NASA IRSA connectivity check |
| `GET` | `/api/observations` | Search multi-epoch SPHEREx observations near RA/Dec coordinates |
| `GET` | `/api/cutout` | Retrieve calibrated FITS image cutout and WCS metadata |
| `GET` | `/api/targets` | Curated NASA Space Apps test targets |
| `GET` | `/api/spectrum` | 102-channel spectrophotometric energy distribution (0.75–5.0 µm) |
| `GET` | `/api/light-curve` | Multi-epoch time-series photometry |
| `POST` | `/api/process-image` | Normalize and detect point sources in an uploaded astronomical image |
| `POST` | `/api/compare-images` | Multi-epoch image subtraction and RdBu difference heatmap generation |
| `POST` | `/api/detect-motion` | DAOStarFinder inter-epoch matching and proper-motion vector calculation |
| `GET` | `/api/candidates` | List community citizen science candidates |
| `POST` | `/api/candidates` | Submit an astronomical candidate for peer review |
| `POST` | `/api/candidates/{id}/vote` | Cast a community verification review vote |

---

## 🔬 Scientific Ethics & Integrity

1. **Strict Candidate Classification**: Every moving or transient anomaly flagged by the detection algorithms is clearly designated as an **unverified candidate**. Independent verification, orbital determination, and peer review are required before any scientific claim.
2. **Honest Archive Disclosures**: Early release survey availability is communicated with transparent warnings and direct links to the official NASA IRSA portal.
3. **Reproducible Astrometry**: All coordinate transformations adhere to standard FITS WCS conventions with TAN projections and astrometric provenance.

---

## 📜 License & Acknowledgments

Created for the **NASA Space Apps Challenge**. All NASA observations accessed under NASA's open data policy via the NASA/IPAC Infrared Science Archive (IRSA), operated by JPL and Caltech.
