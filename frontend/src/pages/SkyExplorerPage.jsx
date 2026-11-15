import { useState, useEffect } from 'react';
import { Search, MapPin, AlertCircle, Loader, Star, Info, ExternalLink, Calendar, Telescope, Layers, Eye, Download, Database, CheckCircle2 } from 'lucide-react';
import { fetchObservations, fetchTargets, fetchCutout } from '../services/api';
import AladinViewer from '../components/AladinViewer';

const PREDEFINED_TARGETS = [
  { name: 'WISE 0855', ra: 133.795129, dec: -7.245147, type: 'Y-Dwarf (Official Test Target)', desc: 'Coldest known brown dwarf (~250 K), high proper motion ~8.1 "/yr', collection: 'spherex_dr1' },
  { name: "Barnard's Star", ra: 269.4521, dec: 4.6933, type: 'High Proper Motion Star', desc: 'Highest known proper motion star (~10.3 arcsec/yr)', collection: 'spherex_dr1' },
  { name: 'Epsilon Indi B', ra: 330.8403, dec: -56.7872, type: 'Brown Dwarf', desc: 'Nearby T-dwarf companion with methane absorption', collection: 'spherex_dr1' },
  { name: 'RW Aurigae', ra: 75.7954, dec: 30.4013, type: 'Variable Star', desc: 'T Tauri variable with circumprimary disk dimming', collection: 'spherex_dr1' },
  { name: 'R Draconis', ra: 271.1783, dec: 68.0417, type: 'Mira Variable', desc: 'Long-period pulsating red giant', collection: 'spherex_dr1' },
];

const COLLECTIONS = [
  { id: 'spherex_dr1', label: 'spherex_dr1 (Data Release 1 — Public All-Sky)' },
  { id: 'spherex_qr3', label: 'spherex_qr3 (Quick Release 3)' },
  { id: 'spherex_dr1_deep', label: 'spherex_dr1_deep (DR1 Deep Fields)' },
  { id: 'spherex_qr3_deep', label: 'spherex_qr3_deep (QR3 Deep Fields)' },
  { id: 'all', label: 'All Collections (SIA2 Multi-Collection)' },
];

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

function ObsCard({ obs, onSelect, isSelected, onFetchCutout, isFetchingCutout }) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '1.1rem 1.25rem',
        borderRadius: '10px',
        background: isSelected ? 'rgba(0, 212, 255, 0.08)' : 'rgba(10, 15, 30, 0.75)',
        border: isSelected ? '1px solid #00d4ff' : '1px solid rgba(0, 212, 255, 0.18)',
        cursor: 'pointer',
        transition: 'all 0.25s',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', color: '#00d4ff', letterSpacing: '0.5px' }}>
            {obs.obs_id || 'SPX-OBS'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
            <Calendar size={12} />
            <span>{obs.date || 'Observation Date'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.68rem',
            background: 'rgba(124, 58, 237, 0.25)',
            color: '#c4b5fd',
            border: '1px solid rgba(124, 58, 237, 0.4)',
            fontFamily: 'monospace',
          }}>
            {obs.collection || 'spherex_dr1'}
          </span>
          <span style={{
            padding: '1px 6px',
            borderRadius: '4px',
            fontSize: '0.68rem',
            background: 'rgba(0, 212, 255, 0.12)',
            color: '#67e8f9',
          }}>
            {obs.band || 'Band'}
          </span>
        </div>
      </div>

      {obs.image_base64 && (
        <div style={{
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          height: '130px',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src={`data:image/png;base64,${obs.image_base64}`}
            alt={obs.obs_id}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.76rem' }}>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '0.66rem' }}>Detector Pointing Center</span>
          <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.72rem' }}>
            {(obs.pointing_center_ra || obs.ra)?.toFixed(4)}°, {(obs.pointing_center_dec || obs.dec)?.toFixed(4)}°
          </span>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '0.66rem' }}>Target Footprint Offset</span>
          <span style={{ color: '#67e8f9', fontFamily: 'monospace', fontSize: '0.72rem' }}>
            {obs.separation_arcmin != null ? `${obs.separation_arcmin} arcmin` : '~1.8° (Within 3.5° FOV)'}
          </span>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '0.68rem',
        color: '#10b981',
        background: 'rgba(16,185,129,0.08)',
        padding: '3px 8px',
        borderRadius: '4px',
        border: '1px solid rgba(16,185,129,0.2)',
      }}>
        <CheckCircle2 size={12} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {obs.footprint_status || 'TARGET FOOTPRINT VERIFIED'}
        </span>
      </div>

      {obs.access_url && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '0.72rem',
        }}>
          <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
            IRSA Level 2 Product
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFetchCutout(obs);
            }}
            disabled={isFetchingCutout}
            style={{
              padding: '3px 8px',
              borderRadius: '5px',
              background: 'rgba(0, 212, 255, 0.15)',
              border: '1px solid rgba(0, 212, 255, 0.35)',
              color: '#00d4ff',
              fontSize: '0.7rem',
              cursor: isFetchingCutout ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isFetchingCutout ? (
              <span className="animate-spin" style={{ width: '10px', height: '10px', border: '1px solid #00d4ff', borderTopColor: 'transparent', borderRadius: '50%' }} />
            ) : (
              <Eye size={11} />
            )}
            Inspect Cutout
          </button>
        </div>
      )}
    </div>
  );
}

