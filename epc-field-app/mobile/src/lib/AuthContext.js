import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, clearSession, getStoredUser, getToken, setSession } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        const storedUser = await getStoredUser();
        setUser(storedUser);
      }
      setLoading(false);
    })();
  }, []);

  async function login(email, password) {
    const { token, user: loggedInUser } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await setSession(token, loggedInUser);
    setUser(loggedInUser);
  }

  async function logout() {
    await clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
