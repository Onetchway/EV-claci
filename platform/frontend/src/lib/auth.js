'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('platform_admin') : null;
    if (stored) setAdmin(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { token, admin: loggedInAdmin } = await authApi.login({ email, password });
    localStorage.setItem('platform_token', token);
    localStorage.setItem('platform_admin', JSON.stringify(loggedInAdmin));
    setAdmin(loggedInAdmin);
    router.push('/tenants');
  };

  const logout = () => {
    localStorage.removeItem('platform_token');
    localStorage.removeItem('platform_admin');
    setAdmin(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
