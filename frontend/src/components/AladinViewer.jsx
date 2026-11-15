import { useEffect, useRef, useState } from 'react';
import { Layers, ZoomIn, ZoomOut, Compass, RefreshCw, Eye, AlertCircle, Sparkles } from 'lucide-react';

function formatRA(ra) {
  const h = Math.floor(ra / 15);
  const m = Math.floor((ra / 15 - h) * 60);
  const s = ((ra / 15 - h) * 60 - m) * 60;
  return `${h}h ${m}m ${s.toFixed(2)}s`;
}

function formatDec(dec) {
  const sign = dec >= 0 ? '+' : '-';
  const abs = Math.abs(dec);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d) * 60 - m) * 60;
  return `${sign}${d}° ${m}' ${s.toFixed(1)}"`;
}

export default function AladinViewer({
  ra = 133.795129,
  dec = -7.245147,
  fov = 0.15,
  onCoordsChange,
  cutoutPreview = null,
  obsMetadata = null,
}) {
  const containerRef = useRef(null);
  const aladinInstanceRef = useRef(null);
  const [currentSurvey, setCurrentSurvey] = useState('P/allWISE/color');
  const [currentFov, setCurrentFov] = useState(fov);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Initializing Astronomical Sky Map…');

  const SURVEYS = [
    { id: 'P/allWISE/color', name: 'AllWISE (Infrared)' },
    { id: 'P/2MASS/color', name: '2MASS (Near-IR JHK)' },
    { id: 'P/DSS2/color', name: 'DSS2 (Optical Color)' },
    { id: 'P/SDSS9/color', name: 'SDSS9 (Optical)' },
  ];

  const initAladin = () => {
    setLoading(true);
    setOfflineFallback(false);
    setStatusMsg('Connecting to Astronomical Sky View…');

    let attempts = 0;
    const maxAttempts = 15;

    const checkAndInit = () => {
      attempts++;
      const A = window.A || window.aladin;

      if (A && containerRef.current) {
        try {
          containerRef.current.innerHTML = '';
          const createInstance = () => {
            const aladin = A.aladin(containerRef.current, {
              survey: currentSurvey,
              fov: currentFov,
              target: `${ra} ${dec}`,
              showReticle: true,
              showZoomControl: false,
              showFullscreenControl: false,
              showLayersControl: false,
              showGotoControl: false,
              showFrame: false,
            });
            aladinInstanceRef.current = aladin;
            setReady(true);
            setLoading(false);
            setOfflineFallback(false);
            setStatusMsg('');

            if (aladin && typeof aladin.on === 'function') {
              aladin.on('positionChanged', (data) => {
                if (data && onCoordsChange) {
                  onCoordsChange(data.ra, data.dec);
                }
              });
            }
          };

          if (A.init && typeof A.init.then === 'function') {
            A.init.then(createInstance).catch(() => createInstance());
          } else {
            createInstance();
          }
        } catch (err) {
          console.warn('Aladin Lite initialization warning:', err);
          setReady(false);
          setLoading(false);
          setOfflineFallback(true);
          setStatusMsg('External CDN unavailable (Offline astrometric mode active)');
        }
      } else if (attempts < maxAttempts) {
        setTimeout(checkAndInit, 300);
      } else {
        setReady(false);
        setLoading(false);
        setOfflineFallback(true);
        setStatusMsg('External CDN unreachable (Local Astrometric View Active)');
      }
    };

    checkAndInit();
  };

  useEffect(() => {
    initAladin();
  }, []);

  // Update position when ra or dec changes
  useEffect(() => {
    if (aladinInstanceRef.current && ready) {
      try {
        aladinInstanceRef.current.gotoRaDec(parseFloat(ra), parseFloat(dec));
      } catch (e) {
        console.debug('Aladin goto error:', e);
      }
    }
  }, [ra, dec, ready]);

  const handleSurveyChange = (surveyId) => {
    setCurrentSurvey(surveyId);
    if (aladinInstanceRef.current) {
      try {
        aladinInstanceRef.current.setImageSurvey(surveyId);
      } catch (e) {
        console.debug('Survey switch error:', e);
      }
    }
  };

  const handleZoom = (inOut) => {
    if (aladinInstanceRef.current) {
      try {
        if (inOut === 'in') {
          aladinInstanceRef.current.increaseZoom();
        } else {
          aladinInstanceRef.current.decreaseZoom();
        }
      } catch (e) {
        console.debug('Zoom error:', e);
      }
    }
  };

  const resetTarget = () => {
    if (aladinInstanceRef.current) {
      try {
        aladinInstanceRef.current.gotoRaDec(parseFloat(ra), parseFloat(dec));
        aladinInstanceRef.current.setFov(0.15);
      } catch (e) {
        console.debug('Reset error:', e);
      }
    }
  };

  return (
    <div style={{
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid rgba(0, 212, 255, 0.25)',
      background: '#040711',
      position: 'relative',
      boxShadow: '0 0 25px rgba(0, 212, 255, 0.08)',
    }}>
      {/* Top control bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '10px 14px',
        background: 'rgba(10, 15, 30, 0.85)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
        fontSize: '0.8rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00d4ff', fontFamily: 'Orbitron, sans-serif' }}>
          <Compass size={14} />
          <span>ASTRONOMICAL SKY VIEWER</span>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
            RA: {parseFloat(ra).toFixed(4)}° | Dec: {parseFloat(dec).toFixed(4)}°
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={13} style={{ color: '#a78bfa' }} />
          <select
            value={currentSurvey}
            onChange={(e) => handleSurveyChange(e.target.value)}
            disabled={offlineFallback}
            style={{
              background: 'rgba(5, 8, 16, 0.9)',
              color: '#00d4ff',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              outline: 'none',
              cursor: offlineFallback ? 'not-allowed' : 'pointer',
            }}
          >
            {SURVEYS.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <button
            onClick={() => handleZoom('in')}
            title="Zoom in"
            disabled={offlineFallback}
            style={{
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: '#00d4ff',
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: offlineFallback ? 'not-allowed' : 'pointer',
            }}
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => handleZoom('out')}
            title="Zoom out"
            disabled={offlineFallback}
            style={{
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: '#00d4ff',
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: offlineFallback ? 'not-allowed' : 'pointer',
            }}
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={offlineFallback ? initAladin : resetTarget}
            title={offlineFallback ? "Retry loading Aladin Lite" : "Center target"}
            style={{
              background: 'rgba(124, 58, 237, 0.15)',
              border: '1px solid rgba(124, 58, 237, 0.4)',
              color: '#a78bfa',
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            {offlineFallback && <span style={{ fontSize: '0.7rem' }}>Retry</span>}
          </button>
        </div>
      </div>

      {/* Aladin / Astrometric Canvas container */}
      <div
        id="aladin-lite-div"
        ref={containerRef}
        style={{
          width: '100%',
          height: '420px',
          minHeight: '380px',
          backgroundColor: '#03050c',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            color: '#64748b',
            background: 'radial-gradient(circle, rgba(10,15,30,0.92) 0%, rgba(5,8,16,0.96) 100%)',
            zIndex: 10,
          }}>
            <div className="animate-spin" style={{
              width: '28px',
              height: '28px',
              border: '2px solid rgba(0,212,255,0.2)',
              borderTopColor: '#00d4ff',
              borderRadius: '50%',
            }} />
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{statusMsg}</span>
          </div>
        )}

        {offlineFallback && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: 'radial-gradient(circle at 50% 50%, #080e1e 0%, #020409 100%)',
            color: '#cbd5e1',
          }}>
            {/* If cutoutPreview is available, display as background with crosshairs */}
            {cutoutPreview ? (
              <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={`data:image/png;base64,${cutoutPreview}`}
                  alt="Astrometric Preview"
                  style={{ maxHeight: '360px', maxWidth: '100%', objectFit: 'contain', opacity: 0.85 }}
                />
                {/* Target reticle crosshairs */}
                <div style={{
                  position: 'absolute',
                  width: '36px',
                  height: '36px',
                  border: '1.5px solid #00d4ff',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  boxShadow: '0 0 12px rgba(0,212,255,0.6)',
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(5,8,16,0.85)',
                  border: '1px solid rgba(0,212,255,0.3)',
                  fontSize: '0.72rem',
                  color: '#67e8f9',
                }}>
                  Calibrated FITS Target View ({parseFloat(ra).toFixed(4)}°, {parseFloat(dec).toFixed(4)}°)
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', maxWidth: '420px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto 12px',
                  borderRadius: '50%',
                  border: '2px solid rgba(0, 212, 255, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}>
                  <div style={{ width: '8px', height: '8px', background: '#00d4ff', borderRadius: '50%', boxShadow: '0 0 10px #00d4ff' }} />
                  <div style={{ position: 'absolute', width: '80px', height: '1px', background: 'rgba(0,212,255,0.3)' }} />
                  <div style={{ position: 'absolute', height: '80px', width: '1px', background: 'rgba(0,212,255,0.3)' }} />
                </div>
                <h4 style={{ fontFamily: 'Orbitron, sans-serif', color: '#00d4ff', fontSize: '0.95rem', marginBottom: '6px' }}>
                  Astrometric Celestial Coordinates
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '10px 0', fontSize: '0.8rem' }}>
                  <div style={{ padding: '8px', background: 'rgba(0,212,255,0.06)', borderRadius: '6px', border: '1px solid rgba(0,212,255,0.2)' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Right Ascension</span>
                    <strong style={{ color: '#e2e8f0' }}>{parseFloat(ra).toFixed(5)}°</strong>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{formatRA(parseFloat(ra))}</div>
                  </div>
                  <div style={{ padding: '8px', background: 'rgba(124,58,237,0.08)', borderRadius: '6px', border: '1px solid rgba(124,58,237,0.25)' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Declination</span>
                    <strong style={{ color: '#e2e8f0' }}>{parseFloat(dec).toFixed(5)}°</strong>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{formatDec(parseFloat(dec))}</div>
                  </div>
                </div>
                <p style={{ fontSize: '0.74rem', color: '#64748b', lineHeight: '1.4' }}>
                  Astrometric target locked. FITS cutouts and SPHEREx survey archives remain fully functional.
                </p>
                <button
                  onClick={initAladin}
                  style={{
                    marginTop: '12px',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: 'rgba(0,212,255,0.15)',
                    border: '1px solid rgba(0,212,255,0.4)',
                    color: '#00d4ff',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={12} /> Retry Connecting Aladin Sky CDN
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 14px',
        background: 'rgba(5, 8, 16, 0.9)',
        borderTop: '1px solid rgba(0, 212, 255, 0.1)',
        fontSize: '0.72rem',
        color: '#64748b',
      }}>
        <span>Interactive Astrometric Projection (ICRS / J2000)</span>
        <span style={{ color: '#00d4ff', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Eye size={11} /> Crosshair locked on target ({parseFloat(ra).toFixed(4)}°, {parseFloat(dec).toFixed(4)}°)
        </span>
      </div>
    </div>
  );
}
