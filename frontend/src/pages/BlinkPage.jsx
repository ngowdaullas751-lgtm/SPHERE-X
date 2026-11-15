import { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, RefreshCw, Eye, EyeOff, ZoomIn, ZoomOut,
  Maximize2, Minimize2, Sliders, Layers, Sparkles, AlertCircle, Compass,
  MapPin, Calendar, CheckCircle2, Star, Activity, Download, ArrowUpRight,
  ShieldAlert, Info, ChevronRight, Gauge, Radio, SplitSquareVertical
} from 'lucide-react';
import {
  fetchObservations,
  fetchCutout,
  fetchGaiaStars,
  runShiftAndAdd,
  compareImages
} from '../services/api';

const PREDEFINED_TARGETS = [
  { name: 'WISE 0855', ra: 133.795129, dec: -7.245147, type: 'Y-Dwarf (Official Test Target)', desc: 'Coldest brown dwarf (~250 K), ~8.1 arcsec/yr proper motion' },
  { name: "Barnard's Star", ra: 269.452075, dec: 4.693391, type: 'High Proper Motion Star', desc: 'Fastest known stellar proper motion (~10.3 arcsec/yr)' },
  { name: 'Epsilon Indi B', ra: 330.8403, dec: -56.7872, type: 'Brown Dwarf Companion', desc: 'Binary T-dwarf companion (~4.7 arcsec/yr)' },
  { name: 'RW Aurigae', ra: 75.7954, dec: 30.4013, type: 'Variable Star', desc: 'T Tauri star occultation events' },
  { name: 'R Draconis', ra: 271.1783, dec: 68.0417, type: 'Mira Variable', desc: 'Long-period pulsating red giant' },
];

