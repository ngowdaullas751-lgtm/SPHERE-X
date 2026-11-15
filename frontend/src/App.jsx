import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import StarfieldBackground from './components/StarfieldBackground';
import HomePage from './pages/HomePage';
import SkyExplorerPage from './pages/SkyExplorerPage';
import TimeMachinePage from './pages/TimeMachinePage';
import MotionDetectorPage from './pages/MotionDetectorPage';
import DiffLabPage from './pages/DiffLabPage';
import SpectrumPage from './pages/SpectrumPage';
import BrightnessPage from './pages/BrightnessPage';
import DiscoveryPage from './pages/DiscoveryPage';
import BlinkPage from './pages/BlinkPage';
import AboutPage from './pages/AboutPage';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ position: 'relative', minHeight: '100vh', backgroundColor: '#050810', color: '#ffffff' }}>
        {/* Subtle Canvas Starfield Animation */}
        <StarfieldBackground />

        {/* Global Navigation Header */}
        <Navbar />

        {/* Application Page Routing */}
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explorer" element={<SkyExplorerPage />} />
            <Route path="/timemachine" element={<TimeMachinePage />} />
            <Route path="/blink" element={<BlinkPage />} />
            <Route path="/motion" element={<MotionDetectorPage />} />
            <Route path="/difflab" element={<DiffLabPage />} />
            <Route path="/spectrum" element={<SpectrumPage />} />
            <Route path="/brightness" element={<BrightnessPage />} />
            <Route path="/discovery" element={<DiscoveryPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Global Footer */}
        <footer style={{
          borderTop: '1px solid rgba(0, 212, 255, 0.12)',
          background: 'rgba(5, 8, 16, 0.95)',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#64748b',
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: '#00d4ff', letterSpacing: '1px' }}>
                COSMIC LENS
              </span>
              <span>— NASA SPHEREx Sky Explorer</span>
            </div>
            <div>
              <span>Official NASA/IPAC Infrared Science Archive (IRSA) Integration</span>
            </div>
            <div>
              <span>NASA Space Apps Challenge Discovery Platform</span>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
