import { useState, useEffect } from 'react';
import {
  Search, CheckCircle2, ShieldAlert, ThumbsUp, PlusCircle,
  Filter, MapPin, Calendar, Star, Eye, Tag, Award, Users, Activity,
  Heart, MessageSquare, AlertTriangle, Send, ShieldCheck, Clock,
  ArrowRight, FileText, Database, Sparkles, Layers, Sliders, Check, HelpCircle
} from 'lucide-react';
import {
  fetchDiscoveryStats,
  fetchCandidates,
  fetchCandidate,
  submitCandidate,
  voteCandidate,
  markCandidateInteresting,
  reportCandidateArtifact,
  addCandidateComment,
  submitCandidateForReview,
  adminReviewCandidate
} from '../services/api';

const OFFICIAL_STATUSES = [
  'New candidate',
  'Under review',
  'Needs more observations',
  'Possible artifact',
  'Unverified candidate',
  'Independently verified',
];

const CATEGORY_FILTERS = [
  { id: 'ALL', label: 'All Categories' },
  { id: 'Moving', label: 'Moving Sources' },
  { id: 'Variable', label: 'Variable Sources' },
  { id: 'Transient', label: 'Transients' },
  { id: 'Substellar', label: 'Sub-stellar Dwarfs' },
];

export default function DiscoveryPage() {
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDetail, setCandidateDetail] = useState(null);

  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  // Active Tab: 'citizen' or 'admin'
  const [activeTab, setActiveTab] = useState('citizen');

  // Interactive user actions state
  const [userComment, setUserComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [userVoted, setUserVoted] = useState({});
  const [userHearted, setUserHearted] = useState({});

  // Artifact Report Modal
  const [showArtifactModal, setShowArtifactModal] = useState(false);
  const [artifactReason, setArtifactReason] = useState('');

  // Submit for Review Modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  // Admin Review Form State
  const [adminStatus, setAdminStatus] = useState(OFFICIAL_STATUSES[1]);
  const [adminReviewer, setAdminReviewer] = useState('NASA Science Team Reviewer');
  const [adminNotes, setAdminNotes] = useState('');
  const [adminSuccessMsg, setAdminSuccessMsg] = useState(null);

  // Create Candidate Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newRa, setNewRa] = useState('');
  const [newDec, setNewDec] = useState('');
  const [newCategory, setNewCategory] = useState('Possible Moving Source');
  const [newSignificance, setNewSignificance] = useState('12.5');
  const [newUncertainty, setNewUncertainty] = useState('0.15');
  const [newNotes, setNewNotes] = useState('');

  // Load Dashboard Stats & Candidates List
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, candsRes] = await Promise.all([
        fetchDiscoveryStats(),
        fetchCandidates(filterCategory, filterStatus),
      ]);
      setStats(statsRes.data);
      const cands = candsRes.data || [];
      setCandidates(cands);

      if (cands.length > 0 && !selectedCandidate) {
        setSelectedCandidate(cands[0]);
        loadCandidateDetail(cands[0].id);
      } else if (selectedCandidate) {
        // Keep selected candidate updated
        const found = cands.find(c => c.id === selectedCandidate.id);
        if (found) {
          setSelectedCandidate(found);
          loadCandidateDetail(found.id);
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load discovery data from database.');
    } finally {
      setLoading(false);
    }
  };

  const loadCandidateDetail = async (candId) => {
    setLoadingDetail(true);
    try {
      const res = await fetchCandidate(candId);
      setCandidateDetail(res.data);
      setAdminStatus(res.data.status);
    } catch (err) {
      console.warn('Failed to load candidate details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterCategory, filterStatus]);

  const handleSelectCandidate = (cand) => {
    setSelectedCandidate(cand);
    loadCandidateDetail(cand.id);
    setAdminSuccessMsg(null);
  };

  // User Actions
  const handleVote = async (candId) => {
    if (userVoted[candId]) return;
    try {
      await voteCandidate(candId);
      setUserVoted(prev => ({ ...prev, [candId]: true }));
      setCandidates(prev => prev.map(c => c.id === candId ? { ...c, community_votes: (c.community_votes || 0) + 1 } : c));
      if (candidateDetail?.id === candId) {
        setCandidateDetail(prev => ({ ...prev, community_votes: (prev.community_votes || 0) + 1 }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkInteresting = async (candId) => {
    if (userHearted[candId]) return;
    try {
      await markCandidateInteresting(candId);
      setUserHearted(prev => ({ ...prev, [candId]: true }));
      setCandidates(prev => prev.map(c => c.id === candId ? { ...c, interesting_count: (c.interesting_count || 0) + 1 } : c));
      if (candidateDetail?.id === candId) {
        setCandidateDetail(prev => ({ ...prev, interesting_count: (prev.interesting_count || 0) + 1 }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!userComment.trim() || !candidateDetail) return;
    try {
      const res = await addCandidateComment(candidateDetail.id, commentAuthor.trim() || 'Citizen Scientist', userComment.trim());
      setCandidateDetail(res.data);
      setUserComment('');
    } catch (err) {
      alert('Failed to post comment: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleReportArtifact = async (e) => {
    e.preventDefault();
    if (!artifactReason.trim() || !candidateDetail) return;
    try {
      const res = await reportCandidateArtifact(candidateDetail.id, artifactReason.trim(), 'Citizen Scientist');
      setShowArtifactModal(false);
      setArtifactReason('');
      loadData();
    } catch (err) {
      alert('Failed to report artifact: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!candidateDetail) return;
    try {
      await submitCandidateForReview(candidateDetail.id, reviewNotes.trim());
      setShowReviewModal(false);
      setReviewNotes('');
      loadData();
    } catch (err) {
      alert('Failed to submit for review: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Admin Review Decision Submission
  const handleAdminReviewSubmit = async (e) => {
    e.preventDefault();
    if (!candidateDetail) return;
    try {
      const res = await adminReviewCandidate(candidateDetail.id, adminStatus, adminReviewer, adminNotes);
      setAdminSuccessMsg(`Official review decision recorded: '${adminStatus}'.`);
      setAdminNotes('');
      loadData();
    } catch (err) {
      alert('Admin review failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Create Candidate Submission
  const handleCreateCandidate = async (e) => {
    e.preventDefault();
    const r = parseFloat(newRa);
    const d = parseFloat(newDec);
    if (isNaN(r) || isNaN(d)) {
      alert('Please provide valid decimal degrees for RA and Dec.');
      return;
    }
    const payload = {
      id: `CAND-SPX-${Math.floor(1000 + Math.random() * 9000)}`,
      target_name: newTargetName.trim() || `Source (${r.toFixed(4)}, ${d.toFixed(4)})`,
      ra: r,
      dec: d,
      collection: 'spherex_dr1',
      category: newCategory,
      significance: parseFloat(newSignificance) || 10.0,
      uncertainty: parseFloat(newUncertainty) || 0.15,
      status: 'New candidate',
      scientific_notes: newNotes.trim() || 'Discovered and reported by citizen scientist via COSMIC LENS.',
      dates: [new Date().toISOString().split('T')[0]],
      obs_ids: ['SPX-DISCOVERY-USER'],
    };

    try {
      await submitCandidate(payload);
      setShowCreateModal(false);
      setNewTargetName('');
      setNewRa('');
      setNewDec('');
      setNewNotes('');
      loadData();
    } catch (err) {
      alert('Failed to submit candidate: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Helper for Status Badge Styling
  const getStatusBadge = (statusStr) => {
    switch (statusStr) {
      case 'Independently verified':
        return {
          bg: 'rgba(16, 185, 129, 0.2)',
          border: '#10b981',
          color: '#6ee7b7',
          icon: <CheckCircle2 size={12} />,
        };
      case 'Under review':
        return {
          bg: 'rgba(245, 158, 11, 0.2)',
          border: '#f59e0b',
          color: '#fde68a',
          icon: <Clock size={12} />,
        };
      case 'Needs more observations':
        return {
          bg: 'rgba(168, 85, 247, 0.2)',
          border: '#a855f7',
          color: '#d8b4fe',
          icon: <Layers size={12} />,
        };
      case 'Possible artifact':
        return {
          bg: 'rgba(239, 68, 68, 0.2)',
          border: '#ef4444',
          color: '#fca5a5',
          icon: <AlertTriangle size={12} />,
        };
      case 'New candidate':
        return {
          bg: 'rgba(0, 212, 255, 0.2)',
          border: '#00d4ff',
          color: '#7dd3fc',
          icon: <Sparkles size={12} />,
        };
      default:
        return {
          bg: 'rgba(148, 163, 184, 0.2)',
          border: '#64748b',
          color: '#cbd5e1',
          icon: <HelpCircle size={12} />,
        };
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '3.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1350px', margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '0.85rem', marginBottom: '4px' }}>
            <Award size={16} />
            <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Citizen Science Discovery Hub</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 'clamp(1.6rem, 3.5vw, 2.3rem)',
                fontWeight: 700,
                color: '#10b981',
                textShadow: '0 0 25px rgba(16, 185, 129, 0.4)',
                marginBottom: '0.4rem',
              }}>
                Astronomical Discovery Network
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '850px', lineHeight: 1.5 }}>
                Inspect, flag, discuss, and submit potential moving or variable astronomical objects identified in the NASA SPHEREx survey.
                All candidate discoveries undergo transparent multi-stage review before scientific validation.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(0, 212, 255, 0.2))',
                  border: '1px solid #10b981',
                  color: '#6ee7b7',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)',
                }}
              >
                <PlusCircle size={15} /> Report New Candidate
              </button>
            </div>
          </div>
        </div>

        {/* 1. DISCOVERY DASHBOARD STATS BAR (Calculated from Real Database Records) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ background: 'rgba(10, 15, 30, 0.75)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(0, 212, 255, 0.25)' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Processed Observations</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#00d4ff', fontWeight: 700 }}>
              {stats?.total_processed_observations ?? '—'}
            </span>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>SPHEREx Level 2b Archive</span>
          </div>

          <div style={{ background: 'rgba(10, 15, 30, 0.75)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Valid Image Comparisons</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#c084fc', fontWeight: 700 }}>
              {stats?.valid_image_comparisons ?? '—'}
            </span>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>Multi-Epoch Pair Alignments</span>
          </div>

          <div style={{ background: 'rgba(10, 15, 30, 0.75)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Moving Source Candidates</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#10b981', fontWeight: 700 }}>
              {stats?.possible_moving_candidates ?? '—'}
            </span>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>Proper Motion Transients</span>
          </div>

          <div style={{ background: 'rgba(10, 15, 30, 0.75)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Variable Candidates</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#f59e0b', fontWeight: 700 }}>
              {stats?.possible_variable_candidates ?? '—'}
            </span>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>Pulsations & Outbursts</span>
          </div>

          <div style={{ background: 'rgba(10, 15, 30, 0.75)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.25)' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Unverified Candidates</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#94a3b8', fontWeight: 700 }}>
              {stats?.unverified_candidates ?? '—'}
            </span>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>Awaiting Community Triage</span>
          </div>

          <div style={{ background: 'rgba(10, 15, 30, 0.75)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Awaiting Review</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#f87171', fontWeight: 700 }}>
              {stats?.candidates_awaiting_review ?? '—'}
            </span>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>In Science Team Queue</span>
          </div>
        </div>

        {/* View Mode Switcher: Citizen View vs Admin Review */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '0.75rem 1.25rem',
          borderRadius: '12px',
          background: 'rgba(10, 15, 30, 0.85)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('citizen')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: activeTab === 'citizen' ? 600 : 400,
                background: activeTab === 'citizen' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                border: activeTab === 'citizen' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                color: activeTab === 'citizen' ? '#10b981' : '#94a3b8',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Users size={14} /> Citizen Scientist Explorer
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: activeTab === 'admin' ? 600 : 400,
                background: activeTab === 'admin' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                border: activeTab === 'admin' ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                color: activeTab === 'admin' ? '#00d4ff' : '#94a3b8',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShieldCheck size={14} /> Science Team Review Portal
            </button>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Database: <span style={{ color: '#00d4ff', fontFamily: 'monospace' }}>cosmic_lens.db (SQLite)</span> · Live Sync
          </div>
        </div>

        {/* Filters Bar: Category & Status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}>
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {CATEGORY_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilterCategory(f.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  background: filterCategory === f.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(10, 15, 30, 0.6)',
                  border: filterCategory === f.id ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: filterCategory === f.id ? '#6ee7b7' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Status Dropdown Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Filter Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px',
                padding: '4px 10px',
                color: '#6ee7b7',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Statuses ({candidates.length})</option>
              {OFFICIAL_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
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
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* 2 & 3. MAIN SPLIT: CANDIDATES EXPLORER (LEFT) + CANDIDATE DETAILS / REVIEW (RIGHT) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1.75fr)', gap: '1.5rem', alignItems: 'start' }}>

          {/* Candidate Explorer List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {candidates.length === 0 ? (
              <div style={{
                background: 'rgba(10, 15, 30, 0.75)',
                padding: '3rem 1rem',
                borderRadius: '12px',
                textAlign: 'center',
                color: '#64748b',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}>
                <Filter size={28} style={{ color: '#00d4ff', marginBottom: '8px' }} />
                <div style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>No candidates found matching this filter.</div>
              </div>
            ) : (
              candidates.map(cand => {
                const isSelected = selectedCandidate?.id === cand.id;
                const badge = getStatusBadge(cand.status);

                return (
                  <div
                    key={cand.id}
                    onClick={() => handleSelectCandidate(cand)}
                    style={{
                      padding: '1.1rem',
                      borderRadius: '12px',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(0, 212, 255, 0.08))'
                        : 'rgba(10, 15, 30, 0.75)',
                      border: isSelected ? '1px solid #10b981' : '1px solid rgba(16, 185, 129, 0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 20px rgba(16, 185, 129, 0.15)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div>
                        <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
                          {cand.id}
                        </span>
                        <div style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>
                          {cand.target_name || cand.category}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        background: badge.bg,
                        border: `1px solid ${badge.border}`,
                        color: badge.color,
                      }}>
                        {badge.icon} {cand.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <MapPin size={11} style={{ color: '#00d4ff' }} /> RA: {cand.ra.toFixed(4)}°, Dec: {cand.dec.toFixed(4)}°
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Calendar size={11} style={{ color: '#f59e0b' }} /> {cand.dates?.[0] || '2025'}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Tag size={11} style={{ color: '#a855f7' }} /> {cand.collection}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                      <div style={{ color: '#cbd5e1' }}>
                        Significance: <span style={{ color: '#00d4ff', fontFamily: 'monospace', fontWeight: 600 }}>{cand.significance?.toFixed(1)}σ</span> |
                        Err: <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>±{cand.uncertainty?.toFixed(2)}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', color: '#64748b' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Heart size={12} style={{ color: cand.interesting_count ? '#ec4899' : '#64748b' }} /> {cand.interesting_count || 0}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <ThumbsUp size={12} style={{ color: cand.community_votes ? '#00d4ff' : '#64748b' }} /> {cand.community_votes || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 3 & 6. CANDIDATE DETAILS & REVIEW PANEL (RIGHT) */}
          <div style={{
            background: 'rgba(10, 15, 30, 0.85)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '14px',
            padding: '1.5rem',
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.06)',
          }}>
            {loadingDetail ? (
              <div style={{ textAlign: 'center', padding: '6rem 0', color: '#64748b' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid rgba(16, 185, 129, 0.2)',
                  borderTopColor: '#10b981',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 12px',
                }} />
                <span>Loading complete candidate observation dossier…</span>
              </div>
            ) : !candidateDetail ? (
              <div style={{ textAlign: 'center', padding: '6rem 0', color: '#64748b' }}>
                Select a candidate from the explorer to inspect evidence.
              </div>
            ) : (
              <div>
                {/* Header & Status Indicator */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.05rem', color: '#10b981', fontWeight: 700 }}>
                        {candidateDetail.id}
                      </span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: getStatusBadge(candidateDetail.status).bg,
                        border: `1px solid ${getStatusBadge(candidateDetail.status).border}`,
                        color: getStatusBadge(candidateDetail.status).color,
                      }}>
                        {getStatusBadge(candidateDetail.status).icon} {candidateDetail.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>
                      {candidateDetail.target_name} ({candidateDetail.category})
                    </div>
                  </div>

                  {/* Citizen Quick Action Buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleMarkInteresting(candidateDetail.id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        background: userHearted[candidateDetail.id] ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                        border: userHearted[candidateDetail.id] ? '1px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: userHearted[candidateDetail.id] ? '#f472b6' : '#cbd5e1',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Heart size={13} fill={userHearted[candidateDetail.id] ? '#ec4899' : 'none'} />
                      <span>{candidateDetail.interesting_count || 0} Interesting</span>
                    </button>

                    <button
                      onClick={() => handleVote(candidateDetail.id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        background: userVoted[candidateDetail.id] ? 'rgba(0, 212, 255, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                        border: userVoted[candidateDetail.id] ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: userVoted[candidateDetail.id] ? '#38bdf8' : '#cbd5e1',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ThumbsUp size={13} fill={userVoted[candidateDetail.id] ? '#00d4ff' : 'none'} />
                      <span>{candidateDetail.community_votes || 0} Endorse</span>
                    </button>

                    <button
                      onClick={() => setShowArtifactModal(true)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <AlertTriangle size={13} /> Flag Artifact
                    </button>

                    {candidateDetail.status !== 'Under review' && candidateDetail.status !== 'Independently verified' && (
                      <button
                        onClick={() => setShowReviewModal(true)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid #10b981',
                          color: '#6ee7b7',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <ShieldCheck size={13} /> Request Review
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. MULTI-EPOCH SUPPORTING IMAGES */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                    Multi-Epoch Evidence Images & Residual Detection:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
                    
                    {/* First Observation */}
                    <div style={{ background: '#020408', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ padding: '4px 8px', fontSize: '0.68rem', color: '#00d4ff', background: 'rgba(0, 212, 255, 0.1)' }}>
                        Epoch 1: {candidateDetail.dates?.[0] || 'First Visit'}
                      </div>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {candidateDetail.image_1_b64 ? (
                          <img src={`data:image/png;base64,${candidateDetail.image_1_b64}`} alt="Epoch 1" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>FITS cutout</span>
                        )}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '18px', height: '18px', border: '1px solid #00d4ff', borderRadius: '50%', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    {/* Second Observation */}
                    <div style={{ background: '#020408', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ padding: '4px 8px', fontSize: '0.68rem', color: '#c084fc', background: 'rgba(168, 85, 247, 0.1)' }}>
                        Epoch 2: {candidateDetail.dates?.[1] || 'Second Visit'}
                      </div>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {candidateDetail.image_2_b64 ? (
                          <img src={`data:image/png;base64,${candidateDetail.image_2_b64}`} alt="Epoch 2" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>FITS cutout</span>
                        )}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '18px', height: '18px', border: '1px solid #c084fc', borderRadius: '50%', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    {/* Difference Image */}
                    <div style={{ background: '#020408', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ padding: '4px 8px', fontSize: '0.68rem', color: '#fde68a', background: 'rgba(245, 158, 11, 0.1)' }}>
                        Residual (Epoch 2 – Epoch 1)
                      </div>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {candidateDetail.diff_image_b64 ? (
                          <img src={`data:image/png;base64,${candidateDetail.diff_image_b64}`} alt="Difference" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : candidateDetail.image_2_b64 ? (
                          <img src={`data:image/png;base64,${candidateDetail.image_2_b64}`} alt="Residual" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'invert(1) contrast(1.5)' }} />
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Difference image</span>
                        )}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '22px', height: '22px', border: '1px dashed #f59e0b', borderRadius: '50%', pointerEvents: 'none' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Measurements & Scientific Parameters */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '8px 12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Target Coordinates</span>
                    <span style={{ color: '#00d4ff', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem' }}>
                      RA: {candidateDetail.ra.toFixed(6)}°<br />Dec: {candidateDetail.dec.toFixed(6)}°
                    </span>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '8px 12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Detection Significance</span>
                    <span style={{ color: '#10b981', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                      {candidateDetail.significance?.toFixed(1)}σ (SNR)
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>
                      Uncertainty: ±{candidateDetail.uncertainty?.toFixed(2)}
                    </span>
                  </div>

                  {candidateDetail.motion_vector && (
                    <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '8px 12px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Proper Motion Vector (µ)</span>
                      <span style={{ color: '#c084fc', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                        {candidateDetail.motion_vector.total_pm?.toFixed(2)} arcsec/yr
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>
                        Δθ = {candidateDetail.motion_vector.displacement_arcsec?.toFixed(2)}"
                      </span>
                    </div>
                  )}

                  {candidateDetail.brightness_data && (
                    <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '8px 12px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Photometric Variability</span>
                      <span style={{ color: '#f59e0b', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                        {candidateDetail.brightness_data.classification || 'VARIABLE'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>
                        &lt;F&gt; = {candidateDetail.brightness_data.mean_flux?.toFixed(2)} mJy
                      </span>
                    </div>
                  )}
                </div>

                {/* Scientific Notes */}
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '10px 14px', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>
                    Scientific Notes & Processing Evidence:
                  </div>
                  {candidateDetail.scientific_notes}
                </div>

                {/* 6. ADMIN REVIEW TAB vs CITIZEN DISCUSSION TAB */}
                {activeTab === 'admin' ? (
                  /* Admin Review Interface */
                  <div style={{
                    background: 'rgba(5, 8, 16, 0.9)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00d4ff', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                      <ShieldCheck size={17} /> Scientific Review & Decision Console
                    </div>

                    {adminSuccessMsg && (
                      <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#6ee7b7', fontSize: '0.78rem', marginBottom: '10px' }}>
                        {adminSuccessMsg}
                      </div>
                    )}

                    <form onSubmit={handleAdminReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                            Update Candidate Status:
                          </label>
                          <select
                            value={adminStatus}
                            onChange={(e) => setAdminStatus(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'rgba(15, 23, 42, 0.9)',
                              border: '1px solid rgba(0, 212, 255, 0.4)',
                              color: '#00d4ff',
                              fontSize: '0.8rem',
                            }}
                          >
                            {OFFICIAL_STATUSES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                            Reviewer Identity:
                          </label>
                          <input
                            type="text"
                            value={adminReviewer}
                            onChange={(e) => setAdminReviewer(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'rgba(15, 23, 42, 0.9)',
                              border: '1px solid rgba(0, 212, 255, 0.4)',
                              color: '#ffffff',
                              fontSize: '0.8rem',
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                          Review Decision Rationale / Notes:
                        </label>
                        <textarea
                          rows={3}
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Record detailed scientific justification, cross-matching catalog results, or verification steps…"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: '1px solid rgba(0, 212, 255, 0.4)',
                            color: '#ffffff',
                            fontSize: '0.8rem',
                            resize: 'vertical',
                          }}
                        />
                      </div>

                      <button
                        type="submit"
                        style={{
                          alignSelf: 'flex-start',
                          padding: '7px 18px',
                          borderRadius: '6px',
                          background: '#00d4ff',
                          border: 'none',
                          color: '#050810',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Check size={14} /> Commit Review Decision
                      </button>
                    </form>

                    {/* Audit Trail Timeline */}
                    <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                        Review Audit Trail & Status History:
                      </span>
                      {candidateDetail.review_history?.length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>No review entries logged.</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {candidateDetail.review_history?.map(rev => (
                            <div key={rev.id} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.72rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: '2px' }}>
                                <span style={{ color: '#00d4ff', fontWeight: 600 }}>{rev.reviewer}</span>
                                <span>{rev.created_at}</span>
                              </div>
                              <div style={{ color: '#cbd5e1' }}>
                                <span style={{ color: '#f59e0b' }}>{rev.previous_status}</span> → <span style={{ color: '#10b981', fontWeight: 600 }}>{rev.new_status}</span>
                              </div>
                              {rev.review_notes && (
                                <div style={{ color: '#94a3b8', marginTop: '2px', fontStyle: 'italic' }}>
                                  "{rev.review_notes}"
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Citizen Discussion & Evidence Comments */
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                      <MessageSquare size={16} /> Citizen Discussion & Peer Feedback ({candidateDetail.comments?.length || 0})
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                      {candidateDetail.comments?.length === 0 ? (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', padding: '0.5rem 0' }}>
                          No comments posted yet. Be the first citizen scientist to analyze this candidate!
                        </div>
                      ) : (
                        candidateDetail.comments?.map(com => (
                          <div key={com.id} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: '2px' }}>
                              <span style={{ color: '#6ee7b7', fontWeight: 600 }}>{com.author}</span>
                              <span style={{ fontSize: '0.68rem' }}>{com.created_at}</span>
                            </div>
                            <div style={{ color: '#e2e8f0' }}>{com.comment}</div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Comment Form */}
                    <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        placeholder="Your name or handle…"
                        value={commentAuthor}
                        onChange={(e) => setCommentAuthor(e.target.value)}
                        style={{
                          width: '130px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Add your astronomical observation or evidence note…"
                        value={userComment}
                        onChange={(e) => setUserComment(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: '#10b981',
                          border: 'none',
                          color: '#050810',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Send size={13} /> Post
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Artifact Reporting Modal */}
        {showArtifactModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}>
            <div style={{
              background: '#0a0f1e',
              border: '1px solid #ef4444',
              borderRadius: '14px',
              padding: '1.5rem',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 0 30px rgba(239, 68, 68, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>
                <AlertTriangle size={20} /> Flag Candidate as Possible Artifact
              </div>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '12px', lineHeight: 1.4 }}>
                Help clean scientific catalogs by reporting diffraction spikes, cosmic ray streaks, bad pixels, or detector boundary effects.
              </p>
              <form onSubmit={handleReportArtifact}>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe why this detection appears to be an artifact rather than a true astronomical source…"
                  value={artifactReason}
                  onChange={(e) => setArtifactReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    marginBottom: '12px',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowArtifactModal(false)}
                    style={{ padding: '6px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid #64748b', color: '#94a3b8', fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '6px 14px', borderRadius: '6px', background: '#ef4444', border: 'none', color: '#ffffff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Submit Artifact Flag
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Submit for Review Modal */}
        {showReviewModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}>
            <div style={{
              background: '#0a0f1e',
              border: '1px solid #10b981',
              borderRadius: '14px',
              padding: '1.5rem',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>
                <ShieldCheck size={20} /> Submit for Scientific Peer Review
              </div>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '12px', lineHeight: 1.4 }}>
                This candidate will be queued for formal inspection by the science team and cross-matched against SIMBAD, Gaia, and the Minor Planet Center.
              </p>
              <form onSubmit={handleSubmitReview}>
                <textarea
                  rows={3}
                  placeholder="Optional review notes or supporting observations for the review panel…"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    marginBottom: '12px',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    style={{ padding: '6px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid #64748b', color: '#94a3b8', fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '6px 14px', borderRadius: '6px', background: '#10b981', border: 'none', color: '#050810', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Queue for Review
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Candidate Modal */}
        {showCreateModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}>
            <div style={{
              background: '#0a0f1e',
              border: '1px solid #10b981',
              borderRadius: '14px',
              padding: '1.5rem',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px' }}>
                <PlusCircle size={20} /> Report Possible Astronomical Discovery
              </div>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '14px', lineHeight: 1.4 }}>
                Enter real celestial coordinates and detection details from your analysis in the Motion Detector, Spectral Explorer, or Brightness Analyzer.
              </p>
              <form onSubmit={handleCreateCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Target Name / Designation:</label>
                  <input
                    type="text"
                    placeholder="e.g. SPHEREx High Motion Transient A"
                    value={newTargetName}
                    onChange={(e) => setNewTargetName(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#ffffff', fontSize: '0.8rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Right Ascension (deg):</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      placeholder="e.g. 133.7951"
                      value={newRa}
                      onChange={(e) => setNewRa(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#ffffff', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Declination (deg):</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      placeholder="e.g. -7.2451"
                      value={newDec}
                      onChange={(e) => setNewDec(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#ffffff', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Category:</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', fontSize: '0.8rem' }}
                    >
                      <option value="Possible Moving Source">Possible Moving Source</option>
                      <option value="Possible Variable Source">Possible Variable Source</option>
                      <option value="Sub-stellar Dwarf Candidate">Sub-stellar Dwarf Candidate</option>
                      <option value="Solar System Transient">Solar System Transient</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Significance (SNR σ):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newSignificance}
                      onChange={(e) => setNewSignificance(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#ffffff', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Scientific Notes / Evidence:</label>
                  <textarea
                    rows={3}
                    placeholder="Describe how the object was identified, observed displacement, or flux changes…"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#ffffff', fontSize: '0.8rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{ padding: '6px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid #64748b', color: '#94a3b8', fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '6px 16px', borderRadius: '6px', background: '#10b981', border: 'none', color: '#050810', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Save Candidate
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
