import { useState, useEffect } from 'react';
import {
  FlaskConical, MapPin, AlertCircle, RefreshCw, Sliders,
  Layers, Star, Eye, ShieldAlert, Sparkles, Activity
} from 'lucide-react';
import { fetchObservations, compareImages, fetchCutout } from '../services/api';

const PREDEFINED_TARGETS = [
  { name: 'RW Aurigae', ra: 75.7954, dec: 30.4013, type: 'Variable Star', desc: 'Dramatic circumprimary disk dimming event' },
  { name: 'R Draconis', ra: 271.1783, dec: 68.0417, type: 'Mira Variable', desc: 'Pulsational amplitude flux variation' },
  { name: "Barnard's Star", ra: 269.4521, dec: 4.6933, type: 'High Proper Motion Star', desc: 'Bipolar subtraction dipole signature from proper motion' },
];

export default function DiffLabPage() {
  const [selectedTarget, setSelectedTarget] = useState(PREDEFINED_TARGETS[0]);
  const [observations, setObservations] = useState([]);
  const [epoch1Idx, setEpoch1Idx] = useState(0);
  const [epoch2Idx, setEpoch2Idx] = useState(1);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState(null);
  const [diffResult, setDiffResult] = useState(null);

  // Display adjust sliders
  const [contrast, setContrast] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [activeTab, setActiveTab] = useState('heatmap'); // 'heatmap' or 'diff'

  const loadObservations = async (t) => {
    setLoading(true);
    setError(null);
    setDiffResult(null);

    try {
      const res = await fetchObservations(t.ra, t.dec, 0.25);
      const obs = res.data?.observations || [];
      setObservations(obs);
      if (obs.length >= 2) {
        setEpoch1Idx(0);
        setEpoch2Idx(1);
        runComparison(obs[0], obs[1]);
      } else {
        setError('At least two observation epochs are required for difference imaging.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load observations.');
    } finally {
      setLoading(false);
    }
  };

  const ensureCutout = async (obs, t) => {
    if (obs.image_base64) return obs.image_base64;
    try {
      const res = await fetchCutout(t.ra, t.dec, 0.1, obs.access_url, obs.obs_id);
      if (res.data?.image_base64) {
        obs.image_base64 = res.data.image_base64;
        return res.data.image_base64;
      }
    } catch (e) {
      console.warn('Cutout load notice:', e);
    }
    return null;
  };

  const runComparison = async (obs1, obs2, t = selectedTarget) => {
    setComparing(true);
    setError(null);
    try {
      const b64_1 = await ensureCutout(obs1, t);
      const b64_2 = await ensureCutout(obs2, t);
      if (!b64_1 || !b64_2) {
        setError('Could not retrieve calibrated cutouts for both selected epochs from IRSA.');
        return;
      }
      const res = await compareImages({
        image1_b64: b64_1,
        image2_b64: b64_2,
      });
      setDiffResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Difference imaging calculation failed.');
    } finally {
      setComparing(false);
    }
  };

  useEffect(() => {
    loadObservations(selectedTarget);
  }, [selectedTarget]);

  const handleEpochChange = (idx1, idx2) => {
    setEpoch1Idx(idx1);
    setEpoch2Idx(idx2);
    if (observations[idx1] && observations[idx2]) {
      runComparison(observations[idx1], observations[idx2]);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '3rem', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a78bfa', fontSize: '0.85rem', marginBottom: '4px' }}>
            <FlaskConical size={16} />
            <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Astrophotometric Subtraction Laboratory</span>
          </div>
          <h1 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
            fontWeight: 700,
            color: '#a78bfa',
            textShadow: '0 0 20px rgba(167, 139, 250, 0.4)',
            marginBottom: '0.5rem',
          }}>
            Difference Image Lab
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '850px' }}>
            Subtract multi-epoch SPHEREx observations to reveal transient brightening, occultation dimming,
            and high proper-motion dipole residuals through divergence heatmaps.
          </p>
        </div>

        {/* Target Selector */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Star size={13} style={{ color: '#f59e0b' }} /> Select Variable & Motion Test Targets:
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
                    background: active ? 'linear-gradient(135deg, rgba(167,139,250,0.3), rgba(0,212,255,0.2))' : 'rgba(10,15,30,0.8)',
                    border: active ? '1px solid #a78bfa' : '1px solid rgba(167,139,250,0.25)',
                    color: active ? '#c4b5fd' : '#94a3b8',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <MapPin size={12} style={{ color: active ? '#a78bfa' : '#64748b' }} />
                  <span style={{ fontWeight: active ? 600 : 400 }}>{t.name}</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({t.type})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Epoch Selector Bar */}
        {observations.length >= 2 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            background: 'rgba(10, 15, 30, 0.75)',
            border: '1px solid rgba(167, 139, 250, 0.25)',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#00d4ff', marginBottom: '3px' }}>
                  EPOCH 1 (REFERENCE)
                </label>
                <select
                  value={epoch1Idx}
                  onChange={(e) => handleEpochChange(parseInt(e.target.value), epoch2Idx)}
                  style={{
                    background: 'rgba(5, 8, 16, 0.9)',
                    color: '#00d4ff',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                >
                  {observations.map((o, idx) => (
                    <option key={idx} value={idx} disabled={idx === epoch2Idx}>
                      Epoch {idx + 1} ({o.date})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ color: '#64748b', fontSize: '1.2rem', marginTop: '16px' }}>−</div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#a78bfa', marginBottom: '3px' }}>
                  EPOCH 2 (VISIT)
                </label>
                <select
                  value={epoch2Idx}
                  onChange={(e) => handleEpochChange(epoch1Idx, parseInt(e.target.value))}
                  style={{
                    background: 'rgba(5, 8, 16, 0.9)',
                    color: '#a78bfa',
                    border: '1px solid rgba(124, 58, 237, 0.3)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                >
                  {observations.map((o, idx) => (
                    <option key={idx} value={idx} disabled={idx === epoch1Idx}>
                      Epoch {idx + 1} ({o.date})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contrast / Brightness Sliders */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Contrast: {contrast}%</span>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={contrast}
                  onChange={(e) => setContrast(parseInt(e.target.value))}
                  style={{ width: '80px', accentColor: '#00d4ff' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Brightness: {brightness}%</span>
                <input
                  type="range"
                  min="50"
                  max="180"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  style={{ width: '80px', accentColor: '#a78bfa' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 3-Column Display: Epoch 1, Epoch 2, Difference/Heatmap */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          
          {/* Epoch 1 Original */}
          <div style={{
            borderRadius: '12px',
            background: 'rgba(10, 15, 30, 0.75)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            padding: '1.25rem',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: '#00d4ff' }}>
                EPOCH 1: {observations[epoch1Idx]?.date || 'Ref'}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Asinh Stretch</span>
            </div>
            <div style={{
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#000',
              border: '1px solid rgba(0, 212, 255, 0.15)',
              filter: `contrast(${contrast}%) brightness(${brightness}%)`,
            }}>
              {observations[epoch1Idx]?.image_base64 && (
                <img
                  src={`data:image/png;base64,${observations[epoch1Idx].image_base64}`}
                  alt="Epoch 1"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px' }}>
              {observations[epoch1Idx]?.obs_id}
            </div>
          </div>

          {/* Epoch 2 Original */}
          <div style={{
            borderRadius: '12px',
            background: 'rgba(10, 15, 30, 0.75)',
            border: '1px solid rgba(124, 58, 237, 0.25)',
            padding: '1.25rem',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: '#a78bfa' }}>
                EPOCH 2: {observations[epoch2Idx]?.date || 'Visit'}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Asinh Stretch</span>
            </div>
            <div style={{
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#000',
              border: '1px solid rgba(124, 58, 237, 0.2)',
              filter: `contrast(${contrast}%) brightness(${brightness}%)`,
            }}>
              {observations[epoch2Idx]?.image_base64 && (
                <img
                  src={`data:image/png;base64,${observations[epoch2Idx].image_base64}`}
                  alt="Epoch 2"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px' }}>
              {observations[epoch2Idx]?.obs_id}
            </div>
          </div>

          {/* Difference / Heatmap Result */}
          <div style={{
            borderRadius: '12px',
            background: 'rgba(10, 15, 30, 0.85)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            padding: '1.25rem',
            textAlign: 'center',
            boxShadow: '0 0 25px rgba(234, 179, 8, 0.08)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => setActiveTab('heatmap')}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    background: activeTab === 'heatmap' ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
                    border: activeTab === 'heatmap' ? '1px solid #eab308' : '1px solid transparent',
                    color: activeTab === 'heatmap' ? '#fde047' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  Divergent Heatmap
                </button>
                <button
                  onClick={() => setActiveTab('diff')}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    background: activeTab === 'diff' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                    border: activeTab === 'diff' ? '1px solid #00d4ff' : '1px solid transparent',
                    color: activeTab === 'diff' ? '#00d4ff' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  Raw Difference
                </button>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#eab308' }}>Δ Flux Residual</span>
            </div>

            <div style={{
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#000',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              filter: `contrast(${contrast}%) brightness(${brightness}%)`,
              minHeight: '260px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {comparing ? (
                <div className="animate-spin" style={{
                  width: '28px',
                  height: '28px',
                  border: '2px solid rgba(234,179,8,0.2)',
                  borderTopColor: '#eab308',
                  borderRadius: '50%',
                }} />
              ) : diffResult ? (
                <img
                  src={`data:image/png;base64,${activeTab === 'heatmap' ? diffResult.heatmap_b64 : diffResult.diff_b64}`}
                  alt="Difference"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              ) : null}
            </div>

            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px' }}>
              Red: Positive Residual | Blue: Negative Residual
            </div>
          </div>
        </div>

        {/* Statistical Metrics Panel */}
        {diffResult?.stats && (
          <div style={{
            borderRadius: '12px',
            background: 'rgba(10, 15, 30, 0.75)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            padding: '1.25rem',
          }}>
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', color: '#00d4ff', marginBottom: '1rem' }}>
              DIFFERENCE ASTROPHOTOMETRY STATISTICS
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'rgba(5, 8, 16, 0.7)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Mean Flux Residual</span>
                <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: '#e2e8f0', fontWeight: 600 }}>
                  {diffResult.stats.mean_diff.toFixed(3)}
                </span>
              </div>

              <div style={{ background: 'rgba(5, 8, 16, 0.7)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>RMS Residual Spread (1-σ)</span>
                <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: '#a78bfa', fontWeight: 600 }}>
                  {diffResult.stats.std_diff.toFixed(3)}
                </span>
              </div>

              <div style={{ background: 'rgba(5, 8, 16, 0.7)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Peak Absolute Deviation</span>
                <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: '#f59e0b', fontWeight: 600 }}>
                  {diffResult.stats.max_abs_diff.toFixed(2)}
                </span>
              </div>

              <div style={{ background: 'rgba(5, 8, 16, 0.7)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Significant Pixels (&gt; 3σ)</span>
                <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: '#06b6d4', fontWeight: 600 }}>
                  {diffResult.stats.changed_pixels} px
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

