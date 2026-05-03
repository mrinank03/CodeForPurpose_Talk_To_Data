import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem('datalens_session_id');
  if (sessionId) {
    config.headers['X-Session-ID'] = sessionId;
  }
  
  const token = localStorage.getItem('datalens_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login if unauthorized
      localStorage.removeItem('datalens_token');
      localStorage.removeItem('datalens_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
