import { useState, useEffect, useRef } from 'react';
import {
  Star, MapPin, AlertCircle, RefreshCw, Activity,
  TrendingUp, TrendingDown, Clock, Layers, Sparkles,
  Download, CheckCircle2, Sliders, Eye, Info, Search,
  FileText, BarChart2, ShieldCheck, HelpCircle
} from 'lucide-react';
import Plotly from 'plotly.js-dist-min';
import { fetchLightCurve } from '../services/api';

const BENCHMARK_TARGETS = [
  {
    name: 'RW Aurigae',
    ra: 75.7954,
    dec: 30.4013,
    type: 'Classical T Tauri Star',
    desc: 'Accretion-driven episodic infrared outbursts and circumstellar dust occultations',
    variability: 'CONFIRMED VARIABLE',
  },
  {
    name: 'R Draconis',
    ra: 271.1783,
    dec: 68.0417,
    type: 'Mira Pulsating Giant',
    desc: 'High-amplitude periodic infrared pulsation (~245 days) from radial envelope oscillations',
    variability: 'CONFIRMED VARIABLE',
  },
  {
    name: 'WISE 0855',
    ra: 133.795129,
    dec: -7.245147,
    type: 'Y-Dwarf Sub-stellar',
    desc: 'Coldest known brown dwarf (~250 K); rotational flux modulation from patchy atmospheric water/ice clouds',
    variability: 'ROTATIONAL / STABLE',
  },
  {
    name: "Barnard's Star",
    ra: 269.4521,
    dec: 4.6933,
    type: 'M-Dwarf Flare Star',
    desc: 'Nearby high proper motion star; photometrically consistent with episodic stellar magnetic flares',
    variability: 'FLARE VARIABLE',
  },
  {
    name: 'Epsilon Indi B',
    ra: 330.8403,
    dec: -56.7872,
    type: 'Binary T-Dwarf System',
    desc: 'Benchmark cold sub-stellar companion pair with long-term survey photometric baseline',
    variability: 'STABLE CALIBRATOR',
  },
];

const BAND_OPTIONS = [
  { id: 'all', label: 'All Bands (Composite)' },
  { id: 'Band 1', label: 'Band 1 (0.75 – 1.11 µm)' },
  { id: 'Band 2', label: 'Band 2 (1.11 – 1.64 µm)' },
  { id: 'Band 3', label: 'Band 3 (1.64 – 2.42 µm)' },
  { id: 'Band 4', label: 'Band 4 (2.42 – 3.82 µm)' },
  { id: 'Band 5', label: 'Band 5 (3.82 – 4.42 µm)' },
  { id: 'Band 6', label: 'Band 6 (4.42 – 5.00 µm)' },
];