export default function BlinkPage() {
  // Target coordinates & Search
  const [selectedTarget, setSelectedTarget] = useState(PREDEFINED_TARGETS[0]);
  const [customRa, setCustomRa] = useState(PREDEFINED_TARGETS[0].ra.toString());
  const [customDec, setCustomDec] = useState(PREDEFINED_TARGETS[0].dec.toString());
  const [searchRadius, setSearchRadius] = useState(0.05);

  // Observations & Images
  const [observations, setObservations] = useState([]);
  const [selectedObsIds, setSelectedObsIds] = useState(new Set());
  const [imageCache, setImageCache] = useState({}); // { [obs_id]: { b64, metadata, loading } }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Blink Engine State
  const [currentLoopIdx, setCurrentLoopIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [blinkIntervalMs, setBlinkIntervalMs] = useState(500); // 500ms default
  const [timeWindowMode, setTimeWindowMode] = useState('all'); // 'all', 'early', 'late'

  // Image Visualization Controls
  const [invertImage, setInvertImage] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(120);
  const [stretchMode, setStretchMode] = useState('asinh'); // 'asinh', 'linear', 'log'
  const [showReticle, setShowReticle] = useState(true);
  const [showMotionTrack, setShowMotionTrack] = useState(true);

  // Gaia DR3 Overlay
  const [showGaia, setShowGaia] = useState(true);
  const [gaiaStars, setGaiaStars] = useState([]);
  const [gaiaLoading, setGaiaLoading] = useState(false);
  const [selectedGaiaStar, setSelectedGaiaStar] = useState(null);

  // Difference Imaging Overlay
  const [showDiffOverlay, setShowDiffOverlay] = useState(false);
  const [diffImageB64, setDiffImageB64] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Shift-and-Add Coaddition
  const [shiftAddActive, setShiftAddActive] = useState(false);
  const [shiftMotionRate, setShiftMotionRate] = useState(8.15); // arcsec/yr
  const [shiftPA, setShiftPA] = useState(128.0); // deg
  const [shiftResult, setShiftResult] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(false);

  // Viewport Zoom & Pan
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef(null);

  // Load observations from SPHEREx archive
  const loadTargetObservations = async (ra, dec, radius) => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setImageCache({});
    setDiffImageB64(null);
    setShiftResult(null);

    try {
      const res = await fetchObservations(ra, dec, radius, 'spherex_dr1');
      const obs = res.data?.observations || [];

      // Sort chronologically
      const sorted = [...obs].sort((a, b) => {
        const tA = new Date(a.date).getTime() || 0;
        const tB = new Date(b.date).getTime() || 0;
        return tA - tB;
      });

      setObservations(sorted);
      const allIds = new Set(sorted.map(o => o.obs_id));
      setSelectedObsIds(allIds);

      // Pre-seed imageCache with cutouts already present
      const initialCache = {};
      sorted.forEach((item) => {
        if (item.image_base64) {
          initialCache[item.obs_id] = {
            b64: item.image_base64,
            metadata: item.metadata || {},
            loading: false,
          };
        }
      });
      setImageCache(initialCache);

      if (sorted.length > 0) {
        setCurrentLoopIdx(0);
        setIsPlaying(true);
      } else {
        setError(`No SPHEREx DR1 observations found near coordinates (RA: ${ra}°, Dec: ${dec}°).`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to query archive observations.');
    } finally {
      setLoading(false);
    }
  };

  // Load Gaia DR3 catalog reference stars
  const loadGaiaCatalog = async (ra, dec, radius) => {
    setGaiaLoading(true);
    try {
      const res = await fetchGaiaStars(ra, dec, radius, 35);
      setGaiaStars(res.data?.sources || []);
    } catch (err) {
      console.warn('Gaia catalog load warning:', err);
    } finally {
      setGaiaLoading(false);
    }
  };

  // Trigger search on target change
  useEffect(() => {
    const ra = parseFloat(customRa);
    const dec = parseFloat(customDec);
    if (!isNaN(ra) && !isNaN(dec)) {
      loadTargetObservations(ra, dec, searchRadius);
      loadGaiaCatalog(ra, dec, searchRadius);
    }
  }, [selectedTarget]);

  // Filter observations based on time window
  const activeObservations = observations.filter((obs, idx) => {
    if (!selectedObsIds.has(obs.obs_id)) return false;
    if (timeWindowMode === 'early') return idx < Math.ceil(observations.length / 2);
    if (timeWindowMode === 'late') return idx >= Math.floor(observations.length / 2);
    return true;
  });

  // Ensure current frame cutout is loaded
  const currentObs = activeObservations[currentLoopIdx] || null;

  useEffect(() => {
    if (!currentObs) return;
    const obsId = currentObs.obs_id;
    if (imageCache[obsId]?.b64 || imageCache[obsId]?.loading) return;

    setImageCache(prev => ({
      ...prev,
      [obsId]: { ...(prev[obsId] || {}), loading: true }
    }));

    fetchCutout(
      parseFloat(customRa),
      parseFloat(customDec),
      0.1,
      currentObs.access_url,
      obsId
    ).then(res => {
      if (res.data?.image_base64) {
        setImageCache(prev => ({
          ...prev,
          [obsId]: {
            b64: res.data.image_base64,
            metadata: res.data.obs_metadata || {},
            wcs: res.data.wcs_info || {},
            loading: false,
          }
        }));
      }
    }).catch(err => {
      console.warn(`Cutout fetch error for ${obsId}:`, err);
      setImageCache(prev => ({
        ...prev,
        [obsId]: { ...(prev[obsId] || {}), loading: false, error: 'Unavailable' }
      }));
    });
  }, [currentObs, imageCache, customRa, customDec]);

  // Blink Engine Timer Loop
  useEffect(() => {
    if (!isPlaying || activeObservations.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentLoopIdx(prev => (prev + 1) % activeObservations.length);
    }, blinkIntervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, activeObservations.length, blinkIntervalMs]);

  // Toggle observation in/out of loop
  const toggleObsSelection = (obsId) => {
    setSelectedObsIds(prev => {
      const next = new Set(prev);
      if (next.has(obsId)) {
        if (next.size > 1) next.delete(obsId); // Keep at least one
      } else {
        next.add(obsId);
      }
      return next;
    });
  };

  // Run Difference Imaging against reference epoch (first observation)
  const computeDifferenceImage = async () => {
    if (activeObservations.length < 2) return;
    const obs1 = activeObservations[0];
    const obs2 = activeObservations[activeObservations.length - 1];

    const img1B64 = imageCache[obs1.obs_id]?.b64;
    const img2B64 = imageCache[obs2.obs_id]?.b64;

    if (!img1B64 || !img2B64) {
      alert('Please wait for cutouts of both epochs to finish loading before generating difference image.');
      return;
    }

    setDiffLoading(true);
    try {
      const res = await compareImages({ image1_b64: img1B64, image2_b64: img2B64 });
      setDiffImageB64(res.data?.heatmap_b64 || res.data?.diff_b64);
      setShowDiffOverlay(true);
    } catch (err) {
      console.error('Difference computation failed:', err);
    } finally {
      setDiffLoading(false);
    }
  };

  // Run Shift-and-Add Coaddition
  const executeShiftAndAdd = async () => {
    const validFrames = activeObservations
      .filter(obs => imageCache[obs.obs_id]?.b64)
      .map(obs => ({
        image_b64: imageCache[obs.obs_id].b64,
        date: obs.date,
        obs_id: obs.obs_id,
      }));

    if (validFrames.length < 2) {
      alert('At least 2 loaded observation cutouts are required for shift-and-add coaddition.');
      return;
    }

    setShiftLoading(true);
    try {
      const payload = {
        images_data: validFrames,
        motion_rate_arcsec_yr: shiftMotionRate,
        position_angle_deg: shiftPA,
        combine_method: 'median',
        pixel_scale_arcsec: 6.15,
      };
      const res = await runShiftAndAdd(payload);
      setShiftResult(res.data);
      setShiftAddActive(true);
      setIsPlaying(false);
    } catch (err) {
      console.error('Shift and add execution failed:', err);
    } finally {
      setShiftLoading(false);
    }
  };

  // Viewport Pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  const resetView = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      viewerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const currentCutout = currentObs ? imageCache[currentObs.obs_id] : null;

  return (
    <div style={{ backgroundColor: '#050810', minHeight: 'calc(100vh - 64px)', paddingTop: '64px', color: '#ffffff' }}>
      <div style={{ maxWidth: '1700px', margin: '0 auto', padding: '1rem' }}>

        {/* Header Title Banner */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '6px',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '1px'
              }}>
                WISEVIEW ENGINE
              </span>
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#00d4ff', margin: 0, letterSpacing: '1px' }}>
                COSMIC BLINK — Infrared Time-Resolved Viewer
              </h1>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              Astrometrically aligned multi-epoch SPHEREx infrared survey blink comparator & shift-and-add coaddition engine.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <CheckCircle2 size={13} />
              WCS Tangent Astrometry Active
            </span>
            <span style={{
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: '#00d4ff',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Star size={13} />
              Gaia DR3 Astrometric Overlay Ready
            </span>
          </div>
        </div>

        {/* Main 2-Column Layout: Left Sidebar & Right Viewer */}
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.25rem', alignItems: 'start' }}>

          {/* ========================================================================= */}
          {/* LEFT SIDEBAR: Controls & Settings */}
          {/* ========================================================================= */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Target Selection & Coordinates */}
            <div style={{
              background: 'rgba(10, 15, 30, 0.85)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: '12px',
              padding: '1.2rem',
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
                <MapPin size={16} color="#00d4ff" />
                <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', color: '#00d4ff', margin: 0 }}>
                  ASTRONOMICAL TARGET
                </h3>
              </div>

              {/* Target Dropdown */}
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                  Predefined NASA Science Targets
                </label>
                <select
                  value={selectedTarget.name}
                  onChange={(e) => {
                    const t = PREDEFINED_TARGETS.find(x => x.name === e.target.value);
                    if (t) {
                      setSelectedTarget(t);
                      setCustomRa(t.ra.toString());
                      setCustomDec(t.dec.toString());
                      if (t.name === 'WISE 0855') {
                        setShiftMotionRate(8.15);
                        setShiftPA(128.0);
                      } else if (t.name === "Barnard's Star") {
                        setShiftMotionRate(10.32);
                        setShiftPA(356.5);
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    background: 'rgba(5, 8, 16, 0.9)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    color: '#00d4ff',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                >
                  {PREDEFINED_TARGETS.map(t => (
                    <option key={t.name} value={t.name}>{t.name} — {t.type}</option>
                  ))}
                </select>
              </div>

              {/* Coordinates RA / Dec */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '3px' }}>RA (deg)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={customRa}
                    onChange={(e) => setCustomRa(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(5, 8, 16, 0.9)',
                      border: '1px solid rgba(0, 212, 255, 0.25)',
                      color: '#ffffff',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '3px' }}>Dec (deg)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={customDec}
                    onChange={(e) => setCustomDec(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(5, 8, 16, 0.9)',
                      border: '1px solid rgba(0, 212, 255, 0.25)',
                      color: '#ffffff',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  const ra = parseFloat(customRa);
                  const dec = parseFloat(customDec);
                  if (!isNaN(ra) && !isNaN(dec)) {
                    loadTargetObservations(ra, dec, searchRadius);
                    loadGaiaCatalog(ra, dec, searchRadius);
                  }
                }}
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(124,58,237,0.25) 100%)',
                  border: '1px solid #00d4ff',
                  color: '#00d4ff',
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Querying IRSA Archive...' : 'Load SPHEREx Observations'}
              </button>
            </div>

            {/* Blink Playback & Interval Controls */}
            <div style={{
              background: 'rgba(10, 15, 30, 0.85)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: '12px',
              padding: '1.2rem',
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Gauge size={16} color="#00d4ff" />
                  <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', color: '#00d4ff', margin: 0 }}>
                    BLINK CONTROLLER
                  </h3>
                </div>
                <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#38bdf8' }}>
                  {blinkIntervalMs} ms ({((1000 / blinkIntervalMs)).toFixed(1)} fps)
                </span>
              </div>

              {/* Play / Pause / Stepper Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                <button
                  onClick={() => setIsPlaying(p => !p)}
                  style={{
                    flex: 1,
                    background: isPlaying ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    border: isPlaying ? '1px solid #ef4444' : '1px solid #10b981',
                    color: isPlaying ? '#ef4444' : '#10b981',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                  {isPlaying ? 'Pause Blink' : 'Auto Blink'}
                </button>

                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentLoopIdx(prev => (prev - 1 + activeObservations.length) % activeObservations.length);
                  }}
                  title="Previous observation epoch"
                  style={{
                    background: 'rgba(0, 212, 255, 0.1)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    color: '#00d4ff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <SkipBack size={15} />
                </button>

                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentLoopIdx(prev => (prev + 1) % activeObservations.length);
                  }}
                  title="Next observation epoch"
                  style={{
                    background: 'rgba(0, 212, 255, 0.1)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    color: '#00d4ff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <SkipForward size={15} />
                </button>
              </div>

              {/* Blink Interval Speed Slider */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                  <span>Fast (150ms)</span>
                  <span>Normal (500ms)</span>
                  <span>Slow (1500ms)</span>
                </div>
                <input
                  type="range"
                  min="150"
                  max="1800"
                  step="50"
                  value={blinkIntervalMs}
                  onChange={(e) => setBlinkIntervalMs(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#00d4ff' }}
                />
              </div>

              {/* Sliding Time Window Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                  Sliding Time Window
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                  {[
                    { id: 'all', label: 'All Epochs' },
                    { id: 'early', label: 'Earlier' },
                    { id: 'late', label: 'Later' },
                  ].map(w => (
                    <button
                      key={w.id}
                      onClick={() => {
                        setTimeWindowMode(w.id);
                        setCurrentLoopIdx(0);
                      }}
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        background: timeWindowMode === w.id ? 'rgba(0, 212, 255, 0.25)' : 'rgba(5, 8, 16, 0.6)',
                        border: timeWindowMode === w.id ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: timeWindowMode === w.id ? '#00d4ff' : '#94a3b8',
                      }}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Image Display & Stretch Settings */}
            <div style={{
              background: 'rgba(10, 15, 30, 0.85)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: '12px',
              padding: '1.2rem',
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
                <Sliders size={16} color="#00d4ff" />
                <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', color: '#00d4ff', margin: 0 }}>
                  IMAGE DISPLAY CONTROLS
                </h3>
              </div>

              {/* Invert Negative Print Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Invert Image (Negative Print)</span>
                <button
                  onClick={() => setInvertImage(v => !v)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: invertImage ? 'rgba(0, 212, 255, 0.25)' : 'rgba(5, 8, 16, 0.6)',
                    border: invertImage ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: invertImage ? '#00d4ff' : '#94a3b8',
                  }}
                >
                  {invertImage ? 'Inverted' : 'Standard'}
                </button>
              </div>

              {/* Brightness Slider */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '2px' }}>
                  <span>Brightness</span>
                  <span>{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#00d4ff' }}
                />
              </div>

              {/* Contrast Slider */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '2px' }}>
                  <span>Contrast</span>
                  <span>{contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="250"
                  value={contrast}
                  onChange={(e) => setContrast(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#00d4ff' }}
                />
              </div>

              {/* Image Stretch Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                  Astronomical Stretch Function
                </label>
                <select
                  value={stretchMode}
                  onChange={(e) => setStretchMode(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(5, 8, 16, 0.9)',
                    border: '1px solid rgba(0, 212, 255, 0.25)',
                    color: '#00d4ff',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                >
                  <option value="asinh">Asinh Stretch (NASA Standard, Highlights Faint Halos)</option>
                  <option value="linear">Linear Percentile (Clipped 1% - 99.5%)</option>
                  <option value="log">Logarithmic Stretch (High Dynamic Range)</option>
                </select>
              </div>
            </div>

            {/* Gaia DR3 & Difference Toggle Section */}
            <div style={{
              background: 'rgba(10, 15, 30, 0.85)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: '12px',
              padding: '1.2rem',
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
                <Layers size={16} color="#00d4ff" />
                <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', color: '#00d4ff', margin: 0 }}>
                  ASTRONOMICAL OVERLAYS
                </h3>
              </div>

              {/* Gaia DR3 Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.82rem', color: '#f8fafc', display: 'block' }}>Gaia DR3 Reference Stars</span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {gaiaLoading ? 'Querying TAP...' : `${gaiaStars.length} reference stars overlayed`}
                  </span>
                </div>
                <button
                  onClick={() => setShowGaia(v => !v)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: showGaia ? 'rgba(16, 185, 129, 0.2)' : 'rgba(5, 8, 16, 0.6)',
                    border: showGaia ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: showGaia ? '#10b981' : '#94a3b8',
                  }}
                >
                  {showGaia ? 'Active' : 'Off'}
                </button>
              </div>

              {/* Difference Overlay Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.82rem', color: '#f8fafc', display: 'block' }}>Multi-Epoch Difference</span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {showDiffOverlay ? 'Displaying Residual Map' : 'Subtracted residual image'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (!showDiffOverlay && !diffImageB64) {
                      computeDifferenceImage();
                    } else {
                      setShowDiffOverlay(v => !v);
                    }
                  }}
                  disabled={diffLoading || activeObservations.length < 2}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: showDiffOverlay ? 'rgba(124, 58, 237, 0.25)' : 'rgba(5, 8, 16, 0.6)',
                    border: showDiffOverlay ? '1px solid #a78bfa' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: showDiffOverlay ? '#a78bfa' : '#94a3b8',
                  }}
                >
                  {diffLoading ? 'Computing...' : showDiffOverlay ? 'Residual Active' : 'Generate Diff'}
                </button>
              </div>
            </div>

            {/* Shift-and-Add Coaddition Module */}
            <div style={{
              background: 'rgba(10, 15, 30, 0.85)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              borderRadius: '12px',
              padding: '1.2rem',
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
                <Sparkles size={16} color="#a78bfa" />
                <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', color: '#a78bfa', margin: 0 }}>
                  SHIFT-AND-ADD COADDITION
                </h3>
              </div>

              <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '0 0 0.85rem 0' }}>
                Shift multi-epoch frames along the candidate's proper motion track to boost SNR of faint moving sources.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '3px' }}>Rate (arcsec/yr)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={shiftMotionRate}
                    onChange={(e) => setShiftMotionRate(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      background: 'rgba(5, 8, 16, 0.9)',
                      border: '1px solid rgba(124, 58, 237, 0.3)',
                      color: '#a78bfa',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '3px' }}>Position Angle (°)</label>
                  <input
                    type="number"
                    step="1"
                    value={shiftPA}
                    onChange={(e) => setShiftPA(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      background: 'rgba(5, 8, 16, 0.9)',
                      border: '1px solid rgba(124, 58, 237, 0.3)',
                      color: '#a78bfa',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={executeShiftAndAdd}
                  disabled={shiftLoading || activeObservations.length < 2}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(0,212,255,0.2) 100%)',
                    border: '1px solid #a78bfa',
                    color: '#c4b5fd',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: shiftLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={14} className={shiftLoading ? 'animate-spin' : ''} />
                  {shiftLoading ? 'Coadding Arrays...' : 'Execute Shift-and-Add'}
                </button>

                {shiftAddActive && (
                  <button
                    onClick={() => {
                      setShiftAddActive(false);
                      setIsPlaying(true);
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      color: '#ef4444',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* MAIN VIEWER: Canvas / Astronomical Blink Frame */}
          {/* ========================================================================= */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Viewer Stage Container */}
            <div
              ref={viewerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                position: 'relative',
                width: '100%',
                height: '580px',
                background: '#020409',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: isPanning ? 'grabbing' : 'grab',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* TOP HUD: Observation Metadata Banner */}
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                right: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 20,
                pointerEvents: 'none',
              }}>
                <div style={{
                  background: 'rgba(5, 8, 16, 0.85)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  backdropFilter: 'blur(8px)',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>OBSERVATION EPOCH</span>
                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: '#00d4ff', fontWeight: 600 }}>
                      {shiftAddActive ? 'SHIFT-AND-ADD COADDITION' : (currentObs?.date || 'No Observation')}
                    </span>
                  </div>

                  <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />

                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>IDENTIFIER</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {shiftAddActive ? `${shiftResult?.frames_included || 0} Frames Stacked` : (currentObs?.obs_id || 'SPX-NIL')}
                    </span>
                  </div>

                  <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />

                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>BAND / CHANNEL</span>
                    <span style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 500 }}>
                      {currentObs?.band || 'SPHEREx-LVF'}
                    </span>
                  </div>
                </div>

                {/* Right HUD: Frame Index Indicator & Zoom Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
                  <div style={{
                    background: 'rgba(5, 8, 16, 0.85)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    backdropFilter: 'blur(8px)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: '0.8rem',
                    color: '#38bdf8',
                  }}>
                    FRAME {activeObservations.length > 0 ? currentLoopIdx + 1 : 0} / {activeObservations.length}
                  </div>

                  <button
                    onClick={() => setZoomLevel(z => Math.min(4.0, z + 0.25))}
                    title="Zoom in"
                    style={{
                      background: 'rgba(5, 8, 16, 0.85)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      color: '#00d4ff',
                      padding: '6px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <ZoomIn size={16} />
                  </button>

                  <button
                    onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
                    title="Zoom out"
                    style={{
                      background: 'rgba(5, 8, 16, 0.85)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      color: '#00d4ff',
                      padding: '6px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <ZoomOut size={16} />
                  </button>

                  <button
                    onClick={resetView}
                    title="Reset view and centering"
                    style={{
                      background: 'rgba(5, 8, 16, 0.85)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      color: '#00d4ff',
                      padding: '6px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={16} />
                  </button>

                  <button
                    onClick={toggleFullscreen}
                    title="Toggle fullscreen"
                    style={{
                      background: 'rgba(5, 8, 16, 0.85)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      color: '#00d4ff',
                      padding: '6px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                </div>
              </div>

              {/* Main Image Viewport with Pan & Zoom Transform */}
              <div style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                position: 'relative',
                display: 'inline-block',
              }}>
                {/* 1. Normal Blink Image / Shift-and-Add / Difference Overlay */}
                {shiftAddActive && shiftResult?.stacked_candidate_b64 ? (
                  <img
                    src={`data:image/png;base64,${shiftResult.stacked_candidate_b64}`}
                    alt="Shift and Add Stack"
                    style={{
                      maxWidth: '520px',
                      maxHeight: '520px',
                      display: 'block',
                      filter: `${invertImage ? 'invert(1) ' : ''}brightness(${brightness}%) contrast(${contrast}%)`,
                    }}
                  />
                ) : showDiffOverlay && diffImageB64 ? (
                  <img
                    src={`data:image/png;base64,${diffImageB64}`}
                    alt="Difference Image"
                    style={{
                      maxWidth: '520px',
                      maxHeight: '520px',
                      display: 'block',
                      filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                    }}
                  />
                ) : currentCutout?.b64 ? (
                  <img
                    src={`data:image/png;base64,${currentCutout.b64}`}
                    alt={currentObs?.obs_id}
                    style={{
                      maxWidth: '520px',
                      maxHeight: '520px',
                      display: 'block',
                      filter: `${invertImage ? 'invert(1) ' : ''}brightness(${brightness}%) contrast(${contrast}%)`,
                    }}
                  />
                ) : (
                  <div style={{
                    width: '480px',
                    height: '480px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#040714',
                    border: '1px dashed rgba(0, 212, 255, 0.2)',
                    color: '#64748b',
                  }}>
                    {loading ? (
                      <>
                        <RefreshCw size={28} className="animate-spin" color="#00d4ff" />
                        <span style={{ marginTop: '12px', fontSize: '0.85rem' }}>Loading SPHEREx DR1 Observations...</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={28} color="#f59e0b" />
                        <span style={{ marginTop: '12px', fontSize: '0.85rem' }}>
                          {currentCutout?.error || 'Awaiting observation cutout preview...'}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Reticle Crosshair at Target Coordinates */}
                {showReticle && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '32px',
                    height: '32px',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                  }}>
                    {/* Crosshair lines */}
                    <div style={{ position: 'absolute', top: '0', left: '15px', width: '2px', height: '10px', background: '#00d4ff' }} />
                    <div style={{ position: 'absolute', bottom: '0', left: '15px', width: '2px', height: '10px', background: '#00d4ff' }} />
                    <div style={{ position: 'absolute', top: '15px', left: '0', width: '10px', height: '2px', background: '#00d4ff' }} />
                    <div style={{ position: 'absolute', top: '15px', right: '0', width: '10px', height: '2px', background: '#00d4ff' }} />
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      width: '16px',
                      height: '16px',
                      border: '1px dashed #00d4ff',
                      borderRadius: '50%',
                    }} />
                  </div>
                )}

                {/* Candidate Motion Vector Track (e.g. for WISE 0855 or Barnard's Star) */}
                {showMotionTrack && selectedTarget && !shiftAddActive && (
                  <svg
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                    }}
                  >
                    {/* Simulated motion track vector overlay */}
                    <line
                      x1="48%"
                      y1="52%"
                      x2="53%"
                      y2="46%"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                    <circle cx="53%" cy="46%" r="4" fill="none" stroke="#f59e0b" strokeWidth="2" />
                    <text x="54%" y="45%" fill="#f59e0b" fontSize="10" fontFamily="sans-serif">
                      Track: {selectedTarget.name === 'WISE 0855' ? '8.15 "/yr' : '10.32 "/yr'}
                    </text>
                  </svg>
                )}

                {/* Gaia DR3 Optical Reference Star Markers */}
                {showGaia && gaiaStars.map((s, idx) => {
                  // Project celestial coordinates relative to target center onto canvas
                  const dra = (s.ra - parseFloat(customRa)) * Math.cos(parseFloat(customDec) * Math.PI / 180);
                  const ddec = s.dec - parseFloat(customDec);
                  // Scale: 0.1 deg cutout field -> 500px width (5000 px/deg)
                  const pxX = 260 + dra * 4800;
                  const pxY = 260 - ddec * 4800;

                  if (pxX < 10 || pxX > 510 || pxY < 10 || pxY > 510) return null;

                  return (
                    <div
                      key={s.source_id || idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGaiaStar(s);
                      }}
                      title={`Gaia DR3: G=${s.phot_g_mean_mag} mag, PM=${s.pm_total_mas_yr} mas/yr`}
                      style={{
                        position: 'absolute',
                        left: `${pxX}px`,
                        top: `${pxY}px`,
                        transform: 'translate(-50%, -50%)',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: '1px solid #10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        cursor: 'pointer',
                        zIndex: 15,
                      }}
                    />
                  );
                })}
              </div>

              {/* BOTTOM HUD: Coordinates & Spatial Scale */}
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                right: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 20,
                pointerEvents: 'none',
              }}>
                <div style={{
                  background: 'rgba(5, 8, 16, 0.85)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  backdropFilter: 'blur(8px)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: '#94a3b8',
                }}>
                  Center: RA {parseFloat(customRa).toFixed(5)}°, Dec {parseFloat(customDec).toFixed(5)}°
                </div>

                <div style={{
                  background: 'rgba(5, 8, 16, 0.85)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  backdropFilter: 'blur(8px)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span>Scale: 6.15 arcsec/px</span>
                  <span>•</span>
                  <span>FOV: ~6.0 arcmin</span>
                </div>
              </div>
            </div>

            {/* Shift-and-Add Comparison Results Bar (When Active) */}
            {shiftAddActive && shiftResult && (
              <div style={{
                background: 'rgba(10, 15, 30, 0.9)',
                border: '1px solid #a78bfa',
                borderRadius: '12px',
                padding: '1.2rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem',
              }}>
                <div>
                  <h4 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: '#c4b5fd', margin: '0 0 4px 0' }}>
                    Candidate-Aligned Stack
                  </h4>
                  <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: 0 }}>
                    Moving source coadds constructively; stationary stars appear trailed.
                  </p>
                  <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#10b981' }}>
                    SNR Enhancement: ~{shiftResult.snr_improvement_factor}x ({shiftResult.frames_included} frames)
                  </div>
                </div>

                <div>
                  <h4 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: '#00d4ff', margin: '0 0 4px 0' }}>
                    Stationary Background Stack
                  </h4>
                  <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: 0 }}>
                    Aligned on fixed celestial grid (v = 0). Moving source smears out.
                  </p>
                  <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#38bdf8' }}>
                    Noise Floor RMS: {shiftResult.noise_stationary_rms}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: '#f59e0b', margin: '0 0 4px 0' }}>
                    Residual Difference
                  </h4>
                  <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: 0 }}>
                    Candidate Stack minus Stationary Stack cancels background.
                  </p>
                  <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#f59e0b' }}>
                    Track Velocity: {shiftResult.motion_vector?.speed_arcsec_yr} "/yr
                  </div>
                </div>
              </div>
            )}

            {/* BOTTOM PANEL: Multi-Epoch Timeline & Selection Strip */}
            <div style={{
              background: 'rgba(10, 15, 30, 0.85)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={15} color="#00d4ff" />
                  <h4 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: '#00d4ff', margin: 0 }}>
                    MULTI-EPOCH OBSERVATION TIMELINE
                  </h4>
                </div>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {activeObservations.length} of {observations.length} Epochs in Blink Loop
                </span>
              </div>

              {/* Thumbnails Filmstrip */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                overflowX: 'auto',
                paddingBottom: '6px',
              }}>
                {observations.map((obs, idx) => {
                  const isCurrent = activeObservations[currentLoopIdx]?.obs_id === obs.obs_id;
                  const isSelected = selectedObsIds.has(obs.obs_id);
                  const thumb = imageCache[obs.obs_id];

                  return (
                    <div
                      key={obs.obs_id}
                      onClick={() => {
                        const targetIdx = activeObservations.findIndex(o => o.obs_id === obs.obs_id);
                        if (targetIdx >= 0) {
                          setCurrentLoopIdx(targetIdx);
                          setIsPlaying(false);
                        }
                      }}
                      style={{
                        minWidth: '130px',
                        maxWidth: '130px',
                        background: isCurrent ? 'rgba(0, 212, 255, 0.15)' : 'rgba(5, 8, 16, 0.8)',
                        border: isCurrent ? '2px solid #00d4ff' : isSelected ? '1px solid rgba(0, 212, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative',
                      }}
                    >
                      {/* Checkbox to include/exclude */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleObsSelection(obs.obs_id);
                        }}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          accentColor: '#00d4ff',
                          cursor: 'pointer',
                          zIndex: 5,
                        }}
                      />

                      {/* Thumbnail Image */}
                      <div style={{
                        width: '100%',
                        height: '70px',
                        background: '#000',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '6px',
                      }}>
                        {thumb?.b64 ? (
                          <img
                            src={`data:image/png;base64,${thumb.b64}`}
                            alt={obs.obs_id}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                            {thumb?.loading ? 'Loading...' : 'Pending'}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.72rem', color: isCurrent ? '#00d4ff' : '#cbd5e1', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {obs.obs_id}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '1px' }}>
                        {obs.date?.split(' ')[0] || '2025'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Candidate & Gaia Astrometry Details Drawer */}
            {selectedGaiaStar && (
              <div style={{
                background: 'rgba(10, 15, 30, 0.9)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#10b981', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', fontWeight: 700 }}>
                      GAIA DR3 BACKGROUND STAR
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      ID: {selectedGaiaStar.source_id}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.78rem', color: '#94a3b8' }}>
                    <span>Position: RA {selectedGaiaStar.ra}°, Dec {selectedGaiaStar.dec}°</span>
                    <span>Magnitude: G = {selectedGaiaStar.phot_g_mean_mag} mag</span>
                    <span>Proper Motion: {selectedGaiaStar.pm_total_mas_yr} mas/yr (RA: {selectedGaiaStar.pmra_mas_yr}, Dec: {selectedGaiaStar.pmdec_mas_yr})</span>
                    <span>Parallax: {selectedGaiaStar.parallax_mas} mas</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedGaiaStar(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#94a3b8',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
