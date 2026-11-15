import { Link } from 'react-router-dom';
import {
  Telescope, Clock, Zap, FlaskConical, BarChart2, Star, Search,
  ArrowRight, Satellite, Globe, Eye, ChevronRight
} from 'lucide-react';
import CosmicLogo from '../components/CosmicLogo';

const FEATURES = [
  {
    icon: <Telescope size={28} />,
    title: 'Sky Explorer',
    desc: 'Search any sky coordinate using real SPHEREx archive data from NASA/IPAC IRSA.',
    to: '/explorer',
    color: '#00d4ff',
  },
  {
    icon: <Clock size={28} />,
    title: 'Time Machine',
    desc: 'Animate observations across time and blink-compare multi-epoch images.',
    to: '/timemachine',
    color: '#7c3aed',
  },
  {
    icon: <Zap size={28} />,
    title: 'Motion Detector',
    desc: 'Automatically detect proper-motion candidates between observation epochs.',
    to: '/motion',
    color: '#06b6d4',
  },
  {
    icon: <FlaskConical size={28} />,
    title: 'Diff Lab',
    desc: 'Side-by-side image differencing with heatmap visualization of flux changes.',
    to: '/difflab',
    color: '#a78bfa',
  },
  {
    icon: <BarChart2 size={28} />,
    title: 'Spectrum Viewer',
    desc: 'Plot SPHEREx 102-band spectral energy distributions across 0.75–5 µm.',
    to: '/spectrum',
    color: '#00d4ff',
  },
  {
    icon: <Star size={28} />,
    title: 'Brightness Tracker',
    desc: 'Aperture photometry light curves revealing variability in sources.',
    to: '/brightness',
    color: '#f59e0b',
  },
  {
    icon: <Search size={28} />,
    title: 'Discovery Hub',
    desc: 'Review candidates flagged by motion/brightness algorithms. Human verification.',
    to: '/discovery',
    color: '#10b981',
  },
];

