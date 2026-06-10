import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('business');
      window.dispatchEvent(new Event('auth:logout'));
      // Redirect after a brief delay to allow event handlers to process
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }
    // 402 = período de prueba vencido o suscripción cancelada → ir a contratar plan
    if (err.response?.status === 402 && !window.location.pathname.includes('/dashboard/configuracion')) {
      window.location.href = '/dashboard/configuracion?expired=1';
    }
    return Promise.reject(err);
  }
);

export default api;
