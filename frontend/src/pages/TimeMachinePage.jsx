import { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Clock, Layers, AlertCircle,
  Eye, RefreshCw, ZoomIn, ZoomOut, Compass, Sparkles, MapPin, Star,
  Calendar, CheckCircle2, Download, ShieldAlert, Info
} from 'lucide-react';
import { fetchObservations, fetchCutout } from '../services/api';

const PREDEFINED_TARGETS = [
  { name: 'WISE 0855', ra: 133.795129, dec: -7.245147, type: 'Y-Dwarf (Official Test Target)', desc: 'Coldest brown dwarf (~250 K), ~8.1 arcsec/yr proper motion' },
  { name: "Barnard's Star", ra: 269.452075, dec: 4.693391, type: 'High Proper Motion Star', desc: 'Fastest known stellar proper motion (~10.3 arcsec/yr)' },
  { name: 'Epsilon Indi B', ra: 330.8403, dec: -56.7872, type: 'Brown Dwarf', desc: 'Binary T-dwarf companion with methane absorption' },
  { name: 'RW Aurigae', ra: 75.7954, dec: 30.4013, type: 'Variable Star', desc: 'T Tauri star occultation events' },
  { name: 'R Draconis', ra: 271.1783, dec: 68.0417, type: 'Mira Variable', desc: 'Long-period pulsating red giant' },
];

const SPEEDS = [
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1.0 },
  { label: '2x', value: 2.0 },
  { label: '4x', value: 4.0 },
];

