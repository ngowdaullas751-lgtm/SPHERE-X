import {
  Satellite, Globe, Telescope, BookOpen, ShieldAlert,
  ExternalLink, Layers, Sparkles, CheckCircle2, Award
} from 'lucide-react';
import CosmicLogo from '../components/CosmicLogo';

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '4rem', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>

        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <CosmicLogo size={72} showText={false} />
          </div>
          <h1 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
            fontWeight: 800,
            color: '#00d4ff',
            textShadow: '0 0 25px rgba(0, 212, 255, 0.4)',
            marginBottom: '0.75rem',
          }}>
            About COSMIC LENS
          </h1>
          <p style={{
            fontSize: '1.05rem',
            color: '#94a3b8',
            maxWidth: '750px',
            margin: '0 auto',
            lineHeight: '1.6',
          }}>
            An interactive astronomical discovery platform developed for the NASA Space Apps Challenge,
            harnessing NASA SPHEREx multi-epoch spectrophotometric observations to map the changing infrared sky.
          </p>
        </div>

        {/* SPHEREx Mission Overview */}
        <div style={{
          background: 'rgba(10, 15, 30, 0.75)',
          borderRadius: '16px',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          padding: '2rem',
          marginBottom: '2rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#00d4ff', marginBottom: '1rem' }}>
            <Satellite size={22} />
            <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              The NASA SPHEREx Mission
            </h2>
          </div>
          <p style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
            <strong>SPHEREx</strong> (<em>Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer</em>)
            is a NASA Medium-Class Explorer (MIDEX) mission that successfully launched on <strong>March 11, 2025</strong>.
            Operating from a Sun-synchronous low Earth orbit, SPHEREx surveys the entire sky every six months in <strong>102 infrared spectral channels</strong> spanning 0.75 to 5.00 microns.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div style={{ background: 'rgba(5, 8, 16, 0.65)', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <h3 style={{ color: '#00d4ff', fontSize: '0.9rem', fontFamily: 'Orbitron, sans-serif', marginBottom: '6px' }}>
                1. Cosmic Inflation
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.5' }}>
                Maps hundreds of millions of galaxies in 3D across cosmic time to test non-Gaussianity and quantum fluctuations in the first fraction of a second after the Big Bang.
              </p>
            </div>

            <div style={{ background: 'rgba(5, 8, 16, 0.65)', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <h3 style={{ color: '#a78bfa', fontSize: '0.9rem', fontFamily: 'Orbitron, sans-serif', marginBottom: '6px' }}>
                2. Galaxy Formation History
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.5' }}>
                Measures the total Extragalactic Background Light (EBL) to trace the integrated star and galaxy light emitted since the Epoch of Reionization.
              </p>
            </div>

            <div style={{ background: 'rgba(5, 8, 16, 0.65)', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <h3 style={{ color: '#06b6d4', fontSize: '0.9rem', fontFamily: 'Orbitron, sans-serif', marginBottom: '6px' }}>
                3. Interstellar & Planetary Ices
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.5' }}>
                Surveys water (H2O), carbon dioxide (CO2), and carbon monoxide (CO) ices in thousands of dense molecular clouds and protoplanetary disks.
              </p>
            </div>
          </div>
        </div>

        {/* Scientific Processing Architecture */}
        <div style={{
          background: 'rgba(10, 15, 30, 0.75)',
          borderRadius: '16px',
          border: '1px solid rgba(124, 58, 237, 0.25)',
          padding: '2rem',
          marginBottom: '2rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#a78bfa', marginBottom: '1rem' }}>
            <Layers size={22} />
            <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              Scientific Processing Engine
            </h2>
          </div>
          <p style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
            COSMIC LENS couples real-time astronomical web architecture with server-side Python scientific pipelines:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              {
                step: '01',
                title: 'Astrometric Alignment & WCS Transformation',
                desc: 'FITS headers are parsed via Astropy WCS (World Coordinate System) using TAN projection models (CRVAL, CDELT, CRPIX) to establish sub-arcsecond astrometric coordinates.',
              },
              {
                step: '02',
                title: 'Point Source Detection via DAOStarFinder',
                desc: 'Point sources are detected using 2D Gaussian point spread function (PSF) kernel fitting with sigma-clipped background estimators from Photutils and SciPy.',
              },
              {
                step: '03',
                title: 'Inter-Epoch Matching & Astrometric Motion Vectors',
                desc: 'Source positions are cross-matched across time baselines using nearest-neighbor spatial algorithms. Displacements exceeding 3-sigma measurement noise generate calibrated proper-motion vectors.',
              },
              {
                step: '04',
                title: 'Subtractive Differencing & Divergence Mapping',
                desc: 'Consecutive epoch image matrices are flux-normalized and subtracted to produce pixel residual matrices, mapped to RdBu divergent heatmaps to reveal transients and variability.',
              },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: '1rem', background: 'rgba(5, 8, 16, 0.5)', padding: '1rem', borderRadius: '8px' }}>
                <span style={{ fontFamily: 'Orbitron, sans-serif', color: '#a78bfa', fontWeight: 800, fontSize: '1.1rem' }}>{s.step}</span>
                <div>
                  <h4 style={{ color: '#e2e8f0', fontSize: '0.9rem', marginBottom: '3px' }}>{s.title}</h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: '1.5' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NASA Data Sources & Citations */}
        <div style={{
          background: 'rgba(10, 15, 30, 0.75)',
          borderRadius: '16px',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          padding: '2rem',
          marginBottom: '2rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#00d4ff', marginBottom: '1rem' }}>
            <BookOpen size={22} />
            <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              Official NASA Data Endpoints & References
            </h2>
          </div>
          <p style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '0.92rem', marginBottom: '1.25rem' }}>
            All astronomical observations are queried through documented NASA/IPAC endpoints:
          </p>

          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            {[
              {
                name: 'NASA/IPAC Infrared Science Archive (IRSA) — SPHEREx Portal',
                url: 'https://irsa.ipac.caltech.edu/Missions/spherex.html',
                desc: 'Official archive repository for SPHEREx all-sky survey data products.',
              },
              {
                name: 'SPHEREx Archive Documentation (Caltech / IPAC)',
                url: 'https://caltech-ipac.github.io/spherex-archive-documentation/',
                desc: 'Technical specification for SPHEREx ObsCore, cutouts, and spectral cubes.',
              },
              {
                name: 'IRSA Cutout Tool & Image Delivery Service',
                url: 'https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html',
                desc: 'Position-based sub-image extraction service for astronomical surveys.',
              },
              {
                name: 'ESA Gaia Data Release 3 (DR3) & AllWISE Astrometric Catalogues',
                url: 'https://gea.esac.esa.int/archive/',
                desc: 'High-precision astrometric reference standards used for coordinate calibrations.',
              },
            ].map((link, idx) => (
              <li key={idx} style={{ background: 'rgba(5, 8, 16, 0.6)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#00d4ff', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {link.name} <ExternalLink size={12} />
                </a>
                <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '2px' }}>{link.desc}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Methodology & Limitations */}
        <div style={{
          background: 'rgba(10, 15, 30, 0.75)',
          borderRadius: '16px',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          padding: '2rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', marginBottom: '1rem' }}>
            <ShieldAlert size={22} />
            <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              Limitations & Citizen Science Integrity
            </h2>
          </div>
          <div style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '0.88rem' }}>
            <p style={{ marginBottom: '0.75rem' }}>
              <strong>Early Mission Phase:</strong> The SPHEREx mission launched March 11, 2025. Following on-orbit commissioning,
              public survey products enter progressive release at IRSA. When live TAP queries yield empty archives for arbitrary coordinates,
              COSMIC LENS provides transparent status disclosures and provides calibrated science reference datasets for test targets.
            </p>
            <p>
              <strong>Scientific Candidate Designation:</strong> All moving or variable sources detected through COSMIC LENS are strictly designated as <em>candidates</em>.
              No citizen science candidate is classified as a confirmed discovery without independent telescopic confirmation, astrometric orbit determination, and formal peer review.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

