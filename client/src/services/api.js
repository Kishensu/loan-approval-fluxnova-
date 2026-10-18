import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

export const submitApplication = (data) => api.post('/applications', data);
export const getApplicationStatus = (instanceId) => api.get(`/applications/${instanceId}/status`);
export const getManagerTasks = () => api.get('/tasks');
export const completeReviewTask = (taskId, body) => api.post(`/tasks/${taskId}/complete`, body);
export const claimTask = (taskId) => api.post(`/tasks/${taskId}/claim`);

export const getOpsStats = () => api.get('/ops/stats');
export const getProcessHistory = (options = {}) => api.get('/ops/history', { params: options });

// Returns an absolute URL for a form document image so <img src> works
// even when the frontend (Netlify) is on a different origin than the API (Railway).
export const getDocumentUrl = (processInstanceId) =>
  `${import.meta.env.VITE_API_URL || '/api'}/forms/document/${processInstanceId}`;

// Intelligent Form Processing
export const uploadForm = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/forms/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const getFormStatus  = (instanceId) => api.get(`/forms/status/${instanceId}`);
export const getReviewTasks = ()             => api.get('/review/tasks');
export const submitReview   = (taskId, fields) => api.post(`/review/tasks/${taskId}/complete`, { fields });
export const getFormResults = ()             => api.get('/results');
export const getFormResult  = (instanceId)  => api.get(`/results/${instanceId}`);