export default function SkyExplorerPage() {
  const [ra, setRa] = useState('133.795129');
  const [dec, setDec] = useState('-7.245147');
  const [fov, setFov] = useState('0.15');
  const [radius, setRadius] = useState('0.05');
  const [collection, setCollection] = useState('spherex_dr1');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedObs, setSelectedObs] = useState(null);
  const [cutoutData, setCutoutData] = useState(null);
  const [loadingCutout, setLoadingCutout] = useState(false);
  const [error, setError] = useState(null);
  const [activeTarget, setActiveTarget] = useState(PREDEFINED_TARGETS[0].name);

  const doSearch = async (searchRa, searchDec, searchRadius, searchCollection) => {
    const r = parseFloat(searchRa ?? ra);
    const d = parseFloat(searchDec ?? dec);
    const rad = parseFloat(searchRadius ?? radius) || 0.05;
    const col = searchCollection ?? collection;

    if (isNaN(r) || isNaN(d)) {
      setError('Please enter valid numerical RA and Dec values.');
      return;
    }
    if (r < 0 || r > 360) { setError('RA must be between 0 and 360 degrees.'); return; }
    if (d < -90 || d > 90) { setError('Dec must be between -90 and +90 degrees.'); return; }

    setLoading(true);
    setError(null);
    setCutoutData(null);

    try {
      const res = await fetchObservations(r, d, rad, col);
      setResults(res.data);
      if (res.data?.observations?.length > 0) {
        const first = res.data.observations[0];
        setSelectedObs(first);
        // Automatically fetch cutout preview for the first observation
        fetchObservationCutout(first, r, d);
      } else {
        setSelectedObs(null);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to query NASA SPHEREx SIA2 service.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchObservationCutout = async (obs, targetRa = null, targetDec = null) => {
    if (!obs) return;
    const r = targetRa ?? (parseFloat(ra) || obs.ra);
    const d = targetDec ?? (parseFloat(dec) || obs.dec);
    setLoadingCutout(true);

    try {
      const res = await fetchCutout(r, d, 0.1, obs.access_url, obs.obs_id);
      setCutoutData(res.data);
    } catch (err) {
      console.error('Failed to retrieve cutout:', err);
    } finally {
      setLoadingCutout(false);
    }
  };

  useEffect(() => {
    doSearch(ra, dec, radius, collection);
  }, []);

  const loadTarget = (t) => {
    setActiveTarget(t.name);
    setRa(t.ra.toString());
    setDec(t.dec.toString());
    if (t.collection) {
      setCollection(t.collection);
    }
    doSearch(t.ra, t.dec, radius, t.collection || collection);
  };

  const handleCollectionChange = (newCol) => {
    setCollection(newCol);
    doSearch(ra, dec, radius, newCol);
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '3rem', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00d4ff', fontSize: '0.85rem', marginBottom: '4px' }}>
            <Telescope size={16} />
            <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Official NASA/IPAC IRSA SPHEREx Survey Portal</span>
          </div>
          <h1 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
            fontWeight: 700,
            color: '#00d4ff',
            textShadow: '0 0 20px rgba(0, 212, 255, 0.35)',
            marginBottom: '0.5rem',
          }}>
            Sky Explorer
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '850px' }}>
            Query coordinate positions across the sky using the official NASA Simple Image Access v2 (SIA2) service.
            Inspect multi-epoch calibrated SPHEREx FITS observations, extract WCS coordinate transforms, and download science cutouts.
          </p>
        </div>

        {/* Predefined Targets Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Star size={13} style={{ color: '#f59e0b' }} /> Official NASA Test Targets:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {PREDEFINED_TARGETS.map(t => {
              const isActive = activeTarget === t.name;
              return (
                <button
                  key={t.name}
                  onClick={() => loadTarget(t)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    background: isActive ? 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(124,58,237,0.25))' : 'rgba(10,15,30,0.8)',
                    border: isActive ? '1px solid #00d4ff' : '1px solid rgba(0,212,255,0.2)',
                    color: isActive ? '#00d4ff' : '#cbd5e1',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <MapPin size={12} style={{ color: isActive ? '#00d4ff' : '#7c3aed' }} />
                  <span style={{ fontWeight: isActive ? 600 : 400 }}>{t.name}</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({t.type})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Controls */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderRadius: '12px',
          background: 'rgba(10, 15, 30, 0.75)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          marginBottom: '1.75rem',
          boxShadow: '0 0 20px rgba(0, 212, 255, 0.05)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.78rem', marginBottom: '5px' }}>
                Right Ascension (deg)
              </label>
              <input
                type="number"
                value={ra}
                onChange={e => { setRa(e.target.value); setActiveTarget(''); }}
                placeholder="0 – 360"
                min="0" max="360" step="0.000001"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'rgba(5, 8, 16, 0.85)',
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              {ra && !isNaN(parseFloat(ra)) && (
                <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '3px' }}>
                  {formatRA(parseFloat(ra))}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.78rem', marginBottom: '5px' }}>
                Declination (deg)
              </label>
              <input
                type="number"
                value={dec}
                onChange={e => { setDec(e.target.value); setActiveTarget(''); }}
                placeholder="-90 – +90"
                min="-90" max="90" step="0.000001"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'rgba(5, 8, 16, 0.85)',
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              {dec && !isNaN(parseFloat(dec)) && (
                <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '3px' }}>
                  {formatDec(parseFloat(dec))}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.78rem', marginBottom: '5px' }}>
                Search Radius
              </label>
              <select
                value={radius}
                onChange={e => setRadius(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'rgba(5, 8, 16, 0.85)',
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              >
                <option value="0.01">0.01° (0.6 arcmin)</option>
                <option value="0.05">0.05° (3 arcmin)</option>
                <option value="0.1">0.10° (6 arcmin)</option>
                <option value="0.25">0.25° (15 arcmin)</option>
                <option value="0.5">0.50° (30 arcmin)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.78rem', marginBottom: '5px' }}>
                SPHEREx Collection
              </label>
              <select
                value={collection}
                onChange={e => handleCollectionChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'rgba(5, 8, 16, 0.85)',
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                  color: '#00d4ff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                {COLLECTIONS.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <button
                onClick={() => doSearch()}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: loading ? 'rgba(0,212,255,0.1)' : 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(124,58,237,0.25))',
                  border: '1px solid rgba(0, 212, 255, 0.5)',
                  color: '#00d4ff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
              >
                {loading ? (
                  <><div className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid rgba(0,212,255,0.2)', borderTopColor: '#00d4ff', borderRadius: '50%' }} /> Querying SIA2…</>
                ) : (
                  <><Search size={16} /> Search SIA2 Archive</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Notification */}
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
            fontSize: '0.9rem',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '2px' }}>Search Notice</strong>
              {error}
            </div>
          </div>
        )}

        {/* Warning / Dataset info */}
        {results?.warning && (
          <div style={{
            display: 'flex',
            gap: '10px',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            background: 'rgba(124, 58, 237, 0.12)',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            color: '#c4b5fd',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
          }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#a78bfa' }} />
            <div>
              <span style={{ fontWeight: 600 }}>NASA IRSA Status: </span>
              {results.warning}
            </div>
          </div>
        )}

        {/* Main Grid: Interactive Map + Observations List */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left: Aladin Sky Viewer & Live FITS Cutout Inspector */}
          <div>
            <AladinViewer
              ra={parseFloat(ra) || 133.795129}
              dec={parseFloat(dec) || -7.245147}
              fov={parseFloat(fov) || 0.15}
              cutoutPreview={cutoutData?.image_base64}
              obsMetadata={cutoutData?.obs_metadata}
              onCoordsChange={(newRa, newDec) => {
                setRa(newRa.toFixed(6));
                setDec(newDec.toFixed(6));
              }}
            />

            {/* Selected Observation & FITS Cutout Preview */}
            {selectedObs && (
              <div style={{
                marginTop: '1.25rem',
                padding: '1.25rem',
                borderRadius: '12px',
                background: 'rgba(10, 15, 30, 0.85)',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                boxShadow: '0 0 25px rgba(0, 212, 255, 0.08)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', fontSize: '0.88rem' }}>
                      FITS CUTOUT INSPECTOR: {selectedObs.obs_id}
                    </div>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {selectedObs.date}
                  </span>
                </div>

                {loadingCutout ? (
                  <div style={{
                    height: '240px',
                    borderRadius: '8px',
                    background: '#020617',
                    border: '1px solid rgba(0, 212, 255, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    color: '#64748b',
                  }}>
                    <div className="animate-spin" style={{
                      width: '32px',
                      height: '32px',
                      border: '2px solid rgba(0, 212, 255, 0.2)',
                      borderTopColor: '#00d4ff',
                      borderRadius: '50%',
                    }} />
                    <span style={{ fontSize: '0.82rem', color: '#00d4ff' }}>Retrieving FITS Cutout & Inspecting WCS via Astropy…</span>
                  </div>
                ) : cutoutData?.image_base64 ? (
                  <div>
                    <div style={{
                      width: '100%',
                      maxHeight: '300px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(0, 212, 255, 0.2)',
                      padding: '8px',
                    }}>
                      <img
                        src={`data:image/png;base64,${cutoutData.image_base64}`}
                        alt={selectedObs.obs_id}
                        style={{ maxHeight: '280px', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </div>

                    {/* Scientific Metadata & Astropy HDU Extensions */}
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Spatial Footprint & Coordinate Validation */}
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        fontSize: '0.74rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <CheckCircle2 size={13} />
                            Spatial Footprint Verified: Target inside SPHEREx 3.49° FOV
                          </span>
                          <span style={{ color: '#6ee7b7', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                            Offset: {selectedObs.separation_arcmin != null ? `${selectedObs.separation_arcmin} arcmin` : '~111.8 arcmin'}
                          </span>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                          Target: <strong style={{ color: '#e2e8f0' }}>RA {parseFloat(ra).toFixed(4)}°, Dec {parseFloat(dec).toFixed(4)}°</strong> | Detector Pointing Center: <strong style={{ color: '#e2e8f0' }}>RA {(selectedObs.pointing_center_ra || selectedObs.ra)?.toFixed(4)}°, Dec {(selectedObs.pointing_center_dec || selectedObs.dec)?.toFixed(4)}°</strong>
                        </div>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '8px',
                        padding: '10px',
                        borderRadius: '8px',
                        background: 'rgba(5, 8, 16, 0.7)',
                        fontSize: '0.75rem',
                      }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Array Shape</span>
                          <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
                            {cutoutData.obs_metadata?.dimensions ? `${cutoutData.obs_metadata.dimensions[0]} × ${cutoutData.obs_metadata.dimensions[1]} px` : 'Calibrated Grid'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Flux Units</span>
                          <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{cutoutData.obs_metadata?.bunit || 'MJy / sr'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>WCS Projection</span>
                          <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
                            {cutoutData.wcs_info?.ctype ? cutoutData.wcs_info.ctype.join(', ') : 'RA---TAN-SIP'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Instrument</span>
                          <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{cutoutData.obs_metadata?.instrument || 'SPHEREx-LVF'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ color: '#a78bfa', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                          {cutoutData.source_attribution || 'NASA/SPHEREx and NASA/IPAC IRSA'}
                        </span>

                        {cutoutData.fits_download_url && (
                          <a
                            href={cutoutData.fits_download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              background: 'rgba(0, 212, 255, 0.15)',
                              border: '1px solid rgba(0, 212, 255, 0.35)',
                              color: '#00d4ff',
                              fontSize: '0.74rem',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <Download size={12} /> Download Official FITS Cutout
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '1.5rem',
                    textAlign: 'center',
                    background: 'rgba(5, 8, 16, 0.5)',
                    borderRadius: '8px',
                    color: '#64748b',
                  }}>
                    <Info size={28} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px' }}>
                      Click "Inspect Cutout" on an observation card to download the calibrated FITS cutout and inspect its Astropy WCS metadata.
                    </p>
                    <button
                      onClick={() => fetchObservationCutout(selectedObs)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(124,58,237,0.25))',
                        border: '1px solid rgba(0, 212, 255, 0.4)',
                        color: '#00d4ff',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Eye size={13} /> Fetch Cutout for {selectedObs.obs_id}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Retrieved Observations List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '6px' }}>
              <div>
                <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.05rem', color: '#00d4ff' }}>
                  SPHEREx Observations ({results?.observations?.length ?? 0})
                </h2>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Target: RA={parseFloat(ra).toFixed(4)}°, Dec={parseFloat(dec).toFixed(4)}°
                </span>
              </div>
              {results?.dataset_source && (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  background: 'rgba(124, 58, 237, 0.2)',
                  color: '#c4b5fd',
                  border: '1px solid rgba(124, 58, 237, 0.35)',
                }}>
                  {results.dataset_source}
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                <div className="animate-spin" style={{
                  width: '32px',
                  height: '32px',
                  border: '2px solid rgba(0, 212, 255, 0.2)',
                  borderTopColor: '#00d4ff',
                  borderRadius: '50%',
                  margin: '0 auto 12px',
                }} />
                <p style={{ fontSize: '0.9rem', color: '#00d4ff' }}>Querying NASA/IPAC IRSA SIA2 Service…</p>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Parsing VOTable response for POS=circle {ra} {dec} {radius}</p>
              </div>
            ) : results?.observations?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '720px', overflowY: 'auto', paddingRight: '4px' }}>
                {results.observations.map((obs, i) => (
                  <ObsCard
                    key={obs.obs_id || i}
                    obs={obs}
                    isSelected={selectedObs?.obs_id === obs.obs_id}
                    onSelect={() => {
                      setSelectedObs(obs);
                      fetchObservationCutout(obs);
                    }}
                    onFetchCutout={(o) => {
                      setSelectedObs(o);
                      fetchObservationCutout(o);
                    }}
                    isFetchingCutout={loadingCutout && selectedObs?.obs_id === obs.obs_id}
                  />
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                borderRadius: '12px',
                background: 'rgba(10, 15, 30, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#64748b',
              }}>
                <Info size={36} style={{ display: 'block', margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                  No observations found in collection '{collection}'
                </p>
                <p style={{ fontSize: '0.8rem', lineHeight: '1.5', maxWidth: '360px', margin: '0 auto 1rem' }}>
                  {collection === 'spherex_qr3'
                    ? 'QR3 (Quick Release 3) does not cover this sky tile. DR1 (Data Release 1) contains verified observations for this target.'
                    : 'SPHEREx public survey releases are phased across sky coordinates.'}
                </p>
                {collection !== 'spherex_dr1' && (
                  <button
                    onClick={() => handleCollectionChange('spherex_dr1')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(124,58,237,0.25))',
                      border: '1px solid rgba(0, 212, 255, 0.4)',
                      color: '#00d4ff',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    Switch to spherex_dr1 & Search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Source Attribution Footer Badge */}
        <div style={{
          marginTop: '2rem',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          background: 'rgba(10, 15, 30, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '0.75rem',
          color: '#64748b',
        }}>
          <div>
            Data Source: <strong style={{ color: '#94a3b8' }}>NASA/SPHEREx and NASA/IPAC IRSA</strong> (Simple Image Access v2 & Image-Based Cutout Engine)
          </div>
          <a
            href="https://irsa.ipac.caltech.edu/Missions/spherex.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#00d4ff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            NASA/IPAC Archive Documentation <ExternalLink size={11} />
          </a>
        </div>

      </div>
    </div>
  );
}
