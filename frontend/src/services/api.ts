import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fttg_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fttg_token');
      localStorage.removeItem('fttg_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
