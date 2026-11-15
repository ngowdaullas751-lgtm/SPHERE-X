import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 60000 });

export const fetchHealth = () => api.get('/health');
export const fetchObservations = (ra, dec, radius = 0.05, collection = 'spherex_dr1') =>
  api.get('/observations', { params: { ra, dec, radius, collection } });
export const fetchCutout = (ra, dec, size = 0.1, access_url = null, obs_id = null) =>
  api.get('/cutout', { params: { ra, dec, size, access_url, obs_id } });
export const fetchTargets = () => api.get('/targets');
export const processImage = (data) => api.post('/process-image', data);
export const compareImages = (data) => api.post('/compare-images', data);
export const detectMotion = (data) => api.post('/detect-motion', data);
export const fetchSpectrum = (ra, dec, obs_id) => api.get('/spectrum', { params: { ra, dec, obs_id } });
export const fetchLightCurve = (ra, dec, band = null, collection = 'spherex_dr1') =>
  api.get('/light-curve', { params: { ra, dec, band: band && band !== 'all' ? band : undefined, collection } });
export const fetchDiscoveryStats = () => api.get('/discovery/stats');
export const fetchCandidates = (category = null, status = null) =>
  api.get('/candidates', { params: { category: category && category !== 'ALL' ? category : undefined, status: status && status !== 'ALL' ? status : undefined } });
export const fetchCandidate = (candidateId) => api.get(`/candidates/${candidateId}`);
export const submitCandidate = (candidate) => api.post('/candidates', candidate);
export const voteCandidate = (candidateId) => api.post(`/candidates/${candidateId}/vote`);
export const markCandidateInteresting = (candidateId) => api.post(`/candidates/${candidateId}/interesting`);
export const reportCandidateArtifact = (candidateId, reason, reporter = 'Citizen Scientist') =>
  api.post(`/candidates/${candidateId}/artifact`, { reason, reporter });
export const addCandidateComment = (candidateId, author, comment) =>
  api.post(`/candidates/${candidateId}/comments`, { author, comment });
export const submitCandidateForReview = (candidateId, user_notes = '') =>
  api.post(`/candidates/${candidateId}/submit-review`, { user_notes });
export const adminReviewCandidate = (candidateId, new_status, reviewer, review_notes) =>
  api.post(`/candidates/${candidateId}/review`, { new_status, reviewer, review_notes });
export const fetchGaiaStars = (ra, dec, radius = 0.05, limit = 40) =>
  api.get('/gaia', { params: { ra, dec, radius, limit } });
export const runShiftAndAdd = (payload) =>
  api.post('/shift-and-add', payload);

export default api;
