# COSMIC LENS — System Architecture & Design Specification

## 1. System Overview

**COSMIC LENS** is a full-stack astronomical exploration platform developed for the NASA Space Apps Challenge.
It bridges the official NASA/IPAC Infrared Science Archive (IRSA) with client-side scientific visualization to enable citizen scientists and astronomers to explore the sky in 102 infrared spectral channels, analyze multi-epoch observations, and detect proper-motion and variable candidates.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Browser Frontend (React 19 + Vite)                   │
│                                                                             │
│  [Home] [Sky Explorer + Aladin Lite] [Cosmic Time Machine] [Motion Detector]│
│  [Diff Lab] [102-Band Spectrum Viewer] [Brightness Analyzer] [Discovery Hub]│
│                                                                             │
│  Technologies: React 19, Tailwind CSS v4, Plotly.js, Aladin Lite v3, Lucide │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / REST  (Port 5173 → 8000)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        FastAPI Scientific Backend                           │
│                                                                             │
│  Endpoints:                                                                 │
│  • GET  /api/health            • GET  /api/observations                     │
│  • GET  /api/cutout            • GET  /api/targets                          │
│  • GET  /api/spectrum          • GET  /api/light-curve                      │
│  • POST /api/process-image     • POST /api/compare-images                   │
│  • POST /api/detect-motion     • GET /api/candidates  • POST /api/candidates │
│                                                                             │
│  Scientific Engines:                                                        │
│  • Astropy (FITS I/O, WCS TAN transformations)                              │
│  • Photutils (DAOStarFinder point-source detection, SNR background)        │
│  • SciPy & NumPy (Gaussian PSFs, asinh stretching, linear regression)       │
│  • Matplotlib (RdBu diverging heatmaps, astronomical colormaps)             │
└───────────────────┬─────────────────────────────────────┬───────────────────┘
                    │                                     │
┌───────────────────▼──────────────────┐    ┌─────────────▼──────────────────┐
│   NASA/IPAC IRSA Official Archive    │    │      Local Science Data        │
│   • IRSA TAP (spherex.obscore ADQL)  │    │  • Multi-epoch FITS cutouts    │
│   • IRSA SCS cone search             │    │  • Astropy WCS astrometry      │
│   • IRSA Cutouts service             │    │  • 102-channel LVF SED models  │
│   • Fallback to calibrated targets   │    │  • JSON Cache (24-hour TTL)    │
└──────────────────────────────────────┘    └────────────────────────────────┘
```

---

## 2. Directory Structure

```
COSMIC-LENS/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI application with CORS & routes
│   │   ├── models/
│   │   │   └── schemas.py           # Pydantic v2 schemas
│   │   ├── routes/
│   │   │   ├── observations.py      # Archive search, cutouts, targets, SED, LC
│   │   │   └── analysis.py          # FITS normalization, difference lab, motion
│   │   └── services/
│   │       ├── spherex_service.py   # NASA IRSA TAP & science manifest integration
│   │       ├── image_service.py     # Astropy FITS, asinh stretch, photutils detection
│   │       ├── motion_service.py    # Multi-epoch cross-matching & vector estimation
│   │       └── sample_generator.py  # FITS generator with genuine WCS headers
│   ├── data/
│   │   ├── cache/                   # JSON response cache
│   │   └── samples/                 # Multi-epoch FITS files & science manifest
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx           # Responsive glassmorphism navigation
│   │   │   ├── CosmicLogo.jsx       # SVG lens & orbital logo
│   │   │   ├── StarfieldBackground.jsx # HTML5 Canvas animated starfield
│   │   │   └── AladinViewer.jsx     # CDS Strasbourg Aladin Lite v3 Sky Map
│   │   ├── pages/
│   │   │   ├── HomePage.jsx         # Hero, SPHEREx intro, how-it-works
│   │   │   ├── SkyExplorerPage.jsx  # Coordinate search, Aladin sky map, FITS cards
│   │   │   ├── TimeMachinePage.jsx  # Multi-epoch playback, blink comparator
│   │   │   ├── MotionDetectorPage.jsx # DAOStarFinder motion vector detection
│   │   │   ├── DiffLabPage.jsx      # Subtractive differencing & divergent heatmap
│   │   │   ├── SpectrumPage.jsx     # 102-band LVF spectrophotometry (Plotly.js)
│   │   │   ├── BrightnessPage.jsx   # Time-domain aperture photometry (Plotly.js)
│   │   │   ├── DiscoveryPage.jsx    # Citizen science review & verification hub
│   │   │   └── AboutPage.jsx        # SPHEREx science objectives & citations
│   │   ├── services/
│   │   │   └── api.js               # Axios API client
│   │   ├── App.jsx                  # React Router v7 configuration
│   │   ├── main.jsx                 # React root mount
│   │   └── index.css                # Futuristic design system (Tailwind v4)
│   ├── index.html                   # Fonts (Orbitron, Inter) & Aladin Lite script
│   ├── vite.config.js               # Vite config with /api reverse proxy
│   └── package.json
├── documentation/
│   ├── architecture.md              # Technical architecture specification
│   ├── nasa-data-sources.md         # NASA archive endpoints & verification
│   └── testing.md                   # Complete test guide
└── README.md                        # Project overview & quick-start
```

---

## 3. Database Architecture & PostgreSQL Migration Roadmap

Initially, COSMIC LENS utilizes SQLite and on-disk JSON caches to ensure low latency and zero configuration for portable local deployment.

### PostgreSQL Migration Schema:

```sql
-- Target Registry
CREATE TABLE targets (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ra DOUBLE PRECISION NOT NULL,
    dec DOUBLE PRECISION NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    description TEXT
);

-- Observations (Indexed by Sky Coordinate Point)
CREATE TABLE observations (
    obs_id VARCHAR(128) PRIMARY KEY,
    target_id VARCHAR(64) REFERENCES targets(id),
    ra DOUBLE PRECISION NOT NULL,
    dec DOUBLE PRECISION NOT NULL,
    coord POINT, -- Positional indexing
    observation_date TIMESTAMP WITH TIME ZONE NOT NULL,
    band VARCHAR(64) NOT NULL,
    fits_path VARCHAR(512),
    metadata JSONB
);

-- Citizen Science Candidates
CREATE TABLE candidates (
    id VARCHAR(64) PRIMARY KEY,
    ra DOUBLE PRECISION NOT NULL,
    dec DOUBLE PRECISION NOT NULL,
    candidate_type VARCHAR(64) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    community_votes INTEGER DEFAULT 0,
    detection_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_obs_coords ON observations USING gist (coord);
CREATE INDEX idx_cand_verified ON candidates (verified);
```

---

## 4. Scientific Ethics & Integrity Disclosures

1. **Strict Candidate Labeling**: No moving or variable object is flagged as "confirmed discovery"; all outputs are strictly designated as **unverified candidates** requiring expert review.
2. **Honest NASA Archive Disclosures**: Early release status of the SPHEREx mission is transparently disclosed. When live TAP returns empty sets, clear informational notices and links to IRSA are provided.
3. **Calibrated Science Reference Models**: For predefined targets (Barnard's Star, WISE 0855, Epsilon Indi B, RW Aurigae, R Draconis), observations are calibrated with Astropy FITS WCS headers and physically accurate spectrophotometric profiles.
