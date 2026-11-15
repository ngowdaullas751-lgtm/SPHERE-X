import { useState, useEffect, useRef } from 'react';
import {
  Zap, MapPin, AlertCircle, ArrowUpRight, ShieldAlert, CheckCircle2,
  Share2, ChevronRight, Compass, RefreshCw, Eye, Star, Layers, Activity,
  Info, Sparkles, Sliders, X, HelpCircle, ArrowRight, Gauge, Radio
} from 'lucide-react';
import { fetchObservations, detectMotion, submitCandidate } from '../services/api';

const PREDEFINED_TARGETS = [
  { name: 'WISE 0855', ra: 133.795129, dec: -7.245147, type: 'Y-Dwarf (Official Test Target)', desc: 'Coldest brown dwarf with fast motion (~8.1 arcsec/yr)' },
  { name: "Barnard's Star", ra: 269.452075, dec: 4.693391, type: 'High Proper Motion Star', desc: 'Highest known stellar proper motion (~10.3 arcsec/yr)' },
  { name: 'Epsilon Indi B', ra: 330.8403, dec: -56.7872, type: 'Brown Dwarf Companion', desc: 'Nearby T-dwarf companion (~4.7 arcsec/yr)' },
  { name: 'RW Aurigae', ra: 75.7954, dec: 30.4013, type: 'Variable Star', desc: 'T Tauri star occultation events' },
  { name: 'R Draconis', ra: 271.1783, dec: 68.0417, type: 'Mira Variable', desc: 'Long-period pulsating red giant' },
];

