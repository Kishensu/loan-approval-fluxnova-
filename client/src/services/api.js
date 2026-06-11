import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const submitApplication = (data) => api.post('/applications', data);
export const getApplicationStatus = (instanceId) => api.get(`/applications/${instanceId}/status`);
export const getManagerTasks = () => api.get('/tasks');
export const completeReviewTask = (taskId, body) => api.post(`/tasks/${taskId}/complete`, body);
export const claimTask = (taskId) => api.post(`/tasks/${taskId}/claim`);
