import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [business, setBusiness] = useState(() => {
    try { return JSON.parse(localStorage.getItem('business')); } catch { return null; }
  });
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAuthChecked(true);
      return;
    }
    api.get('/auth/me')
      .then(({ data }) => {
        setBusiness(data);
        localStorage.setItem('business', JSON.stringify(data));
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('business');
        setBusiness(null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  // Listen for logout event triggered by API interceptor (401 response)
  useEffect(() => {
    const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('business');
      setBusiness(null);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const login = async (owner_email, password) => {
    const { data } = await api.post('/auth/login', { owner_email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('business', JSON.stringify(data.business));
    setBusiness(data.business);
    return data.business;
  };

  const register = async (name, owner_email, password, phone, specialty, vertical) => {
    const { data } = await api.post('/auth/register', { name, owner_email, password, phone, specialty, vertical });
    localStorage.setItem('token', data.token);
    localStorage.setItem('business', JSON.stringify(data.business));
    setBusiness(data.business);
    return data.business;
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('business');
    setBusiness(null);
  };

  const updateBusiness = (patch) => {
    const updated = { ...business, ...patch };
    localStorage.setItem('business', JSON.stringify(updated));
    setBusiness(updated);
  };

  if (!authChecked) return null;

  return (
    <AuthContext.Provider value={{ business, login, register, logout, updateBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
