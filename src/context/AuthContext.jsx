import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const SALT = import.meta.env.VITE_SESSION_SALT || 'garda-internal-2024';
const encodeSession = (data) => btoa(encodeURIComponent(JSON.stringify(data) + '|' + SALT));
const decodeSession = (encoded) => {
  try {
    const decoded = decodeURIComponent(atob(encoded));
    const [json] = decoded.split('|' + SALT);
    return JSON.parse(json);
  } catch { return null; }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = sessionStorage.getItem('garda_session');
    return raw ? decodeSession(raw) : null;
  });

  const login = useCallback((userData) => {
    // Session expiry set to 8 hours
    const session = { ...userData, _exp: Date.now() + 8 * 60 * 60 * 1000 };
    sessionStorage.setItem('garda_session', encodeSession(session));
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('garda_session');
    setUser(null);
  }, []);

  const checkExpiry = useCallback(() => {
    if (user && Date.now() > user._exp) {
      logout();
      return false;
    }
    return true;
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, login, logout, checkExpiry }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