export default function BrightnessPage() {
  const [selectedTarget, setSelectedTarget] = useState(BENCHMARK_TARGETS[0]);
  const [selectedBand, setSelectedBand] = useState('all');
  const [customRa, setCustomRa] = useState(BENCHMARK_TARGETS[0].ra.toString());
  const [customDec, setCustomDec] = useState(BENCHMARK_TARGETS[0].dec.toString());
  const [activeEpochIndex, setActiveEpochIndex] = useState(0);

  const [lightCurveData, setLightCurveData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fluxUnit, setFluxUnit] = useState('flux'); // 'flux' (mJy) or 'mag' (Delta m)
  const [showCustomCoords, setShowCustomCoords] = useState(false);

  const chartContainerRef = useRef(null);

  const loadLightCurve = async (raVal, decVal, bandVal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLightCurve(parseFloat(raVal), parseFloat(decVal), bandVal);
      setLightCurveData(res.data);
      setActiveEpochIndex(0);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to retrieve multi-epoch photometric data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLightCurve(selectedTarget.ra, selectedTarget.dec, selectedBand);
  }, [selectedTarget, selectedBand]);

  const handleTargetSelect = (t) => {
    setSelectedTarget(t);
    setCustomRa(t.ra.toString());
    setCustomDec(t.dec.toString());
  };

  const handleCustomSearch = (e) => {
    e.preventDefault();
    const parsedRa = parseFloat(customRa);
    const parsedDec = parseFloat(customDec);
    if (isNaN(parsedRa) || parsedRa < 0 || parsedRa > 360) {
      setError('Please provide a valid Right Ascension between 0° and 360°.');
      return;
    }
    if (isNaN(parsedDec) || parsedDec < -90 || parsedDec > 90) {
      setError('Please provide a valid Declination between -90° and +90°.');
      return;
    }
    setSelectedTarget({
      name: `Custom Target (${parsedRa.toFixed(4)}, ${parsedDec.toFixed(4)})`,
      ra: parsedRa,
      dec: parsedDec,
      type: 'User Specified Coordinates',
      desc: 'SPHEREx survey multi-epoch photometric retrieval',
      variability: 'ANALYZING',
    });
  };

  // Render Interactive Plotly Light Curve
  useEffect(() => {
    if (!chartContainerRef.current || !lightCurveData?.epochs?.length) return;

    const epochs = lightCurveData.epochs;
    const dates = epochs.map(e => e.date_obs);
    const fluxes = epochs.map(e => e.flux_mjy);
    const errors = epochs.map(e => e.flux_error_mjy);
    const stats = lightCurveData.variability_statistics || {};

    let yValues = fluxes;
    let yTitle = 'Flux Density F_λ (mJy)';
    let hoverUnits = 'mJy';

    if (fluxUnit === 'mag') {
      const baseFlux = Math.max(...fluxes, 0.001);
      yValues = fluxes.map(f => -2.5 * Math.log10(Math.max(f, 0.001) / baseFlux));
      yTitle = 'Relative Magnitude Δm (inverted)';
      hoverUnits = 'Δm';
    }

    // Main Observation Points Trace
    const tracePoints = {
      x: dates,
      y: yValues,
      error_y: {
        type: 'data',
        array: fluxUnit === 'mag' ? errors.map((err, i) => (1.0857 * err / Math.max(fluxes[i], 0.001))) : errors,
        visible: true,
        color: 'rgba(0, 212, 255, 0.5)',
        thickness: 1.5,
        width: 4,
      },
      type: 'scatter',
      mode: 'lines+markers',
      line: {
        color: '#00d4ff',
        width: 2.2,
        dash: 'solid',
      },
      marker: {
        color: epochs.map((_, i) => i === activeEpochIndex ? '#f59e0b' : '#00d4ff'),
        size: epochs.map((_, i) => i === activeEpochIndex ? 13 : 8),
        symbol: epochs.map((_, i) => i === activeEpochIndex ? 'star' : 'circle'),
        line: {
          color: epochs.map((_, i) => i === activeEpochIndex ? '#ffffff' : '#050810'),
          width: 2,
        },
      },
      name: lightCurveData.target_name || selectedTarget.name,
      customdata: epochs.map(e => [
        e.obs_id,
        e.band,
        e.flux_mjy,
        e.flux_error_mjy,
        e.snr,
        e.quality_status
      ]),
      hovertemplate:
        '<b>Date:</b> %{x}<br>' +
        '<b>Flux:</b> %{customdata[2]:.3f} ± %{customdata[3]:.3f} mJy<br>' +
        '<b>SNR:</b> %{customdata[4]:.1f}<br>' +
        '<b>Band:</b> %{customdata[1]}<br>' +
        '<b>Obs ID:</b> %{customdata[0]}<br>' +
        '<b>Quality:</b> %{customdata[5]}<extra></extra>',
    };

    // Reference Line: Weighted Mean Flux
    const traces = [tracePoints];
    if (stats.weighted_mean_flux > 0) {
      let refY = stats.weighted_mean_flux;
      if (fluxUnit === 'mag') {
        const baseFlux = Math.max(...fluxes, 0.001);
        refY = -2.5 * Math.log10(Math.max(refY, 0.001) / baseFlux);
      }
      traces.push({
        x: [dates[0], dates[dates.length - 1]],
        y: [refY, refY],
        type: 'scatter',
        mode: 'lines',
        line: {
          color: 'rgba(168, 85, 247, 0.7)',
          width: 1.8,
          dash: 'dash',
        },
        name: `Weighted Mean (${stats.weighted_mean_flux.toFixed(2)} mJy)`,
        hoverinfo: 'name',
      });
    }

    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'rgba(5, 8, 16, 0.9)',
      font: { color: '#94a3b8', family: 'Inter, sans-serif' },
      margin: { l: 65, r: 25, t: 30, b: 65 },
      xaxis: {
        title: { text: 'Observation Date (UTC)', font: { color: '#00d4ff', size: 12 } },
        gridcolor: 'rgba(255, 255, 255, 0.06)',
        zerolinecolor: 'rgba(255, 255, 255, 0.1)',
        tickfont: { color: '#94a3b8', size: 10 },
      },
      yaxis: {
        title: { text: yTitle, font: { color: '#00d4ff', size: 12 } },
        gridcolor: 'rgba(255, 255, 255, 0.06)',
        zerolinecolor: 'rgba(255, 255, 255, 0.1)',
        autorange: fluxUnit === 'mag' ? 'reversed' : true,
        tickfont: { color: '#94a3b8', size: 10 },
      },
      legend: {
        orientation: 'h',
        y: 1.12,
        x: 0,
        font: { size: 11, color: '#cbd5e1' },
      },
      autosize: true,
      hovermode: 'closest',
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    };

    Plotly.newPlot(chartContainerRef.current, traces, layout, config);

    // Click handler to select epoch
    if (chartContainerRef.current.on) {
      chartContainerRef.current.on('plotly_click', (data) => {
        if (data.points && data.points.length > 0) {
          const ptIdx = data.points[0].pointIndex;
          if (ptIdx !== undefined && ptIdx < epochs.length) {
            setActiveEpochIndex(ptIdx);
          }
        }
      });
    }

    return () => {
      if (chartContainerRef.current) {
        Plotly.purge(chartContainerRef.current);
      }
    };
  }, [lightCurveData, fluxUnit, activeEpochIndex, selectedTarget]);

  // Export handlers
  const handleDownloadCSV = () => {
    if (!lightCurveData?.csv_export) return;
    const blob = new Blob([lightCurveData.csv_export], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (lightCurveData.target_name || 'spherex_photometry').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `${safeName}_light_curve.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    if (!lightCurveData) return;
    const blob = new Blob([JSON.stringify(lightCurveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (lightCurveData.target_name || 'spherex_photometry').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `${safeName}_photometry.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const epochs = lightCurveData?.epochs || [];
  const activeEpoch = epochs[activeEpochIndex] || null;
  const stats = lightCurveData?.variability_statistics || {};

  // Classification styling helper
  const getClassificationStyle = (cls) => {
    switch (cls) {
      case 'CONFIRMED VARIABLE':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          border: '#ef4444',
          color: '#fca5a5',
          glow: '0 0 15px rgba(239, 68, 68, 0.4)',
        };
      case 'POSSIBLY VARIABLE':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          border: '#f59e0b',
          color: '#fde68a',
          glow: '0 0 15px rgba(245, 158, 11, 0.4)',
        };
      case 'CONSISTENT / STABLE':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          border: '#10b981',
          color: '#6ee7b7',
          glow: '0 0 15px rgba(16, 185, 129, 0.4)',
        };
      default:
        return {
          bg: 'rgba(148, 163, 184, 0.12)',
          border: '#64748b',
          color: '#cbd5e1',
          glow: 'none',
        };
    }
  };

  const classStyle = getClassificationStyle(stats.classification);

  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '3.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1350px', margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00d4ff', fontSize: '0.85rem', marginBottom: '4px' }}>
            <Activity size={16} />
            <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>NASA SPHEREx Multi-Epoch Time-Domain Photometry</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 'clamp(1.6rem, 3.5vw, 2.3rem)',
                fontWeight: 700,
                color: '#00d4ff',
                textShadow: '0 0 25px rgba(0, 212, 255, 0.4)',
                marginBottom: '0.4rem',
              }}>
                Brightness & Variability Analyzer
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '850px', lineHeight: 1.5 }}>
                Measure multi-epoch aperture flux curves and calibrate time-domain variability across repeated SPHEREx all-sky survey scans.
                Detect circumstellar accretion outbursts, stellar pulsations, and quantify statistical variability significance.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDownloadCSV}
                disabled={!lightCurveData?.csv_export}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(0, 212, 255, 0.12)',
                  border: '1px solid rgba(0, 212, 255, 0.4)',
                  color: '#00d4ff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: lightCurveData?.csv_export ? 'pointer' : 'not-allowed',
                  opacity: lightCurveData?.csv_export ? 1 : 0.5,
                }}
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                onClick={handleDownloadJSON}
                disabled={!lightCurveData}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(168, 85, 247, 0.12)',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  color: '#c084fc',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: lightCurveData ? 'pointer' : 'not-allowed',
                  opacity: lightCurveData ? 1 : 0.5,
                }}
              >
                <FileText size={14} /> Export JSON
              </button>
            </div>
          </div>
        </div>

        {/* Target Quick Select & Controls */}
        <div style={{
          background: 'rgba(10, 15, 30, 0.85)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          borderRadius: '14px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          boxShadow: '0 0 25px rgba(0, 212, 255, 0.05)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Star size={14} style={{ color: '#00d4ff' }} /> Benchmark Variable Science Targets:
            </div>
            <button
              onClick={() => setShowCustomCoords(!showCustomCoords)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#00d4ff',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'underline',
              }}
            >
              <Sliders size={13} /> {showCustomCoords ? 'Hide Custom Coordinates' : 'Enter Custom RA / Dec'}
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
            {BENCHMARK_TARGETS.map(t => {
              const active = selectedTarget.name === t.name;
              return (
                <button
                  key={t.name}
                  onClick={() => handleTargetSelect(t)}
                  style={{
                    padding: '7px 15px',
                    borderRadius: '8px',
                    background: active
                      ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.25), rgba(168, 85, 247, 0.25))'
                      : 'rgba(15, 23, 42, 0.7)',
                    border: active ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: active ? '#ffffff' : '#94a3b8',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <MapPin size={13} style={{ color: active ? '#00d4ff' : '#64748b' }} />
                  <span style={{ fontWeight: active ? 600 : 400 }}>{t.name}</span>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: active ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                    color: active ? '#e0f2fe' : '#64748b',
                  }}>
                    {t.type}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom Coordinate Search Form */}
          {showCustomCoords && (
            <form onSubmit={handleCustomSearch} style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(5, 8, 16, 0.8)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              marginBottom: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>RA (deg):</span>
                <input
                  type="number"
                  step="0.0001"
                  value={customRa}
                  onChange={(e) => setCustomRa(e.target.value)}
                  style={{
                    width: '120px',
                    padding: '4px 8px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '4px',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Dec (deg):</span>
                <input
                  type="number"
                  step="0.0001"
                  value={customDec}
                  onChange={(e) => setCustomDec(e.target.value)}
                  style={{
                    width: '120px',
                    padding: '4px 8px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '4px',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  background: '#00d4ff',
                  border: 'none',
                  color: '#050810',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Search size={13} /> Load Target Photometry
              </button>
            </form>
          )}

          {/* Filter Bar: Band Selector & Photometric Units */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Filter Band:</span>
              <select
                value={selectedBand}
                onChange={(e) => setSelectedBand(e.target.value)}
                style={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  color: '#00d4ff',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                {BAND_OPTIONS.map(b => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '4px' }}>Photometric Axis:</span>
              <button
                onClick={() => setFluxUnit('flux')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  background: fluxUnit === 'flux' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                  border: fluxUnit === 'flux' ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                  color: fluxUnit === 'flux' ? '#00d4ff' : '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: fluxUnit === 'flux' ? 600 : 400,
                }}
              >
                Linear Flux Density (mJy)
              </button>
              <button
                onClick={() => setFluxUnit('mag')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  background: fluxUnit === 'mag' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                  border: fluxUnit === 'mag' ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                  color: fluxUnit === 'mag' ? '#00d4ff' : '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: fluxUnit === 'mag' ? 600 : 400,
                }}
              >
                Relative Magnitude (Δm)
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '1rem',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Warning Alert if insufficient data */}
        {lightCurveData?.warning && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid #f59e0b',
            color: '#fde68a',
            marginBottom: '1.5rem',
            fontSize: '0.82rem',
          }}>
            <Info size={16} />
            <span>{lightCurveData.warning}</span>
          </div>
        )}

        {/* Primary Analysis Grid: Light Curve (Left) + Epoch Inspector (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>

          {/* Light Curve Chart Panel */}
          <div style={{
            borderRadius: '14px',
            background: 'rgba(10, 15, 30, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            padding: '1.25rem',
            boxShadow: '0 0 30px rgba(0, 212, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', fontWeight: 600 }}>
                  LIGHT CURVE: {(lightCurveData?.target_name || selectedTarget.name).toUpperCase()}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '8px' }}>
                  (Click any observation marker to inspect that epoch)
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: 600 }}>
                {epochs.length} Observation Visits
              </div>
            </div>

            {loading ? (
              <div style={{ flex: 1, minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid rgba(0, 212, 255, 0.2)',
                  borderTopColor: '#00d4ff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '14px',
                }} />
                <span>Extracting calibrated aperture photometry from multi-epoch FITS cutouts…</span>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              </div>
            ) : epochs.length === 0 ? (
              <div style={{ flex: 1, minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center', padding: '2rem' }}>
                <AlertCircle size={32} style={{ color: '#f59e0b', marginBottom: '10px' }} />
                <span style={{ fontSize: '0.95rem', color: '#cbd5e1', marginBottom: '6px' }}>No Observation Epochs Available</span>
                <span style={{ fontSize: '0.8rem', maxWidth: '400px' }}>
                  Select one of the benchmark targets (RW Aurigae or R Draconis) to explore verified multi-epoch survey measurements.
                </span>
              </div>
            ) : (
              <div
                ref={chartContainerRef}
                style={{ width: '100%', height: '420px' }}
              />
            )}
          </div>

          {/* Epoch Inspector Card */}
          <div style={{
            borderRadius: '14px',
            background: 'rgba(10, 15, 30, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>
                <Eye size={16} /> Epoch Measurement Inspector
              </div>
              <span style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#fde68a',
                fontFamily: 'monospace',
              }}>
                Epoch {activeEpoch ? activeEpoch.epoch_index : 0} of {epochs.length}
              </span>
            </div>

            {activeEpoch ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                {/* Thumbnail Cutout Preview */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1',
                  maxHeight: '220px',
                  borderRadius: '10px',
                  background: '#020408',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {activeEpoch.image_b64 ? (
                    <img
                      src={`data:image/png;base64,${activeEpoch.image_b64}`}
                      alt={`Cutout at ${activeEpoch.date_obs}`}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ color: '#475569', fontSize: '0.78rem' }}>Cutout preview not available</div>
                  )}

                  {/* Photometric Aperture Reticle Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '32px',
                    height: '32px',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    border: '1.5px dashed #00d4ff',
                    pointerEvents: 'none',
                    boxShadow: '0 0 10px rgba(0, 212, 255, 0.6)',
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '64px',
                    height: '64px',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    border: '1px dotted rgba(168, 85, 247, 0.5)',
                    pointerEvents: 'none',
                  }} />

                  <span style={{
                    position: 'absolute',
                    bottom: '6px',
                    left: '8px',
                    fontSize: '0.65rem',
                    color: '#94a3b8',
                    background: 'rgba(5, 8, 16, 0.75)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                  }}>
                    Aperture r=2.5px | Annulus r=4–7px
                  </span>
                </div>

                {/* Quantitative Measurement Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '6px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Aperture Flux (F_λ)</span>
                    <span style={{ color: '#00d4ff', fontWeight: 700, fontFamily: 'monospace' }}>
                      {activeEpoch.flux_mjy.toFixed(3)} mJy
                    </span>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '6px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Uncertainty (σ_F)</span>
                    <span style={{ color: '#f59e0b', fontWeight: 700, fontFamily: 'monospace' }}>
                      ±{activeEpoch.flux_error_mjy.toFixed(3)} mJy
                    </span>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '6px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Signal-to-Noise (SNR)</span>
                    <span style={{ color: '#10b981', fontWeight: 700, fontFamily: 'monospace' }}>
                      {activeEpoch.snr.toFixed(1)}
                    </span>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '6px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Background (I_bkg)</span>
                    <span style={{ color: '#cbd5e1', fontWeight: 600, fontFamily: 'monospace' }}>
                      {activeEpoch.background_mjy_sr.toFixed(3)} MJy/sr
                    </span>
                  </div>
                </div>

                {/* Metadata details */}
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                  <div><span style={{ color: '#64748b' }}>Date-Obs:</span> <span style={{ color: '#cbd5e1' }}>{activeEpoch.date_obs}</span></div>
                  <div><span style={{ color: '#64748b' }}>Obs ID:</span> <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{activeEpoch.obs_id}</span></div>
                  <div><span style={{ color: '#64748b' }}>Band / Detector:</span> <span style={{ color: '#a855f7' }}>{activeEpoch.band} (D{activeEpoch.detector})</span></div>
                  <div>
                    <span style={{ color: '#64748b' }}>Quality Flag:</span>{' '}
                    <span style={{
                      padding: '1px 6px',
                      borderRadius: '3px',
                      background: activeEpoch.quality_flag === 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: activeEpoch.quality_flag === 0 ? '#6ee7b7' : '#fca5a5',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}>
                      {activeEpoch.quality_status} ({activeEpoch.quality_flag})
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem 0', fontSize: '0.85rem' }}>
                No active epoch selected.
              </div>
            )}
          </div>
        </div>

        {/* Astrophysical Variability Metrics Dashboard */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          {/* Classification Card */}
          <div style={{
            background: classStyle.bg,
            border: `1px solid ${classStyle.border}`,
            boxShadow: classStyle.glow,
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>
                Variability Classification
              </span>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: classStyle.color }}>
                {stats.classification || 'INSUFFICIENT DATA'}
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '6px', lineHeight: 1.4 }}>
              {stats.classification_reason || 'Calculating photometric dispersion across available survey epochs…'}
            </p>
          </div>

          {/* Reduced Chi-Square */}
          <div style={{
            background: 'rgba(10, 15, 30, 0.75)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: '12px',
            padding: '1rem',
          }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Reduced Chi-Square (χ²_red)</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#00d4ff', fontWeight: 700 }}>
              {stats.chi2_reduced !== undefined ? stats.chi2_reduced.toFixed(2) : 'N/A'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
              χ² &gt; 3.0 indicates significant variability
            </span>
          </div>

          {/* Coefficient of Variation (CV) */}
          <div style={{
            background: 'rgba(10, 15, 30, 0.75)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '12px',
            padding: '1rem',
          }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Coefficient of Variation (CV)</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#f59e0b', fontWeight: 700 }}>
              {stats.cv !== undefined ? `${(stats.cv * 100).toFixed(1)}%` : 'N/A'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
              Fractional flux dispersion (σ / &lt;F&gt;)
            </span>
          </div>

          {/* Peak-to-Trough Amplitude */}
          <div style={{
            background: 'rgba(10, 15, 30, 0.75)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '12px',
            padding: '1rem',
          }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Peak-to-Trough Amplitude</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#c084fc', fontWeight: 700 }}>
              {stats.amplitude_ratio !== undefined ? `${stats.amplitude_ratio.toFixed(2)}x` : 'N/A'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
              ΔF = {stats.amplitude_delta !== undefined ? stats.amplitude_delta.toFixed(2) : '0'} mJy
            </span>
          </div>

          {/* Weighted Mean Flux */}
          <div style={{
            background: 'rgba(10, 15, 30, 0.75)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '12px',
            padding: '1rem',
          }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Weighted Mean Flux</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#10b981', fontWeight: 700 }}>
              {stats.weighted_mean_flux !== undefined ? `${stats.weighted_mean_flux.toFixed(2)} mJy` : 'N/A'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
              Median: {stats.median_flux !== undefined ? stats.median_flux.toFixed(2) : '0'} mJy
            </span>
          </div>
        </div>

        {/* Observation Epochs Table */}
        <div style={{
          background: 'rgba(10, 15, 30, 0.85)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          borderRadius: '14px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', fontWeight: 600 }}>
              OBSERVATION VISIT HISTORY & PHOTOMETRIC CATALOG
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Sorted Chronologically · {epochs.length} Recorded Visits
            </span>
          </div>

          {epochs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b', fontSize: '0.85rem' }}>
              No observation epochs recorded for this target in collection spherex_dr1.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', color: '#cbd5e1' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>#</th>
                    <th style={{ padding: '8px 10px' }}>Date (UTC)</th>
                    <th style={{ padding: '8px 10px' }}>Obs ID</th>
                    <th style={{ padding: '8px 10px' }}>Band</th>
                    <th style={{ padding: '8px 10px' }}>Net Flux (mJy)</th>
                    <th style={{ padding: '8px 10px' }}>Error (mJy)</th>
                    <th style={{ padding: '8px 10px' }}>SNR</th>
                    <th style={{ padding: '8px 10px' }}>Quality</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {epochs.map((ep, idx) => {
                    const isSelected = idx === activeEpochIndex;
                    return (
                      <tr
                        key={ep.obs_id || idx}
                        onClick={() => setActiveEpochIndex(idx)}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          background: isSelected ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: isSelected ? '#00d4ff' : '#64748b' }}>
                          {ep.epoch_index}
                        </td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          {ep.date_obs}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#94a3b8' }}>
                          {ep.obs_id}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#a855f7' }}>
                          {ep.band} (D{ep.detector})
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#00d4ff' }}>
                          {ep.flux_mjy.toFixed(3)}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#f59e0b' }}>
                          ±{ep.flux_error_mjy.toFixed(3)}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#10b981' }}>
                          {ep.snr.toFixed(1)}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '3px',
                            background: ep.quality_flag === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: ep.quality_flag === 0 ? '#6ee7b7' : '#fca5a5',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                          }}>
                            {ep.quality_status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveEpochIndex(idx);
                            }}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: isSelected ? '#00d4ff' : 'rgba(255, 255, 255, 0.08)',
                              border: 'none',
                              color: isSelected ? '#050810' : '#cbd5e1',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Scientific Attribution Footer */}
        <div style={{
          padding: '1rem',
          borderRadius: '10px',
          background: 'rgba(5, 8, 16, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.75rem',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}>
          <div>
            Data Source: <span style={{ color: '#94a3b8' }}>NASA/IPAC Infrared Science Archive (IRSA) · SPHEREx All-Sky Survey</span>
          </div>
          <div>
            Aperture Photometry Engine: <span style={{ color: '#00d4ff' }}>Astropy v7 & Photutils v3</span> · Attribution: <span style={{ color: '#cbd5e1' }}>NASA/SPHEREx and NASA/IPAC IRSA</span>
          </div>
        </div>

      </div>
    </div>
  );
}