const STEPS = [
  { num: '01', title: 'Query NASA Archive', desc: 'Enter sky coordinates or select a predefined target. We query the official IRSA SPHEREx database in real time.' },
  { num: '02', title: 'Retrieve Real Data', desc: 'Multi-epoch FITS observations are fetched and processed server-side using astropy and photutils.' },
  { num: '03', title: 'Visualize & Analyze', desc: 'Compare epochs, detect motion, extract spectra, and build light curves from real SPHEREx photometry.' },
  { num: '04', title: 'Review Candidates', desc: 'Flag interesting objects for human review. All candidates require expert verification before any claim.' },
];

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* Hero */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '80px 1.5rem 3rem',
          position: 'relative',
        }}
      >
        {/* Animated gradient ring */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -60%)',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, rgba(124,58,237,0.04) 50%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', animation: 'float 6s ease-in-out infinite' }}>
            <CosmicLogo size={100} showText={false} />
          </div>

          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 'clamp(2rem, 6vw, 4rem)',
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: '1.5rem',
            background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #06b6d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            COSMIC LENS
          </div>

          <p style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.4rem)',
            color: '#e2e8f0',
            marginBottom: '1rem',
            fontWeight: 300,
            letterSpacing: '0.5px',
            lineHeight: 1.6,
          }}>
            Explore the Changing Universe.<br />
            <span style={{ color: '#00d4ff' }}>Discover What Others Cannot See.</span>
          </p>

          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '2.5rem', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
            A citizen science tool powered by real NASA SPHEREx mission data — the first all-sky spectrophotometric survey in the solar near-infrared.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/explorer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 32px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '1rem',
                textDecoration: 'none',
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: '1px',
                background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))',
                border: '1px solid #00d4ff88',
                color: '#00d4ff',
                boxShadow: '0 0 30px #00d4ff22',
                transition: 'all 0.3s',
              }}
            >
              <Telescope size={20} />
              Start Exploring
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/about"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 28px',
                borderRadius: '10px',
                fontWeight: 500,
                fontSize: '1rem',
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#94a3b8',
                transition: 'all 0.3s',
              }}
            >
              Learn More
            </Link>
          </div>

          {/* Mission badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '3rem',
            padding: '8px 20px',
            borderRadius: '999px',
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.2)',
            color: '#64748b',
            fontSize: '0.8rem',
          }}>
            <Satellite size={14} style={{ color: '#00d4ff' }} />
            Powered by NASA SPHEREx Mission · IRSA Archive · Real observational data
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '4rem 1.5rem', maxWidth: '1300px', margin: '0 auto' }}>
        <h2 style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 'clamp(1.5rem, 3vw, 2rem)',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '0.75rem',
          color: '#00d4ff',
          textShadow: '0 0 20px #00d4ff44',
        }}>
          Mission Capabilities
        </h2>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '3rem', fontSize: '0.95rem' }}>
          Seven specialized tools built on real NASA infrared survey data
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}>
          {FEATURES.map(f => (
            <Link
              key={f.to}
              to={f.to}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                padding: '1.75rem',
                borderRadius: '12px',
                background: 'rgba(10, 15, 30, 0.6)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${f.color}22`,
                transition: 'all 0.3s',
                height: '100%',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${f.color}66`;
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 8px 30px ${f.color}22`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = `${f.color}22`;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: `${f.color}18`,
                  border: `1px solid ${f.color}33`,
                  color: f.color,
                  marginBottom: '1.25rem',
                }}>
                  {f.icon}
                </div>
                <h3 style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: '#e2e8f0',
                  marginBottom: '0.5rem',
                  letterSpacing: '0.5px',
                }}>
                  {f.title}
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
                  {f.desc}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1rem', color: f.color, fontSize: '0.8rem', fontWeight: 600 }}>
                  Open <ChevronRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section style={{
        padding: '4rem 1.5rem',
        background: 'rgba(10, 15, 30, 0.4)',
        borderTop: '1px solid rgba(0,212,255,0.08)',
        borderBottom: '1px solid rgba(0,212,255,0.08)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: '0.75rem',
            color: '#00d4ff',
            textShadow: '0 0 20px #00d4ff44',
          }}>
            How It Works
          </h2>
          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '3rem', fontSize: '0.95rem' }}>
            Real data, real science — no simulations
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {STEPS.map(s => (
              <div key={s.num} style={{
                padding: '1.5rem',
                borderRadius: '12px',
                background: 'rgba(10, 15, 30, 0.6)',
                border: '1px solid rgba(0,212,255,0.12)',
              }}>
                <div style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '2rem',
                  fontWeight: 900,
                  color: 'rgba(0,212,255,0.3)',
                  marginBottom: '0.75rem',
                }}>
                  {s.num}
                </div>
                <h3 style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '0.5rem', fontSize: '1rem' }}>{s.title}</h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Info */}
      <section style={{ padding: '4rem 1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{
          padding: '2.5rem',
          borderRadius: '16px',
          background: 'rgba(10, 15, 30, 0.7)',
          border: '1px solid rgba(124,58,237,0.3)',
          boxShadow: '0 0 40px rgba(124,58,237,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
            <Globe size={28} style={{ color: '#7c3aed' }} />
            <h2 style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '1.3rem',
              fontWeight: 700,
              color: '#a78bfa',
              margin: 0,
            }}>
              About the NASA SPHEREx Mission
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Survey Coverage', value: 'All-Sky', sub: 'Full sky every ~6 months' },
              { label: 'Spectral Bands', value: '102', sub: 'Channels from 0.75–5.0 µm' },
              { label: 'Mission Duration', value: '2+ Years', sub: 'Launched Feb 2025' },
              { label: 'Spectral Resolution', value: 'R ~ 41–135', sub: 'Near-infrared' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '1.8rem',
                  fontWeight: 900,
                  color: '#00d4ff',
                  textShadow: '0 0 15px #00d4ff44',
                }}>
                  {stat.value}
                </div>
                <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem', marginTop: '0.25rem' }}>{stat.label}</div>
                <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{stat.sub}</div>
              </div>
            ))}
          </div>

          <p style={{ color: '#94a3b8', lineHeight: 1.7, fontSize: '0.9rem', margin: 0 }}>
            SPHEREx (Spectro-Photometer for the History of the Universe, Epoch of Reionization, and Ices Explorer) is NASA's
            newest space observatory. It performs the first all-sky near-infrared spectrophotometric survey, mapping more than
            450 million galaxies, 100 million stars, and over a million quasars. COSMIC LENS uses the publicly released
            SPHEREx archive data to let citizen scientists explore the infrared universe in unprecedented detail.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(0,212,255,0.1)',
        padding: '2rem 1.5rem',
        textAlign: 'center',
        color: '#475569',
        fontSize: '0.8rem',
      }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.9rem' }}>
            COSMIC LENS
          </span>
          {' '}— NASA SPHEREx Sky Explorer
        </div>
        <div>
          Data sourced from{' '}
          <a href="https://irsa.ipac.caltech.edu" target="_blank" rel="noopener noreferrer"
            style={{ color: '#7c3aed', textDecoration: 'none' }}>
            NASA/IPAC IRSA
          </a>
          {' '}· All candidates require expert verification · Not an official NASA product
        </div>
      </footer>
    </div>
  );
}
