# COSMIC LENS — NASA Data Sources & Archive Specification

## 1. Primary Archive: NASA/IPAC IRSA

All astronomical data in COSMIC LENS is sourced from the official **NASA/IPAC Infrared Science Archive (IRSA)** at the California Institute of Technology (Caltech/JPL).

**Archive Portal:** `https://irsa.ipac.caltech.edu`  
**SPHEREx Mission Reference:** `https://irsa.ipac.caltech.edu/Missions/spherex.html`  
**Official Archive Docs:** `https://caltech-ipac.github.io/spherex-archive-documentation/`  

---

## 2. Official IRSA TAP Tables (Verified Live)

COSMIC LENS queries the official IRSA Table Access Protocol (TAP) service compliant with IVOA standards.
The following SPHEREx tables are registered in the IRSA TAP schema:

| Table Name | Description | Key Query Columns |
|------------|-------------|-------------------|
| `spherex.obscore` | IVOA ObsCore observation metadata catalog | `obs_id`, `s_ra`, `s_dec`, `energy_bandpassname`, `t_min`, `t_max`, `access_url`, `dataproduct_type` |
| `spherex.observation` | High-level observation execution log | `obs_id`, `target_name`, `obs_time`, `pointing_ra`, `pointing_dec` |
| `spherex.plane` | Spectral image planes within data cubes | `plane_id`, `obs_id`, `channel_idx`, `central_wavelength` |
| `spherex.artifact` | Calibrated data products & FITS files | `artifact_id`, `uri`, `md5_checksum`, `file_format` |
| `spherex.provenance_input` | Pipeline calibration inputs & versions | `provenance_id`, `input_uri`, `calibration_level` |

### ObsCore ADQL Cone Search Example:
```sql
SELECT TOP 50 obs_id, s_ra, s_dec, energy_bandpassname, t_min, t_max, dataproduct_type, access_url
FROM spherex.obscore
WHERE CONTAINS(POINT('ICRS', s_ra, s_dec), CIRCLE('ICRS', 269.4521, 4.6933, 0.1)) = 1;
```

---

## 3. NASA Space Apps Challenge Test Targets

The following 5 primary science targets are curated with real coordinates and multi-epoch scientific data:

| Target | RA (J2000) | Dec (J2000) | Astronomical Classification | Scientific Significance |
|--------|------------|-------------|-----------------------------|-------------------------|
| **Barnard's Star** | `269.4521°` (17h 57m 48.5s) | `+04.6933°` (+04° 41' 36") | High Proper Motion Star (M4V) | Nearest single star to Sun; highest known proper motion (~10.3 arcsec/yr). |
| **WISE J085510.83-071442.5** | `133.7930°` (08h 55m 10.8s) | `-07.2451°` (-07° 14' 43") | Y-Dwarf (Substellar) | Coldest known brown dwarf (~250 K); fourth closest star system with 8.1 "/yr motion. |
| **Epsilon Indi B** | `330.8403°` (22h 03m 21.7s) | `-56.7872°` (-56° 47' 14") | Binary Brown Dwarf (T1+T6) | Nearby substellar laboratory displaying prominent methane (CH4) absorption. |
| **RW Aurigae** | `75.7954°` (05h 03m 10.9s) | `+30.4013°` (+30° 24' 05") | Classical T Tauri Variable | Young stellar system showing dramatic episodic dimming caused by circumstellar occultation. |
| **R Draconis** | `271.1783°` (18h 04m 42.8s) | `+68.0417°` (+68° 02' 30") | Mira-type Pulsating Giant | Asymptotic Giant Branch red giant with large infrared pulsation amplitude (period ~245 days). |

---

## 4. The 102 SPHEREx Spectral Channels

SPHEREx utilizes 6 Linear Variable Filter (LVF) detector focal planes:

1. **Array 1 (0.75 – 1.11 µm)**: Resolving power $R \approx 41$. Probes Paschen hydrogen series and near-infrared stellar continuum.
2. **Array 2 (1.11 – 1.64 µm)**: Resolving power $R \approx 41$. Covers atmospheric water ($1.4\ \mu\text{m}$) and methane ($1.66\ \mu\text{m}$).
3. **Array 3 (1.64 – 2.42 µm)**: Resolving power $R \approx 41$. Measures the deep $2.2\ \mu\text{m}$ methane and hydrogen Brackett series.
4. **Array 4 (2.42 – 3.82 µm)**: Resolving power $R \approx 35$. Critical window for the $3.05\ \mu\text{m}$ interstellar water ice absorption feature.
5. **Array 5 (3.82 – 4.42 µm)**: Resolving power $R \approx 110$. High-resolution mapping of carbon dioxide ($4.26\ \mu\text{m}$ $\text{CO}_2$) ice and gas.
6. **Array 6 (4.42 – 5.00 µm)**: Resolving power $R \approx 130$. High-resolution characterization of carbon monoxide ($4.67\ \mu\text{m}$ $\text{CO}$) in protoplanetary disks.

---

## 5. Auxiliary Catalogues & Tools

- **CDS Strasbourg Aladin Lite v3**: Interactive all-sky hierarchical progressive survey (HiPS) projection engine.
- **Astropy & Photutils**: Official Python packages for FITS file I/O, WCS projection coordinates, and DAOStarFinder source detection.
- **ESA Gaia DR3**: Parallax and proper-motion reference standards for astrometric calibration.
- **AllWISE**: Mid-infrared reference catalogues covering W1 ($3.4\ \mu\text{m}$) and W2 ($4.6\ \mu\text{m}$).
