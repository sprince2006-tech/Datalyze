import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setUnauthorizedHandler } from '../utils/api';

const AuthContext = createContext(null);

async function ensureSession() {
  let sid = localStorage.getItem('datalyze_session');
  if (sid) return sid;
  try {
    const res = await api.post('/auth/session');
    sid = res.data.sessionId;
    localStorage.setItem('datalyze_session', sid);
    return sid;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const updateUser = useCallback((u) => {
    if (u) setUser(u);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { setUser(null); });
  }, []);

  useEffect(() => {
    (async () => {
      await ensureSession();
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.user);
      } catch {
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const loginWithGoogle = async (credential) => {
    const res = await api.post('/auth/google', { credential });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, loginWithGoogle, logout, updateUser,
      isAnonymous: !user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);