export default function TimeMachinePage() {
  const [selectedTarget, setSelectedTarget] = useState(PREDEFINED_TARGETS[0]);
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [viewMode, setViewMode] = useState('single'); // 'single', 'blink', 'sideBySide'
  const [blinkEpoch, setBlinkEpoch] = useState(0); // 0 or 1
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // Client-side cutout image cache: { [obs_id]: { b64, metadata, loading, error } }
  const [imageCache, setImageCache] = useState({});

  const loadTargetObservations = async (target) => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setCurrentIdx(0);
    setImageCache({});

    try {
      const res = await fetchObservations(target.ra, target.dec, 0.05, 'spherex_dr1');
      const obs = res.data?.observations || [];

      // Sort observations strictly chronologically by observation date
      const sorted = [...obs].sort((a, b) => {
        const tA = new Date(a.date).getTime() || 0;
        const tB = new Date(b.date).getTime() || 0;
        return tA - tB;
      });

      setObservations(sorted);

      // Pre-seed imageCache with any cutouts already returned
      const initialCache = {};
      sorted.forEach((item) => {
        if (item.image_base64) {
          initialCache[item.obs_id] = {
            b64: item.image_base64,
            metadata: item.metadata || {},
            loading: false,
            error: null,
          };
        }
      });
      setImageCache(initialCache);

      if (sorted.length === 0) {
        setError('No observations found for this target in SPHEREx DR1.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load observations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTargetObservations(selectedTarget);
  }, [selectedTarget]);

  // Load cutout for an observation if not already cached
  const ensureCutoutLoaded = async (obs) => {
    if (!obs || !obs.obs_id) return;
    if (imageCache[obs.obs_id]?.b64 || imageCache[obs.obs_id]?.loading) return;

    setImageCache((prev) => ({
      ...prev,
      [obs.obs_id]: { ...(prev[obs.obs_id] || {}), loading: true, error: null },
    }));

    try {
      const res = await fetchCutout(selectedTarget.ra, selectedTarget.dec, 0.1, obs.access_url, obs.obs_id);
      if (res.data?.image_base64) {
        setImageCache((prev) => ({
          ...prev,
          [obs.obs_id]: {
            b64: res.data.image_base64,
            metadata: res.data.obs_metadata || {},
            wcs: res.data.wcs_info || {},
            fits_download_url: res.data.fits_download_url,
            loading: false,
            error: null,
          },
        }));
      } else {
        setImageCache((prev) => ({
          ...prev,
          [obs.obs_id]: {
            b64: null,
            loading: false,
            error: res.data?.warning || 'Cutout unavailable from IRSA',
          },
        }));
      }
    } catch (err) {
      setImageCache((prev) => ({
        ...prev,
        [obs.obs_id]: {
          b64: null,
          loading: false,
          error: err.response?.data?.detail || err.message || 'Failed to fetch FITS cutout',
        },
      }));
    }
  };

  // Whenever currentIdx changes, ensure current frame (and next 2 frames) are loaded
  useEffect(() => {
    if (observations.length === 0) return;
    const current = observations[currentIdx];
    if (current) ensureCutoutLoaded(current);

    // Preload next frames for smooth playback
    const next1 = observations[(currentIdx + 1) % observations.length];
    const next2 = observations[(currentIdx + 2) % observations.length];
    if (next1) ensureCutoutLoaded(next1);
    if (next2) ensureCutoutLoaded(next2);
  }, [currentIdx, observations]);

  // Preload second epoch for blink/sideBySide mode
  useEffect(() => {
    if (observations.length > 1 && (viewMode === 'blink' || viewMode === 'sideBySide')) {
      ensureCutoutLoaded(observations[0]);
      ensureCutoutLoaded(observations[Math.min(1, observations.length - 1)]);
    }
  }, [viewMode, observations]);

  // Animation playback loop
  useEffect(() => {
    if (!isPlaying || observations.length < 2) return;

    const intervalMs = Math.round(1000 / speed);
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % observations.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, observations.length, speed]);

  // Blink comparator mode loop
  useEffect(() => {
    if (viewMode !== 'blink' || observations.length < 2) return;

    const blinkRateMs = Math.round(400 / speed);
    const blinkTimer = setInterval(() => {
      setBlinkEpoch((prev) => (prev === 0 ? 1 : 0));
    }, blinkRateMs);

    return () => clearInterval(blinkTimer);
  }, [viewMode, observations.length, speed]);

  const currentObs = observations[currentIdx];
  const epoch1Obs = observations[0];
  const epoch2Obs = observations[Math.min(1, observations.length - 1)];

  const currentFrameData = currentObs ? imageCache[currentObs.obs_id] : null;
  const epoch1FrameData = epoch1Obs ? imageCache[epoch1Obs.obs_id] : null;
  const epoch2FrameData = epoch2Obs ? imageCache[epoch2Obs.obs_id] : null;

  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '3rem', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00d4ff', fontSize: '0.85rem', marginBottom: '4px' }}>
            <Clock size={16} />
            <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Multi-Epoch Chronological Survey Explorer</span>
          </div>
          <h1 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
            fontWeight: 700,
            color: '#a78bfa',
            textShadow: '0 0 20px rgba(124, 58, 237, 0.4)',
            marginBottom: '0.5rem',
          }}>
            Cosmic Time Machine
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '850px' }}>
            Inspect multi-epoch calibrated SPHEREx FITS observations across time.
            Step through visits chronologically, leverage blink comparison to reveal astronomical proper motion,
            and examine synchronized side-by-side epochs.
          </p>
        </div>

        {/* Predefined Targets */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Star size={13} style={{ color: '#f59e0b' }} /> Official NASA Targets (SPHEREx Survey Verified):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {PREDEFINED_TARGETS.map(t => {
              const active = selectedTarget.name === t.name;
              return (
                <button
                  key={t.name}
                  onClick={() => setSelectedTarget(t)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    background: active ? 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(0,212,255,0.25))' : 'rgba(10,15,30,0.8)',
                    border: active ? '1px solid #00d4ff' : '1px solid rgba(124,58,237,0.25)',
                    color: active ? '#00d4ff' : '#94a3b8',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <MapPin size={12} style={{ color: active ? '#00d4ff' : '#a78bfa' }} />
                  <span style={{ fontWeight: active ? 600 : 400 }}>{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Viewer Card */}
        <div style={{
          borderRadius: '16px',
          background: 'rgba(10, 15, 30, 0.85)',
          border: '1px solid rgba(124, 58, 237, 0.3)',
          padding: '1.5rem',
          boxShadow: '0 0 30px rgba(124, 58, 237, 0.12)',
        }}>

          {/* Top Bar: View Mode Selector + Zoom */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>View Mode:</span>
              <button
                onClick={() => setViewMode('single')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  background: viewMode === 'single' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                  border: viewMode === 'single' ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                  color: viewMode === 'single' ? '#00d4ff' : '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'single' ? 600 : 400,
                }}
              >
                Time Sequence
              </button>
              <button
                onClick={() => setViewMode('blink')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  background: viewMode === 'blink' ? 'rgba(124, 58, 237, 0.25)' : 'transparent',
                  border: viewMode === 'blink' ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                  color: viewMode === 'blink' ? '#a78bfa' : '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'blink' ? 600 : 400,
                }}
              >
                ⚡ Blink Comparator
              </button>
              <button
                onClick={() => setViewMode('sideBySide')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  background: viewMode === 'sideBySide' ? 'rgba(6, 182, 212, 0.25)' : 'transparent',
                  border: viewMode === 'sideBySide' ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.1)',
                  color: viewMode === 'sideBySide' ? '#06b6d4' : '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'sideBySide' ? 600 : 400,
                }}
              >
                Side-by-Side
              </button>
            </div>

            {/* Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Zoom: {Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel(z => Math.max(0.6, z - 0.2))}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                <ZoomOut size={13} />
              </button>
              <button
                onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.2))}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                <ZoomIn size={13} />
              </button>
              <button
                onClick={() => setZoomLevel(1.0)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          {/* Image Display Area */}
          <div style={{
            minHeight: '400px',
            background: '#020409',
            borderRadius: '12px',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            padding: '1.5rem',
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#64748b' }}>
                <div className="animate-spin" style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid rgba(124,58,237,0.2)',
                  borderTopColor: '#00d4ff',
                  borderRadius: '50%',
                  margin: '0 auto 12px',
                }} />
                <span style={{ color: '#00d4ff', fontSize: '0.9rem' }}>Searching NASA SPHEREx Archive for Multi-Epoch Visits…</span>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', color: '#fca5a5' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.8 }} />
                <span>{error}</span>
              </div>
            ) : observations.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b' }}>
                <Layers size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <span>No observation frames loaded</span>
              </div>
            ) : viewMode === 'sideBySide' ? (
              /* Side-by-Side Mode */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', width: '100%', maxWidth: '900px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.82rem', color: '#00d4ff', marginBottom: '8px', fontFamily: 'Orbitron, sans-serif' }}>
                    EPOCH 1: {epoch1Obs?.date}
                  </div>
                  <div style={{
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid rgba(0,212,255,0.35)',
                    background: '#000',
                    minHeight: '260px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: `scale(${zoomLevel})`,
                    transition: 'transform 0.2s ease',
                  }}>
                    {epoch1FrameData?.loading ? (
                      <div className="animate-spin" style={{ width: '24px', height: '24px', border: '2px solid #00d4ff', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    ) : epoch1FrameData?.b64 ? (
                      <img
                        src={`data:image/png;base64,${epoch1FrameData.b64}`}
                        alt="Epoch 1"
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Preview pending</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', fontFamily: 'monospace' }}>
                    {epoch1Obs?.obs_id} ({epoch1Obs?.band})
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.82rem', color: '#a78bfa', marginBottom: '8px', fontFamily: 'Orbitron, sans-serif' }}>
                    EPOCH 2: {epoch2Obs?.date}
                  </div>
                  <div style={{
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid rgba(124,58,237,0.35)',
                    background: '#000',
                    minHeight: '260px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: `scale(${zoomLevel})`,
                    transition: 'transform 0.2s ease',
                  }}>
                    {epoch2FrameData?.loading ? (
                      <div className="animate-spin" style={{ width: '24px', height: '24px', border: '2px solid #a78bfa', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    ) : epoch2FrameData?.b64 ? (
                      <img
                        src={`data:image/png;base64,${epoch2FrameData.b64}`}
                        alt="Epoch 2"
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Preview pending</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', fontFamily: 'monospace' }}>
                    {epoch2Obs?.obs_id} ({epoch2Obs?.band})
                  </div>
                </div>
              </div>
            ) : viewMode === 'blink' ? (
              /* Blink Comparator Mode */
              <div style={{ textAlign: 'center', width: '100%', maxWidth: '520px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  padding: '8px 14px',
                  background: blinkEpoch === 0 ? 'rgba(0,212,255,0.12)' : 'rgba(124,58,237,0.15)',
                  borderRadius: '8px',
                  border: blinkEpoch === 0 ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(124,58,237,0.3)',
                  transition: 'background 0.15s ease',
                }}>
                  <span style={{ fontSize: '0.82rem', color: blinkEpoch === 0 ? '#00d4ff' : '#c4b5fd', fontWeight: 600 }}>
                    BLINK: {blinkEpoch === 0 ? `Epoch 1 (${epoch1Obs?.date})` : `Epoch 2 (${epoch2Obs?.date})`}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Rate: {(400 / speed).toFixed(0)} ms</span>
                </div>
                <div style={{
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: blinkEpoch === 0 ? '2px solid #00d4ff' : '2px solid #a78bfa',
                  boxShadow: blinkEpoch === 0 ? '0 0 25px rgba(0,212,255,0.3)' : '0 0 25px rgba(124,58,237,0.3)',
                  background: '#000',
                  minHeight: '320px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${zoomLevel})`,
                  transition: 'transform 0.2s ease, border-color 0.1s ease',
                }}>
                  {blinkEpoch === 0 ? (
                    epoch1FrameData?.b64 ? (
                      <img src={`data:image/png;base64,${epoch1FrameData.b64}`} alt="Epoch 1 Blink" style={{ width: '100%', height: 'auto', display: 'block' }} />
                    ) : (
                      <span style={{ color: '#64748b' }}>Loading Epoch 1…</span>
                    )
                  ) : (
                    epoch2FrameData?.b64 ? (
                      <img src={`data:image/png;base64,${epoch2FrameData.b64}`} alt="Epoch 2 Blink" style={{ width: '100%', height: 'auto', display: 'block' }} />
                    ) : (
                      <span style={{ color: '#64748b' }}>Loading Epoch 2…</span>
                    )
                  )}
                </div>
              </div>
            ) : (
              /* Single Animated Sequence View */
              <div style={{ textAlign: 'center', width: '100%', maxWidth: '520px' }}>
                <div style={{
                  marginBottom: '10px',
                  fontSize: '0.84rem',
                  color: '#00d4ff',
                  fontFamily: 'Orbitron, sans-serif',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>FRAME {currentIdx + 1} OF {observations.length}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {currentObs?.date}
                  </span>
                </div>

                <div style={{
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid rgba(0,212,255,0.35)',
                  boxShadow: '0 0 25px rgba(0,212,255,0.15)',
                  background: '#000',
                  minHeight: '320px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transform: `scale(${zoomLevel})`,
                  transition: 'transform 0.2s ease',
                }}>
                  {currentFrameData?.loading ? (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                      <div className="animate-spin" style={{
                        width: '32px',
                        height: '32px',
                        border: '2px solid rgba(0,212,255,0.2)',
                        borderTopColor: '#00d4ff',
                        borderRadius: '50%',
                        margin: '0 auto 10px',
                      }} />
                      <span style={{ fontSize: '0.8rem', color: '#00d4ff' }}>Downloading FITS Cutout from NASA IRSA…</span>
                    </div>
                  ) : currentFrameData?.b64 ? (
                    <img
                      src={`data:image/png;base64,${currentFrameData.b64}`}
                      alt={currentObs?.obs_id}
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                  ) : currentFrameData?.error ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#fca5a5' }}>
                      <AlertCircle size={28} style={{ margin: '0 auto 8px', opacity: 0.8 }} />
                      <p style={{ fontSize: '0.82rem', marginBottom: '8px' }}>{currentFrameData.error}</p>
                      <button
                        onClick={() => ensureCutoutLoaded(currentObs)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '5px',
                          background: 'rgba(0,212,255,0.15)',
                          border: '1px solid rgba(0,212,255,0.3)',
                          color: '#00d4ff',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Retry Cutout Download
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => ensureCutoutLoaded(currentObs)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))',
                        border: '1px solid #00d4ff',
                        color: '#00d4ff',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                      }}
                    >
                      Load FITS Cutout for {currentObs?.obs_id}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8', marginTop: '10px' }}>
                  <span>Product: <strong style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{currentObs?.obs_id}</strong></span>
                  <span>Band: <strong style={{ color: '#67e8f9' }}>{currentObs?.band}</strong></span>
                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <CheckCircle2 size={12} /> Target Verified
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Timeline & Playback Controls Bar */}
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
              <input
                type="range"
                min="0"
                max={Math.max(0, observations.length - 1)}
                value={currentIdx}
                onChange={(e) => setCurrentIdx(parseInt(e.target.value, 10))}
                disabled={observations.length === 0}
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '4px',
                  accentColor: '#00d4ff',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '0.82rem', color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', minWidth: '75px', textAlign: 'right' }}>
                {observations.length > 0 ? `${currentIdx + 1} / ${observations.length}` : '0 / 0'}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              {/* Playback Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setCurrentIdx(0)}
                  disabled={observations.length === 0}
                  title="First epoch"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <SkipBack size={15} />
                </button>
                <button
                  onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                  disabled={observations.length === 0 || currentIdx === 0}
                  title="Previous epoch"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                >
                  Prev
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={observations.length < 2}
                  style={{
                    background: isPlaying ? 'rgba(239, 68, 68, 0.25)' : 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(124,58,237,0.3))',
                    border: isPlaying ? '1px solid #ef4444' : '1px solid #00d4ff',
                    borderRadius: '8px',
                    color: isPlaying ? '#fca5a5' : '#00d4ff',
                    padding: '8px 20px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isPlaying ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Play Time Sequence</>}
                </button>
                <button
                  onClick={() => setCurrentIdx((prev) => Math.min(observations.length - 1, prev + 1))}
                  disabled={observations.length === 0 || currentIdx === observations.length - 1}
                  title="Next epoch"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentIdx(observations.length - 1)}
                  disabled={observations.length === 0}
                  title="Latest epoch"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <SkipForward size={15} />
                </button>
              </div>

              {/* Speed Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Speed:</span>
                {SPEEDS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setSpeed(s.value)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      background: speed === s.value ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
                      border: speed === s.value ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                      color: speed === s.value ? '#00d4ff' : '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
