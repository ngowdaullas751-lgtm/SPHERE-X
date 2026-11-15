import { useState, useEffect, useRef } from 'react';
import {
  BarChart2, MapPin, Star, AlertCircle, Info, Layers, RefreshCw,
  Sliders, Compass, Eye, Sparkles, Download, ChevronLeft, ChevronRight,
  Filter, CheckCircle2, ShieldAlert, FileText, ArrowRight, Activity, Crosshair
} from 'lucide-react';
import Plotly from 'plotly.js-dist-min';
import { fetchSpectrum, fetchObservations } from '../services/api';

const PREDEFINED_TARGETS = [
  { name: 'WISE 0855', ra: 133.795129, dec: -7.245147, type: 'Y-Dwarf (Official Benchmark)', features: 'Deep CH4 (methane) & H2O absorption; low-opacity atmospheric window at 4.5 µm' },
  { name: "Barnard's Star", ra: 269.452075, dec: 4.693391, type: 'M-Dwarf High Proper Motion', features: 'Strong TiO & H2O molecular bands across near-IR' },
  { name: 'Epsilon Indi B', ra: 330.8403, dec: -56.7872, type: 'T-Dwarf Companion', features: 'Methane absorption at 1.66 µm & 2.20 µm; water vapor at 1.4 µm & 1.9 µm' },
  { name: 'RW Aurigae', ra: 75.7954, dec: 30.4013, type: 'T Tauri Star', features: 'Stellar photospheric continuum + warm circumstellar dust IR excess' },
  { name: 'R Draconis', ra: 271.1783, dec: 68.0417, type: 'Mira Giant Variable', features: 'Cool pulsating red giant with strong CO first-overtone bandhead at 2.3 µm' },
];

const LVF_ARRAYS = [
  { id: 'all', name: 'All 6 Arrays (102 Bands)', min: 0.75, max: 5.00, desc: 'Full SPHEREx Spectral Bandpass' },
  { id: 'b1', name: 'Array 1: 0.75 – 1.11 µm', min: 0.75, max: 1.11, desc: 'Detector 1 (Channels 1–16, R ~ 41)' },
  { id: 'b2', name: 'Array 2: 1.11 – 1.64 µm', min: 1.11, max: 1.64, desc: 'Detector 2 (Channels 17–32, R ~ 41)' },
  { id: 'b3', name: 'Array 3: 1.64 – 2.42 µm', min: 1.64, max: 2.42, desc: 'Detector 3 (Channels 33–48, R ~ 41)' },
  { id: 'b4', name: 'Array 4: 2.42 – 3.82 µm', min: 2.42, max: 3.82, desc: 'Detector 4 (Channels 49–66, R ~ 35)' },
  { id: 'b5', name: 'Array 5: 3.82 – 4.42 µm', min: 3.82, max: 4.42, desc: 'Detector 5 (Channels 67–86, R ~ 110–130 CO2 Ice)' },
  { id: 'b6', name: 'Array 6: 4.42 – 5.00 µm', min: 4.42, max: 5.00, desc: 'Detector 6 (Channels 87–102, R ~ 130 CO Fundamental)' },
];

