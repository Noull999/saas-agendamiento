import { createContext, useContext, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [business, setBusiness] = useState(() => {
    try { return JSON.parse(localStorage.getItem('business')); } catch { return null; }
  });

  const login = async (owner_email, password) => {
    const { data } = await api.post('/auth/login', { owner_email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('business', JSON.stringify(data.business));
    setBusiness(data.business);
    return data.business;
  };

  const register = async (name, owner_email, password, phone, specialty) => {
    const { data } = await api.post('/auth/register', { name, owner_email, password, phone, specialty });
    localStorage.setItem('token', data.token);
    localStorage.setItem('business', JSON.stringify(data.business));
    setBusiness(data.business);
    return data.business;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('business');
    setBusiness(null);
  };

  return (
    <AuthContext.Provider value={{ business, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