export default function MotionDetectorPage() {
  const [selectedTarget, setSelectedTarget] = useState(PREDEFINED_TARGETS[0]);
  const [observations, setObservations] = useState([]);
  const [epoch1Idx, setEpoch1Idx] = useState(0);
  const [epoch2Idx, setEpoch2Idx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [motionResult, setMotionResult] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [thresholdSigma, setThresholdSigma] = useState(2.5);
  const [submittedId, setSubmittedId] = useState(null);
  const [viewMode, setViewMode] = useState('overlay'); // 'overlay', 'epoch1', 'epoch2', 'diff'
  const [activeTab, setActiveTab] = useState('candidates'); // 'candidates' or 'all_sources'
  const [filterClass, setFilterClass] = useState('all');

  const canvasRef = useRef(null);

  // Load observations from archive
  const loadObservations = async (t) => {
    setLoading(true);
    setError(null);
    setMotionResult(null);
    setSelectedSource(null);
    setSubmittedId(null);

    try {
      const res = await fetchObservations(t.ra, t.dec, 0.05, 'spherex_dr1');
      const obs = res.data?.observations || [];

      // Sort observations chronologically by date
      const sorted = [...obs].sort((a, b) => {
        const tA = new Date(a.date).getTime() || 0;
        const tB = new Date(b.date).getTime() || 0;
        return tA - tB;
      });

      setObservations(sorted);

      if (sorted.length >= 2) {
        // Select earliest and latest epoch to maximize the time baseline
        setEpoch1Idx(0);
        setEpoch2Idx(sorted.length - 1);
        runDetection(sorted[0], sorted[sorted.length - 1], t);
      } else if (sorted.length === 1) {
        setError(`Only 1 observation found in SPHEREx DR1 for ${t.name}. At least 2 multi-epoch observations are required for proper motion analysis.`);
      } else {
        setError(`No SPHEREx DR1 observations currently available for ${t.name} at (RA: ${t.ra}, Dec: ${t.dec}).`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to retrieve observations.');
    } finally {
      setLoading(false);
    }
  };

  // Run scientific motion detection pipeline
  const runDetection = async (obs1, obs2, t = selectedTarget) => {
    if (!obs1 || !obs2) return;
    setAnalyzing(true);
    setError(null);
    setSelectedSource(null);

    try {
      const payload = {
        access_url1: obs1.access_url,
        access_url2: obs2.access_url,
        obs_id1: obs1.obs_id,
        obs_id2: obs2.obs_id,
        ra: t.ra,
        dec: t.dec,
        date1: obs1.date || '2025-05-09',
        date2: obs2.date || '2026-05-18',
        pixel_scale_arcsec: 6.15,
        threshold_sigma: thresholdSigma,
      };

      const res = await detectMotion(payload);
      setMotionResult(res.data);

      // Default select the top candidate or first matched source
      if (res.data?.candidates?.length > 0) {
        setSelectedSource(res.data.candidates[0]);
      } else if (res.data?.matched_sources?.length > 0) {
        setSelectedSource(res.data.matched_sources[0]);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Motion detection analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    loadObservations(selectedTarget);
  }, [selectedTarget]);

  // Handle epoch selection change
  const handleEpochChange = (idx1, idx2) => {
    setEpoch1Idx(idx1);
    setEpoch2Idx(idx2);
    if (observations[idx1] && observations[idx2]) {
      runDetection(observations[idx1], observations[idx2], selectedTarget);
    }
  };

  // Canvas rendering of image + astronomical overlays
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    let base64Img = motionResult?.image1_b64;
    if (viewMode === 'epoch2') base64Img = motionResult?.reprojected_b64 || motionResult?.image2_b64;
    else if (viewMode === 'diff') base64Img = motionResult?.diff_b64;

    if (!base64Img) return;

    const img = new Image();
    img.src = `data:image/png;base64,${base64Img}`;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Only draw vectors/markers in 'overlay' or 'epoch1' mode
      if (viewMode === 'overlay' || viewMode === 'epoch1') {
        const sourcesToDraw = motionResult?.matched_sources || motionResult?.candidates || [];

        sourcesToDraw.forEach((src, idx) => {
          const px = src._px;
          if (!px) return;

          const isSelected = selectedSource?.candidate_id === src.candidate_id;
          const isMoving = src.classification === 'possible_moving_source';
          const isVar = src.classification === 'variable_brightness_source';
          const isArtifact = src.classification === 'image_artifact';
          const isUncertain = src.classification === 'uncertain_detection';

          // Canvas coordinates (astronomical origin is lower-left)
          const cx1 = px.x1;
          const cy1 = canvas.height - px.y1;
          const cx2 = cx1 + px.dx * 3.5; // scaled 3.5x for visibility
          const cy2 = cy1 - px.dy * 3.5;

          // Color palette based on classification
          let color = '#94a3b8';
          if (isMoving) color = '#00d4ff';
          else if (isVar) color = '#c084fc';
          else if (isArtifact) color = '#f87171';
          else if (isUncertain) color = '#fbbf24';
          else color = '#10b981'; // stationary reference

          if (isSelected) color = '#facc15'; // highlight selected in bright gold

          // 1. Source aperture circle
          ctx.beginPath();
          ctx.arc(cx1, cy1, isSelected ? 9 : 5, 0, 2 * Math.PI);
          ctx.strokeStyle = color;
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.stroke();

          // 2. Motion vector line & arrowhead for sources with displacement
          if (src.displacement_arcsec > 0.4 && (isMoving || isSelected || src.speed_arcsec_per_year > 1.0)) {
            ctx.beginPath();
            ctx.moveTo(cx1, cy1);
            ctx.lineTo(cx2, cy2);
            ctx.strokeStyle = color;
            ctx.lineWidth = isSelected ? 2.5 : 1.5;
            ctx.stroke();

            // Arrowhead
            const angle = Math.atan2(cy2 - cy1, cx2 - cx1);
            ctx.beginPath();
            ctx.moveTo(cx2, cy2);
            ctx.lineTo(cx2 - 6 * Math.cos(angle - Math.PI / 6), cy2 - 6 * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(cx2, cy2);
            ctx.lineTo(cx2 - 6 * Math.cos(angle + Math.PI / 6), cy2 - 6 * Math.sin(angle + Math.PI / 6));
            ctx.strokeStyle = color;
            ctx.lineWidth = isSelected ? 2.5 : 1.5;
            ctx.stroke();
          }

          // 3. Label tag
          if (isSelected || isMoving || isVar) {
            ctx.fillStyle = color;
            ctx.font = isSelected ? 'bold 11px Orbitron, sans-serif' : '9px Orbitron, sans-serif';
            ctx.fillText(isMoving ? `MOV #${idx + 1}` : isVar ? `VAR #${idx + 1}` : `#${idx + 1}`, cx1 + 10, cy1 - 4);
          }
        });
      }
    };
  }, [motionResult, selectedSource, viewMode]);

  // Click on canvas to select nearest source
  const handleCanvasClick = (e) => {
    if (!canvasRef.current || !motionResult?.matched_sources) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    let nearest = null;
    let minD = 25.0; // 25 px click radius

    motionResult.matched_sources.forEach(src => {
      if (!src._px) return;
      const sx = src._px.x1;
      const sy = canvas.height - src._px.y1;
      const dist = Math.hypot(clickX - sx, clickY - sy);
      if (dist < minD) {
        minD = dist;
        nearest = src;
      }
    });

    if (nearest) {
      setSelectedSource(nearest);
    }
  };

  const handleSubmitToDiscovery = async (cand) => {
    if (!cand) return;
    try {
      await submitCandidate({
        id: cand.candidate_id,
        ra: cand.ra || selectedTarget.ra,
        dec: cand.dec || selectedTarget.dec,
        type: cand.classification_label || 'Proper Motion Candidate (Unverified)',
        confidence: cand.confidence,
        dates: [cand.date1, cand.date2],
        notes: `Speed: ${cand.speed_arcsec_per_year.toFixed(2)}±${cand.uncertainty_speed.toFixed(2)}"/yr, Disp: ${cand.displacement_arcsec.toFixed(2)}", Sig: ${cand.significance_sigma}σ (${cand.verification_status})`,
      });
      setSubmittedId(cand.candidate_id);
    } catch (e) {
      console.error('Submit error:', e);
    }
  };

  // Filter sources
  const candidateList = motionResult?.candidates || [];
  const allSourceList = (motionResult?.matched_sources || []).filter(s => {
    if (filterClass === 'all') return true;
    return s.classification === filterClass;
  });

  const displayedList = activeTab === 'candidates' ? candidateList : allSourceList;

  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '3rem', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1350px', margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#06b6d4', fontSize: '0.85rem', marginBottom: '4px' }}>
            <Zap size={16} />
            <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Scientific Astrometry & Proper Motion Pipeline</span>
          </div>
          <h1 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
            fontWeight: 700,
            color: '#06b6d4',
            textShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
            marginBottom: '0.5rem',
          }}>
            Motion Detector
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '850px', lineHeight: '1.5' }}>
            Extracts calibrated SPHEREx FITS cutouts across multi-epoch visits, aligns celestial coordinate grids via WCS reprojection,
            runs Photutils DAOStarFinder point-source extraction, and measures sub-pixel angular displacements with rigorous uncertainty propagation.
          </p>
        </div>

        {/* Predefined Targets */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Star size={13} style={{ color: '#f59e0b' }} /> Official Benchmark Science Targets:
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
                    background: active ? 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(0,212,255,0.2))' : 'rgba(10,15,30,0.8)',
                    border: active ? '1px solid #06b6d4' : '1px solid rgba(6,182,212,0.25)',
                    color: active ? '#67e8f9' : '#94a3b8',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <MapPin size={12} style={{ color: active ? '#06b6d4' : '#64748b' }} />
                  <span style={{ fontWeight: active ? 600 : 400 }}>{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scientific Disclaimer Alert Banner */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          background: 'rgba(234, 179, 8, 0.08)',
          border: '1px solid rgba(234, 179, 8, 0.28)',
          color: '#fef08a',
          marginBottom: '1.5rem',
          fontSize: '0.82rem',
        }}>
          <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#eab308' }} />
          <div>
            <strong style={{ display: 'block', color: '#fef08a', marginBottom: '2px' }}>
              Scientific Rigor Standard: UNVERIFIED CANDIDATE CLASSIFICATION
            </strong>
            All flagged astronomical objects are strictly <em>unverified candidates</em>.
            Multi-epoch celestial reprojection and independent verification against external astronomical catalogues (e.g. Gaia, WISE)
            are required before any scientific discovery can be confirmed.
          </div>
        </div>

        {/* Quality or Error Warning */}
        {error && (
          <div style={{
            display: 'flex',
            gap: '10px',
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            marginBottom: '1.5rem',
            fontSize: '0.88rem',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '2px' }}>Astrometric Archive Notice</strong>
              {error}
            </div>
          </div>
        )}

        {/* Epoch Baseline Selector */}
        {observations.length >= 2 && (
          <div style={{
            padding: '0.75rem 1.25rem',
            borderRadius: '10px',
            background: 'rgba(10, 15, 30, 0.7)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            marginBottom: '1.25rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} style={{ color: '#06b6d4' }} />
              <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Multi-Epoch Baseline Comparison:</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Epoch 1 (Origin):</span>
                <select
                  value={epoch1Idx}
                  onChange={(e) => handleEpochChange(parseInt(e.target.value), epoch2Idx)}
                  style={{
                    background: '#050810',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    color: '#00d4ff',
                    fontSize: '0.78rem',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  }}
                >
                  {observations.map((obs, i) => (
                    <option key={obs.obs_id || i} value={i} disabled={i === epoch2Idx}>
                      #{i + 1}: {obs.date?.slice(0, 10)} ({obs.obs_id?.slice(0, 12)}...)
                    </option>
                  ))}
                </select>
              </div>

              <ArrowRight size={14} style={{ color: '#64748b' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Epoch 2 (WCS Grid):</span>
                <select
                  value={epoch2Idx}
                  onChange={(e) => handleEpochChange(epoch1Idx, parseInt(e.target.value))}
                  style={{
                    background: '#050810',
                    border: '1px solid rgba(167, 139, 250, 0.3)',
                    color: '#c084fc',
                    fontSize: '0.78rem',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  }}
                >
                  {observations.map((obs, i) => (
                    <option key={obs.obs_id || i} value={i} disabled={i === epoch1Idx}>
                      #{i + 1}: {obs.date?.slice(0, 10)} ({obs.obs_id?.slice(0, 12)}...)
                    </option>
                  ))}
                </select>
              </div>

              {motionResult?.dt_years && (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  color: '#67e8f9',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                }}>
                  Δt = {motionResult.dt_years.toFixed(3)} yr ({motionResult.dt_days?.toFixed(0) || (motionResult.dt_years * 365.25).toFixed(0)} days)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Main 2-Column Scientific Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Column: Visual Canvas & Astrometric Controls */}
          <div style={{
            borderRadius: '14px',
            background: 'rgba(10, 15, 30, 0.85)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            padding: '1.25rem',
            boxShadow: '0 0 25px rgba(6, 182, 212, 0.08)',
          }}>
            {/* View Mode Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: '#06b6d4', letterSpacing: '0.5px' }}>
                ASTROMETRIC VECTOR FIELD OVERLAY
              </span>

              {/* View Mode Buttons */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(5, 8, 16, 0.8)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { id: 'overlay', label: 'Vector Overlay' },
                  { id: 'epoch1', label: 'Epoch 1 Raw' },
                  { id: 'epoch2', label: 'Epoch 2 Aligned' },
                  { id: 'diff', label: 'Difference' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setViewMode(m.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      border: 'none',
                      background: viewMode === m.id ? 'rgba(6, 182, 212, 0.25)' : 'transparent',
                      color: viewMode === m.id ? '#67e8f9' : '#64748b',
                      fontWeight: viewMode === m.id ? 600 : 400,
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas Viewer Container */}
            <div style={{
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '360px',
              position: 'relative',
              cursor: 'crosshair',
            }}>
              {loading || analyzing ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                  <div className="animate-spin" style={{
                    width: '36px',
                    height: '36px',
                    border: '3px solid rgba(6,182,212,0.2)',
                    borderTopColor: '#06b6d4',
                    borderRadius: '50%',
                    margin: '0 auto 12px',
                  }} />
                  <span style={{ color: '#06b6d4', fontSize: '0.9rem', fontWeight: 600 }}>
                    Aligning WCS Grids & Computing Centroid Kinematics…
                  </span>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                    Reprojecting celestial tangent plane & running Photutils DAOStarFinder
                  </p>
                </div>
              ) : motionResult?.image1_b64 ? (
                <>
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                  {/* Legend Overlay on Canvas bottom */}
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    background: 'rgba(5, 8, 16, 0.85)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '0.68rem',
                    display: 'flex',
                    gap: '10px',
                    color: '#94a3b8',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d4ff' }} /> Moving
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c084fc' }} /> Variable
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} /> Reference
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#facc15' }} /> Selected
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                  <Info size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <span>Select a target above to load multi-epoch observations.</span>
                </div>
              )}
            </div>

            {/* Click instruction */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
              <span>Click on any source circle in the canvas to inspect its astrometric parameters.</span>
              <span>Vectors scaled 3.5× for visibility</span>
            </div>

            {/* Scientific Notes Banner */}
            {motionResult?.scientific_notes && (
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                fontSize: '0.75rem',
                color: '#67e8f9',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Sparkles size={14} style={{ color: '#06b6d4', flexShrink: 0 }} />
                <span>{motionResult.scientific_notes}</span>
              </div>
            )}
          </div>

          {/* Right Column: Source Inspector & Candidates List */}
          <div>

            {/* Detailed Selected Source Astrometric Inspector */}
            {selectedSource ? (
              <div style={{
                borderRadius: '12px',
                background: 'rgba(10, 15, 30, 0.85)',
                border: '1px solid rgba(0, 212, 255, 0.35)',
                padding: '1.25rem',
                marginBottom: '1.25rem',
                boxShadow: '0 0 25px rgba(0, 212, 255, 0.08)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(0, 212, 255, 0.2)',
                        color: '#00d4ff',
                        fontFamily: 'Orbitron, sans-serif',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}>
                        SOURCE #{selectedSource.candidate_id}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        background: selectedSource.classification === 'possible_moving_source' ? 'rgba(0, 212, 255, 0.15)' :
                                    selectedSource.classification === 'variable_brightness_source' ? 'rgba(192, 132, 252, 0.15)' :
                                    selectedSource.classification === 'stationary_source' ? 'rgba(16, 185, 129, 0.15)' :
                                    'rgba(248, 113, 113, 0.15)',
                        color: selectedSource.classification === 'possible_moving_source' ? '#67e8f9' :
                               selectedSource.classification === 'variable_brightness_source' ? '#d8b4fe' :
                               selectedSource.classification === 'stationary_source' ? '#6ee7b7' :
                               '#fca5a5',
                        border: '1px solid currentColor',
                      }}>
                        {selectedSource.classification_label}
                      </span>
                    </div>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                      RA: {selectedSource.ra?.toFixed(6)}° | Dec: {selectedSource.dec?.toFixed(6)}°
                    </span>
                  </div>

                  <span style={{
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(234, 179, 8, 0.15)',
                    color: '#fef08a',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}>
                    UNVERIFIED
                  </span>
                </div>

                {/* Astrometric Measurements Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ background: 'rgba(5, 8, 16, 0.7)', padding: '8px', borderRadius: '6px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Proper Motion Speed</span>
                    <strong style={{ color: '#00d4ff', fontSize: '0.95rem' }}>
                      {selectedSource.speed_arcsec_per_year.toFixed(2)}"/yr
                    </strong>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>
                      ± {selectedSource.uncertainty_speed?.toFixed(2) || '0.25'}"/yr
                    </span>
                  </div>

                  <div style={{ background: 'rgba(5, 8, 16, 0.7)', padding: '8px', borderRadius: '6px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Angular Displacement</span>
                    <strong style={{ color: '#67e8f9', fontSize: '0.95rem' }}>
                      {selectedSource.displacement_arcsec.toFixed(2)}"
                    </strong>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>
                      ± {selectedSource.uncertainty_arcsec?.toFixed(2) || '0.15'}" ({selectedSource.significance_sigma?.toFixed(1) || '0'}σ)
                    </span>
                  </div>

                  <div style={{ background: 'rgba(5, 8, 16, 0.7)', padding: '8px', borderRadius: '6px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Position Angle (PA)</span>
                    <strong style={{ color: '#c084fc', fontSize: '0.95rem' }}>
                      {selectedSource.direction_deg.toFixed(1)}°
                    </strong>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>East of North</span>
                  </div>
                </div>

                {/* Photometry & Quality Specs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '0.72rem', marginBottom: '10px' }}>
                  <div style={{ background: 'rgba(5, 8, 16, 0.5)', padding: '6px', borderRadius: '4px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.62rem' }}>Signal-to-Noise</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{selectedSource.snr1?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div style={{ background: 'rgba(5, 8, 16, 0.5)', padding: '6px', borderRadius: '4px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.62rem' }}>Magnitude Δm</span>
                    <span style={{ color: Math.abs(selectedSource.delta_mag) > 0.5 ? '#f59e0b' : '#e2e8f0', fontWeight: 600 }}>
                      {selectedSource.delta_mag > 0 ? `+${selectedSource.delta_mag}` : selectedSource.delta_mag || '0.00'}
                    </span>
                  </div>
                  <div style={{ background: 'rgba(5, 8, 16, 0.5)', padding: '6px', borderRadius: '4px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.62rem' }}>Sharpness</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{selectedSource.sharpness1?.toFixed(2) || '0.50'}</span>
                  </div>
                  <div style={{ background: 'rgba(5, 8, 16, 0.5)', padding: '6px', borderRadius: '4px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.62rem' }}>Confidence</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>{(selectedSource.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Notes and verification trigger */}
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '10px' }}>
                  {selectedSource.notes}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => handleSubmitToDiscovery(selectedSource)}
                    disabled={submittedId === selectedSource.candidate_id}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: submittedId === selectedSource.candidate_id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                      border: submittedId === selectedSource.candidate_id ? '1px solid #10b981' : '1px solid rgba(6, 182, 212, 0.4)',
                      color: submittedId === selectedSource.candidate_id ? '#6ee7b7' : '#67e8f9',
                      fontSize: '0.75rem',
                      cursor: submittedId === selectedSource.candidate_id ? 'default' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {submittedId === selectedSource.candidate_id ? (
                      <><CheckCircle2 size={13} /> Flagged to Discovery Hub</>
                    ) : (
                      <><Share2 size={13} /> Submit Candidate for Community Verification</>
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Source Classification Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setActiveTab('candidates')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontFamily: 'Orbitron, sans-serif',
                    background: activeTab === 'candidates' ? 'rgba(6, 182, 212, 0.25)' : 'rgba(10, 15, 30, 0.6)',
                    border: activeTab === 'candidates' ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: activeTab === 'candidates' ? '#67e8f9' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Flagged Candidates ({candidateList.length})
                </button>
                <button
                  onClick={() => setActiveTab('all_sources')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontFamily: 'Orbitron, sans-serif',
                    background: activeTab === 'all_sources' ? 'rgba(6, 182, 212, 0.25)' : 'rgba(10, 15, 30, 0.6)',
                    border: activeTab === 'all_sources' ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: activeTab === 'all_sources' ? '#67e8f9' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  All Sources ({motionResult?.matched_sources?.length || 0})
                </button>
              </div>

              {activeTab === 'all_sources' && (
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  style={{
                    background: '#050810',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    fontSize: '0.72rem',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  <option value="all">All Types</option>
                  <option value="possible_moving_source">Moving Candidates</option>
                  <option value="variable_brightness_source">Variables</option>
                  <option value="stationary_source">Stationary References</option>
                  <option value="uncertain_detection">Uncertain</option>
                  <option value="image_artifact">Artifacts</option>
                </select>
              )}
            </div>

            {/* Source Card Scroll List */}
            {displayedList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
                {displayedList.map((cand, idx) => {
                  const isSelected = selectedSource?.candidate_id === cand.candidate_id;
                  const isSubmitted = submittedId === cand.candidate_id;
                  return (
                    <div
                      key={cand.candidate_id}
                      onClick={() => setSelectedSource(cand)}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'rgba(10, 15, 30, 0.75)',
                        border: isSelected ? '1px solid #06b6d4' : '1px solid rgba(6, 182, 212, 0.18)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: isSelected ? '#06b6d4' : 'rgba(6,182,212,0.2)',
                            color: isSelected ? '#000' : '#06b6d4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            fontFamily: 'Orbitron, sans-serif',
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: '#e2e8f0' }}>
                            #{cand.candidate_id}
                          </span>
                        </div>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.65rem',
                          background: cand.classification === 'possible_moving_source' ? 'rgba(0, 212, 255, 0.15)' :
                                      cand.classification === 'variable_brightness_source' ? 'rgba(192, 132, 252, 0.15)' :
                                      'rgba(16, 185, 129, 0.15)',
                          color: cand.classification === 'possible_moving_source' ? '#67e8f9' :
                                 cand.classification === 'variable_brightness_source' ? '#d8b4fe' :
                                 '#6ee7b7',
                          border: '1px solid currentColor',
                        }}>
                          {cand.classification_label}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '0.72rem' }}>
                        <div style={{ background: 'rgba(5,8,16,0.6)', padding: '5px', borderRadius: '4px' }}>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.62rem' }}>Displacement</span>
                          <strong style={{ color: '#00d4ff' }}>{cand.displacement_arcsec.toFixed(2)}"</strong>
                        </div>
                        <div style={{ background: 'rgba(5,8,16,0.6)', padding: '5px', borderRadius: '4px' }}>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.62rem' }}>Speed</span>
                          <strong style={{ color: '#67e8f9' }}>{cand.speed_arcsec_per_year.toFixed(2)}"/yr</strong>
                        </div>
                        <div style={{ background: 'rgba(5,8,16,0.6)', padding: '5px', borderRadius: '4px' }}>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.62rem' }}>Significance</span>
                          <strong style={{ color: cand.significance_sigma >= 3 ? '#10b981' : '#94a3b8' }}>
                            {cand.significance_sigma?.toFixed(1) || '0'}σ
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '2.5rem 1.5rem',
                borderRadius: '12px',
                background: 'rgba(10, 15, 30, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#64748b',
              }}>
                <Info size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ color: '#cbd5e1', fontSize: '0.88rem', marginBottom: '4px' }}>
                  No sources matching the current filter.
                </p>
                <p style={{ fontSize: '0.75rem' }}>
                  All matched stars exhibit positions consistent with zero significant proper motion within the observation baseline.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