export default function SpectrumPage() {
  const [selectedTarget, setSelectedTarget] = useState(PREDEFINED_TARGETS[0]);
  const [selectedArray, setSelectedArray] = useState('all');
  const [spectrumData, setSpectrumData] = useState(null);
  const [selectedChannelIdx, setSelectedChannelIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showErrorBars, setShowErrorBars] = useState(true);
  const [showFeatures, setShowFeatures] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareTarget, setCompareTarget] = useState(PREDEFINED_TARGETS[1]);
  const [compareSpectrumData, setCompareSpectrumData] = useState(null);
  const [availableObservations, setAvailableObservations] = useState([]);
  const [selectedObsId, setSelectedObsId] = useState('all');

  const chartContainerRef = useRef(null);

  // Load observations list for the selected target
  const loadTargetObservations = async (t) => {
    try {
      const res = await fetchObservations(t.ra, t.dec, 0.05, 'spherex_dr1');
      const obs = res.data?.observations || [];
      setAvailableObservations(obs);
    } catch (e) {
      console.warn('Could not load observations list:', e);
      setAvailableObservations([]);
    }
  };

  // Load calibrated spectrum
  const loadSpectrum = async (t, obsId = null) => {
    setLoading(true);
    setError(null);
    try {
      const queryObsId = obsId === 'all' ? null : obsId;
      const res = await fetchSpectrum(t.ra, t.dec, queryObsId);
      setSpectrumData(res.data);
      if (res.data?.channel_points?.length > 0) {
        setSelectedChannelIdx(0);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to retrieve calibrated SPHEREx spectrum.');
    } finally {
      setLoading(false);
    }
  };

  // Load secondary spectrum for comparison mode
  const loadCompareSpectrum = async (t) => {
    try {
      const res = await fetchSpectrum(t.ra, t.dec);
      setCompareSpectrumData(res.data);
    } catch (err) {
      console.warn('Compare spectrum failed:', err);
    }
  };

  useEffect(() => {
    setSelectedObsId('all');
    loadSpectrum(selectedTarget, 'all');
    loadTargetObservations(selectedTarget);
  }, [selectedTarget]);

  useEffect(() => {
    if (compareMode && compareTarget) {
      loadCompareSpectrum(compareTarget);
    }
  }, [compareMode, compareTarget]);

  // Handle specific observation epoch change
  const handleObservationChange = (obsId) => {
    setSelectedObsId(obsId);
    loadSpectrum(selectedTarget, obsId);
  };

  // Get current active channel point
  const channelPoints = spectrumData?.channel_points || [];
  const activeChannel = channelPoints[selectedChannelIdx] || null;

  // Render interactive Plotly spectrum chart
  useEffect(() => {
    if (!chartContainerRef.current || !spectrumData?.wavelengths?.length) return;

    let wavs = spectrumData.wavelengths;
    let fluxes = spectrumData.fluxes;
    let errors = spectrumData.flux_errors;
    let bands = spectrumData.bands || [];

    // Filter by LVF array if requested
    let filterMin = 0.75, filterMax = 5.0;
    const currentArrayObj = LVF_ARRAYS.find(a => a.id === selectedArray);
    if (currentArrayObj && selectedArray !== 'all') {
      filterMin = currentArrayObj.min;
      filterMax = currentArrayObj.max;
    }

    const filteredIndices = wavs
      .map((w, idx) => (w >= filterMin && w <= filterMax ? idx : -1))
      .filter(idx => idx !== -1);

    const fWavs = filteredIndices.map(idx => wavs[idx]);
    const fFluxes = filteredIndices.map(idx => fluxes[idx]);
    const fErrors = filteredIndices.map(idx => errors[idx]);
    const fBands = filteredIndices.map(idx => bands[idx] || '');

    // Primary SED trace
    const primaryTrace = {
      x: fWavs,
      y: fFluxes,
      error_y: showErrorBars ? {
        type: 'data',
        array: fErrors,
        visible: true,
        color: 'rgba(0, 212, 255, 0.45)',
        thickness: 1.2,
        width: 3,
      } : { visible: false },
      type: 'scatter',
      mode: 'lines+markers',
      line: {
        color: '#00d4ff',
        width: 2.4,
        shape: 'spline',
      },
      marker: {
        color: '#7c3aed',
        size: 6,
        line: { color: '#00d4ff', width: 1.2 },
      },
      name: `${selectedTarget.name} (${selectedObsId === 'all' ? 'All-Epoch SED' : selectedObsId.slice(0, 14)})`,
      hovertemplate:
        '<b>%{text}</b><br>' +
        'Wavelength λ: <b>%{x:.4f} µm</b><br>' +
        'Flux Density: <b>%{y:.4f} mJy</b><extra></extra>',
      text: fBands,
    };

    const traces = [primaryTrace];

    // Secondary comparison trace (if enabled)
    if (compareMode && compareSpectrumData?.wavelengths?.length) {
      const cWavs = compareSpectrumData.wavelengths;
      const cFluxes = compareSpectrumData.fluxes;
      const cFilteredIndices = cWavs
        .map((w, idx) => (w >= filterMin && w <= filterMax ? idx : -1))
        .filter(idx => idx !== -1);

      traces.push({
        x: cFilteredIndices.map(i => cWavs[i]),
        y: cFilteredIndices.map(i => cFluxes[i]),
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#f59e0b', width: 2.0, dash: 'dot', shape: 'spline' },
        marker: { color: '#d97706', size: 5 },
        name: `${compareTarget.name} (Comparison)`,
        hovertemplate: '<b>Comparison Target</b><br>Wavelength: %{x:.4f} µm<br>Flux: %{y:.4f} mJy<extra></extra>',
      });
    }

    // Selected Wavelength Indicator (Vertical Reticle line)
    const shapes = [];
    if (activeChannel && activeChannel.wavelength_um >= filterMin && activeChannel.wavelength_um <= filterMax) {
      shapes.push({
        type: 'line',
        x0: activeChannel.wavelength_um,
        x1: activeChannel.wavelength_um,
        y0: 0,
        y1: 1,
        yref: 'paper',
        line: {
          color: '#facc15',
          width: 2,
          dash: 'dash',
        },
      });
    }

    // Astrochemical Feature Annotations
    const annotations = [];
    if (showFeatures && spectrumData?.detected_features?.length) {
      spectrumData.detected_features.forEach((feat, i) => {
        if (feat.observed_wavelength_um >= filterMin && feat.observed_wavelength_um <= filterMax) {
          annotations.push({
            x: feat.observed_wavelength_um,
            y: feat.flux_mjy,
            text: feat.name,
            showarrow: true,
            arrowhead: 2,
            arrowsize: 1,
            arrowwidth: 1,
            arrowcolor: '#c084fc',
            ax: (i % 2 === 0 ? 20 : -20),
            ay: -35 - (i % 3) * 15,
            font: { size: 9, color: '#e9d5ff', family: 'Inter, sans-serif' },
            bgcolor: 'rgba(20, 10, 40, 0.85)',
            bordercolor: 'rgba(192, 132, 252, 0.4)',
            borderwidth: 1,
            borderpad: 3,
          });
        }
      });
    }

    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'rgba(5, 8, 16, 0.9)',
      font: { color: '#94a3b8', family: 'Inter, sans-serif' },
      margin: { l: 65, r: 35, t: 40, b: 65 },
      xaxis: {
        title: { text: 'Calibrated Wavelength λ (microns)', font: { color: '#00d4ff', size: 12 } },
        gridcolor: 'rgba(255, 255, 255, 0.06)',
        zerolinecolor: 'rgba(255, 255, 255, 0.1)',
        tickfont: { color: '#94a3b8' },
        range: [filterMin - 0.05, filterMax + 0.05],
      },
      yaxis: {
        title: { text: 'Flux Density F_λ (mJy)', font: { color: '#00d4ff', size: 12 } },
        gridcolor: 'rgba(255, 255, 255, 0.06)',
        zerolinecolor: 'rgba(255, 255, 255, 0.1)',
        tickfont: { color: '#94a3b8' },
      },
      autosize: true,
      hovermode: 'closest',
      shapes: shapes,
      annotations: annotations,
      legend: {
        orientation: 'h',
        y: 1.12,
        x: 0,
        font: { size: 11, color: '#e2e8f0' },
      },
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    };

    Plotly.newPlot(chartContainerRef.current, traces, layout, config);

    // Click handler on plot to select channel
    const plotEl = chartContainerRef.current;
    plotEl.on('plotly_click', (data) => {
      if (!data?.points?.length) return;
      const clickedX = data.points[0].x;
      // Find closest channel point
      let bestIdx = 0;
      let minDiff = floatDiff(clickedX, channelPoints[0]?.wavelength_um);
      for (let i = 1; i < channelPoints.length; i++) {
        const diff = floatDiff(clickedX, channelPoints[i].wavelength_um);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = i;
        }
      }
      setSelectedChannelIdx(bestIdx);
    });

    return () => {
      if (chartContainerRef.current) {
        Plotly.purge(chartContainerRef.current);
      }
    };
  }, [spectrumData, selectedArray, showErrorBars, showFeatures, compareMode, compareSpectrumData, selectedTarget, selectedChannelIdx, activeChannel]);

  const floatDiff = (a, b) => Math.abs((a || 0) - (b || 0));

  // Export Calibrated Data to CSV
  const handleExportCSV = () => {
    if (!spectrumData) return;
    const csvContent = spectrumData.metadata?.csv_export || generateFallbackCSV(spectrumData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SPHEREx_${selectedTarget.name.replace(/[^a-zA-Z0-9]/g, '_')}_102Bands_Spectrum.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Full JSON Structure
  const handleExportJSON = () => {
    if (!spectrumData) return;
    const blob = new Blob([JSON.stringify(spectrumData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SPHEREx_${selectedTarget.name.replace(/[^a-zA-Z0-9]/g, '_')}_Spectrum.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateFallbackCSV = (data) => {
    const lines = [
      '# Target: ' + selectedTarget.name,
      '# Channel,Wavelength_um,Flux_mJy,Flux_Error_mJy,Band',
    ];
    (data.wavelengths || []).forEach((w, i) => {
      lines.push(`${i + 1},${w},${data.fluxes?.[i] || 0},${data.flux_errors?.[i] || 0},${data.bands?.[i] || ''}`);
    });
    return lines.join('\n');
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '3rem', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1350px', margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00d4ff', fontSize: '0.85rem', marginBottom: '4px' }}>
            <BarChart2 size={16} />
            <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>102-Band Spectrophotometric Energy Distribution</span>
          </div>
          <h1 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
            fontWeight: 700,
            color: '#00d4ff',
            textShadow: '0 0 20px rgba(0, 212, 255, 0.35)',
            marginBottom: '0.5rem',
          }}>
            102-Band SPHEREx Spectral Explorer
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '850px', lineHeight: '1.5' }}>
            SPHEREx observes every sky position across 102 contiguous infrared bands (0.75 – 5.00 µm) using 6 Linear Variable Filter arrays.
            Explore authentic calibrated spectrophotometry, inspect molecular absorption fingerprints (CO2 ice, water ice, methane), and examine multi-wavelength FITS images.
          </p>
        </div>

        {/* Target Selector */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Star size={13} style={{ color: '#f59e0b' }} /> Official NASA Benchmark Science Targets:
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
                    background: active ? 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(124,58,237,0.25))' : 'rgba(10,15,30,0.8)',
                    border: active ? '1px solid #00d4ff' : '1px solid rgba(0,212,255,0.2)',
                    color: active ? '#00d4ff' : '#94a3b8',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <MapPin size={12} style={{ color: active ? '#00d4ff' : '#64748b' }} />
                  <span style={{ fontWeight: active ? 600 : 400 }}>{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Observation Epoch & Comparison Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          background: 'rgba(10, 15, 30, 0.7)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          marginBottom: '1.25rem',
        }}>
          {/* Observation Epoch Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={14} style={{ color: '#00d4ff' }} /> Observation Epoch:
            </span>
            <select
              value={selectedObsId}
              onChange={(e) => handleObservationChange(e.target.value)}
              style={{
                background: '#050810',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                color: '#67e8f9',
                fontSize: '0.78rem',
                padding: '4px 10px',
                borderRadius: '6px',
              }}
            >
              <option value="all">All-Epoch Calibrated SED Compilation ({spectrumData?.channels_observed || 102} Bands)</option>
              {availableObservations.slice(0, 20).map((obs, idx) => (
                <option key={obs.obs_id || idx} value={obs.obs_id}>
                  Visit #{idx + 1}: {obs.date?.slice(0, 10)} [{obs.band}] ({obs.obs_id?.slice(0, 18)}...)
                </option>
              ))}
            </select>
          </div>

          {/* Comparison Mode & Export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={compareMode}
                onChange={(e) => setCompareMode(e.target.checked)}
                style={{ accentColor: '#f59e0b' }}
              />
              Compare with Target:
            </label>

            {compareMode && (
              <select
                value={compareTarget?.name}
                onChange={(e) => setCompareTarget(PREDEFINED_TARGETS.find(t => t.name === e.target.value))}
                style={{
                  background: '#050810',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#f59e0b',
                  fontSize: '0.75rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                }}
              >
                {PREDEFINED_TARGETS.filter(t => t.name !== selectedTarget.name).map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            )}

            {/* Scientific Export Buttons */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleExportCSV}
                title="Download 12-column calibrated spectrophotometry CSV table"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(0, 212, 255, 0.15)',
                  border: '1px solid rgba(0, 212, 255, 0.35)',
                  color: '#00d4ff',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Download size={12} /> CSV
              </button>
              <button
                onClick={handleExportJSON}
                title="Download full scientific JSON payload with FITS metadata"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(124, 58, 237, 0.15)',
                  border: '1px solid rgba(124, 58, 237, 0.35)',
                  color: '#c084fc',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <FileText size={12} /> JSON
              </button>
            </div>
          </div>
        </div>

        {/* Array Filter Buttons & Plot Controls */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          background: 'rgba(10, 15, 30, 0.75)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          marginBottom: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Filter LVF Array:</span>
            {LVF_ARRAYS.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedArray(a.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  background: selectedArray === a.id ? 'rgba(0, 212, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  border: selectedArray === a.id ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: selectedArray === a.id ? '#00d4ff' : '#94a3b8',
                  fontWeight: selectedArray === a.id ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {a.id === 'all' ? 'All (0.75-5.0µm)' : `D${a.id.slice(1)} (${a.min}-${a.max}µm)`}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showErrorBars}
                onChange={(e) => setShowErrorBars(e.target.checked)}
                style={{ accentColor: '#00d4ff' }}
              />
              1-σ Uncertainty Bars
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showFeatures}
                onChange={(e) => setShowFeatures(e.target.checked)}
                style={{ accentColor: '#c084fc' }}
              />
              Molecular Fingerprints
            </label>
          </div>
        </div>

        {/* Main Spectral Graph */}
        <div style={{
          borderRadius: '16px',
          background: 'rgba(10, 15, 30, 0.85)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          padding: '1.25rem',
          marginBottom: '1.25rem',
          boxShadow: '0 0 30px rgba(0, 212, 255, 0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', fontSize: '0.88rem' }}>
              SPECTRAL FLUX DENSITY: {selectedTarget.name.toUpperCase()}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#a78bfa' }}>
              Click any point on graph or scrub slider below to inspect FITS image at that wavelength
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '6rem 0', color: '#64748b' }}>
              <div className="animate-spin" style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(0,212,255,0.2)',
                borderTopColor: '#00d4ff',
                borderRadius: '50%',
                margin: '0 auto 12px',
              }} />
              <span style={{ color: '#00d4ff', fontSize: '0.88rem' }}>Extracting 102-Band SPHEREx Spectral WCS & Calibrated Fluxes…</span>
            </div>
          ) : (
            <div
              ref={chartContainerRef}
              style={{ width: '100%', height: '420px' }}
            />
          )}
        </div>

        {/* Wavelength Slider & Channel Navigation */}
        {channelPoints.length > 0 && (
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            background: 'rgba(10, 15, 30, 0.8)',
            border: '1px solid rgba(250, 204, 21, 0.3)',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={16} style={{ color: '#facc15' }} />
                <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: '#facc15' }}>
                  WAVELENGTH CHANNEL SELECTOR:
                </span>
                <span style={{ color: '#e2e8f0', fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 600 }}>
                  Channel #{selectedChannelIdx + 1} of {channelPoints.length} (λ = {activeChannel?.wavelength_um.toFixed(4)} µm)
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setSelectedChannelIdx(Math.max(0, selectedChannelIdx - 1))}
                  disabled={selectedChannelIdx === 0}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '5px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: selectedChannelIdx === 0 ? '#475569' : '#e2e8f0',
                    cursor: selectedChannelIdx === 0 ? 'default' : 'pointer',
                    fontSize: '0.72rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <ChevronLeft size={14} /> Prev Band
                </button>
                <button
                  onClick={() => setSelectedChannelIdx(Math.min(channelPoints.length - 1, selectedChannelIdx + 1))}
                  disabled={selectedChannelIdx === channelPoints.length - 1}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '5px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: selectedChannelIdx === channelPoints.length - 1 ? '#475569' : '#e2e8f0',
                    cursor: selectedChannelIdx === channelPoints.length - 1 ? 'default' : 'pointer',
                    fontSize: '0.72rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  Next Band <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min="0"
              max={channelPoints.length - 1}
              value={selectedChannelIdx}
              onChange={(e) => setSelectedChannelIdx(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#facc15', cursor: 'pointer' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '4px', fontFamily: 'monospace' }}>
              <span>D1: 0.75 µm</span>
              <span>D2: 1.11 µm</span>
              <span>D3: 1.64 µm</span>
              <span>D4: 2.42 µm</span>
              <span>D5: 3.82 µm</span>
              <span>D6: 5.00 µm</span>
            </div>
          </div>
        )}

        {/* 2-Column Section: Corresponding Wavelength FITS Image & Astrometric Channel Inspector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>

          {/* Left: Real FITS Cutout Image at Selected Wavelength */}
          <div style={{
            borderRadius: '14px',
            background: 'rgba(10, 15, 30, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            padding: '1.25rem',
            boxShadow: '0 0 25px rgba(0, 212, 255, 0.08)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', color: '#00d4ff' }}>
                FITS IMAGE AT λ = {activeChannel?.wavelength_um.toFixed(3) || '—'} µm
              </span>
              <span style={{
                fontSize: '0.68rem',
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'rgba(0, 212, 255, 0.15)',
                color: '#67e8f9',
                border: '1px solid rgba(0, 212, 255, 0.3)',
              }}>
                {activeChannel?.band_name || 'SPHEREx Band'}
              </span>
            </div>

            <div style={{
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '280px',
              position: 'relative',
            }}>
              {(activeChannel?.image_b64 || availableObservations.find(o => o.image_base64)?.image_base64) ? (
                <>
                  <img
                    src={`data:image/png;base64,${activeChannel?.image_b64 || availableObservations.find(o => o.image_base64)?.image_base64}`}
                    alt={`SPHEREx Cutout at ${activeChannel?.wavelength_um || '—'} um`}
                    style={{ width: '100%', height: 'auto', display: 'block', imageRendering: 'pixelated' }}
                  />
                  {/* Central Reticle Crosshairs */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Crosshair size={32} style={{ color: 'rgba(250, 204, 21, 0.85)' }} />
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    background: 'rgba(5, 8, 16, 0.85)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    color: '#facc15',
                    fontFamily: 'monospace',
                  }}>
                    Target: ({selectedTarget.ra.toFixed(4)}°, {selectedTarget.dec.toFixed(4)}°)
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                  <Eye size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <span style={{ fontSize: '0.8rem' }}>FITS image preview synthesizing for this band…</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
              <span>Aperture: 3×3 pixels centered on target</span>
              <span>Detector scale: 6.15"/pixel</span>
            </div>
          </div>

          {/* Right: Comprehensive Spectral Channel Inspector */}
          <div style={{
            borderRadius: '14px',
            background: 'rgba(10, 15, 30, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            padding: '1.25rem',
            boxShadow: '0 0 25px rgba(0, 212, 255, 0.08)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'rgba(250, 204, 21, 0.2)',
                  color: '#facc15',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'inline-block',
                  marginBottom: '4px',
                }}>
                  CHANNEL #{activeChannel?.channel_index || (selectedChannelIdx + 1)}
                </span>
                <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', color: '#e2e8f0', margin: 0 }}>
                  λ = {activeChannel?.wavelength_um.toFixed(4) || '—'} µm
                </h3>
              </div>

              <span style={{
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '0.7rem',
                fontWeight: 600,
                background: activeChannel?.quality_status === 'VALID_CALIBRATED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: activeChannel?.quality_status === 'VALID_CALIBRATED' ? '#6ee7b7' : '#fca5a5',
                border: '1px solid currentColor',
              }}>
                {activeChannel?.quality_status || 'VALID_CALIBRATED'}
              </span>
            </div>

            {/* Quantitative Astrometric Measurements Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
              <div style={{ background: 'rgba(5, 8, 16, 0.75)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Flux Density (F_λ)</span>
                <strong style={{ color: '#00d4ff', fontSize: '1.05rem', fontFamily: 'monospace' }}>
                  {activeChannel?.flux_mjy.toFixed(3) || '—'}
                </strong>
                <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>
                  ± {activeChannel?.flux_error.toFixed(3) || '0.02'} mJy
                </span>
              </div>

              <div style={{ background: 'rgba(5, 8, 16, 0.75)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Surface Brightness (I_λ)</span>
                <strong style={{ color: '#c084fc', fontSize: '1.05rem', fontFamily: 'monospace' }}>
                  {activeChannel?.flux_mjy_sr.toFixed(3) || '—'}
                </strong>
                <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>
                  MJy / steradian
                </span>
              </div>

              <div style={{ background: 'rgba(5, 8, 16, 0.75)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Signal-to-Noise (SNR)</span>
                <strong style={{ color: '#10b981', fontSize: '1.05rem', fontFamily: 'monospace' }}>
                  {activeChannel?.snr.toFixed(1) || '—'} σ
                </strong>
                <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>
                  Photometric significance
                </span>
              </div>
            </div>

            {/* Instrument & Calibration Specifications */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.75rem', marginBottom: '12px' }}>
              <div style={{ background: 'rgba(5, 8, 16, 0.5)', padding: '8px', borderRadius: '6px' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem' }}>Channel Bandwidth (FWHM)</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                  Δλ = {activeChannel?.fwhm_um.toFixed(4) || '0.0400'} µm (R ≈ {activeChannel ? Math.round(activeChannel.wavelength_um / activeChannel.fwhm_um) : 41})
                </span>
              </div>
              <div style={{ background: 'rgba(5, 8, 16, 0.5)', padding: '8px', borderRadius: '6px' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem' }}>Detector Array</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                  SPHEREx Detector {activeChannel?.detector || 1} (LVF Mounted)
                </span>
              </div>
              <div style={{ background: 'rgba(5, 8, 16, 0.5)', padding: '8px', borderRadius: '6px' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem' }}>Observation Timestamp</span>
                <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
                  {activeChannel?.date_obs || '2025-05-05'}
                </span>
              </div>
              <div style={{ background: 'rgba(5, 8, 16, 0.5)', padding: '8px', borderRadius: '6px' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem' }}>Observation Identifier</span>
                <span style={{ color: '#00d4ff', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                  {activeChannel?.obs_id || 'SPX-OBS'}
                </span>
              </div>
            </div>

            {/* Spectral Summary & Source Attribution */}
            <div style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              fontSize: '0.74rem',
              color: '#67e8f9',
              lineHeight: '1.4',
            }}>
              <strong>Coverage:</strong> {spectrumData?.spectral_coverage_summary || '102 nominal SPHEREx near-IR channels.'}
            </div>
          </div>
        </div>

        {/* Diagnostic Molecular Absorption Physics Reference */}
        <div style={{
          borderRadius: '12px',
          background: 'rgba(10, 15, 30, 0.75)',
          border: '1px solid rgba(124, 58, 237, 0.25)',
          padding: '1.25rem',
        }}>
          <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: '#a78bfa', marginBottom: '0.75rem' }}>
            SPHEREx SPECTROSCOPIC DIAGNOSTICS & ASTROCHEMICAL FINGERPRINTS
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', fontSize: '0.78rem' }}>
            <div style={{ background: 'rgba(5, 8, 16, 0.6)', padding: '10px', borderRadius: '8px' }}>
              <span style={{ color: '#00d4ff', fontWeight: 600, display: 'block' }}>1.4 µm & 1.9 µm (H2O Vapor)</span>
              <span style={{ color: '#94a3b8' }}>Stellar and planetary water absorption troughs diagnostic of cool stellar photospheres.</span>
            </div>
            <div style={{ background: 'rgba(5, 8, 16, 0.6)', padding: '10px', borderRadius: '8px' }}>
              <span style={{ color: '#00d4ff', fontWeight: 600, display: 'block' }}>1.66 µm & 2.20 µm (CH4 Methane)</span>
              <span style={{ color: '#94a3b8' }}>Methane absorption bands distinguishing T- and Y-substellar brown dwarfs (e.g. WISE 0855).</span>
            </div>
            <div style={{ background: 'rgba(5, 8, 16, 0.6)', padding: '10px', borderRadius: '8px' }}>
              <span style={{ color: '#00d4ff', fontWeight: 600, display: 'block' }}>3.05 µm (H2O Water Ice Mantles)</span>
              <span style={{ color: '#94a3b8' }}>Broad interstellar and protoplanetary water ice feature; core SPHEREx cosmic ices objective.</span>
            </div>
            <div style={{ background: 'rgba(5, 8, 16, 0.6)', padding: '10px', borderRadius: '8px' }}>
              <span style={{ color: '#00d4ff', fontWeight: 600, display: 'block' }}>4.26 µm & 4.67 µm (CO2 / CO Ice & Gas)</span>
              <span style={{ color: '#94a3b8' }}>Solid CO2 ice absorption mapped with high resolving power (R~130) by SPHEREx Detector Band 5.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
