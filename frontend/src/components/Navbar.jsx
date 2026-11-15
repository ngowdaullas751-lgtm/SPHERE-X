import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X, Telescope } from 'lucide-react';
import CosmicLogo from './CosmicLogo';

const NAV_LINKS = [
  { to: '/', label: 'Home', exact: true },
  { to: '/explorer', label: 'Sky Explorer' },
  { to: '/timemachine', label: 'Time Machine' },
  { to: '/blink', label: 'Blink' },
  { to: '/motion', label: 'Motion' },
  { to: '/difflab', label: 'Diff Lab' },
  { to: '/spectrum', label: 'Spectrum' },
  { to: '/brightness', label: 'Brightness' },
  { to: '/discovery', label: 'Discovery' },
  { to: '/about', label: 'About' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <CosmicLogo size={36} showText={false} />
            <span
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: '#00d4ff',
                textShadow: '0 0 15px #00d4ff66',
                letterSpacing: '2px',
              }}
            >
              COSMIC LENS
            </span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }} className="hidden md:flex">
            {NAV_LINKS.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.exact}
                style={({ isActive }) => ({
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s',
                  color: isActive ? '#00d4ff' : '#94a3b8',
                  borderBottom: isActive ? '2px solid #00d4ff' : '2px solid transparent',
                  textShadow: isActive ? '0 0 10px #00d4ff66' : 'none',
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              color: '#00d4ff',
              cursor: 'pointer',
            }}
            className="md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav
            style={{
              paddingBottom: '1rem',
              borderTop: '1px solid rgba(0, 212, 255, 0.1)',
              marginTop: '0.5rem',
            }}
            className="md:hidden"
          >
            {NAV_LINKS.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.exact}
                onClick={() => setMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '10px 16px',
                  margin: '4px 0',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: isActive ? '#00d4ff' : '#94a3b8',
                  background: isActive ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                  borderLeft: isActive ? '3px solid #00d4ff' : '3px solid transparent',
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
