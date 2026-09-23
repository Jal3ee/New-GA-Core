import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

/**
 * Helper untuk membaca payload JWT di sisi client
 */
function parseJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('garda_jwt_token') || null);

  const [user, setUser] = useState(() => {
    const savedToken = sessionStorage.getItem('garda_jwt_token');
    if (savedToken) {
      const payload = parseJwtPayload(savedToken);
      if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
        return payload;
      }
      sessionStorage.removeItem('garda_jwt_token');
      sessionStorage.removeItem('garda_session');
    }
    // Fallback legacy session
    const raw = sessionStorage.getItem('garda_session');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && (!parsed._exp || Date.now() < parsed._exp)) return parsed;
      } catch {}
    }
    return null;
  });

  const login = useCallback((userData, jwtToken = null) => {
    if (jwtToken) {
      sessionStorage.setItem('garda_jwt_token', jwtToken);
      setToken(jwtToken);
      const parsed = parseJwtPayload(jwtToken);
      const fullUser = { ...userData, ...parsed };
      sessionStorage.setItem('garda_session', JSON.stringify(fullUser));
      setUser(fullUser);
    } else {
      // Jika token tidak disertakan, simpan session dengan expiry 8 jam
      const session = { ...userData, _exp: Date.now() + 8 * 60 * 60 * 1000 };
      sessionStorage.setItem('garda_session', JSON.stringify(session));
      setUser(session);
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('garda_jwt_token');
    sessionStorage.removeItem('garda_session');
    setToken(null);
    setUser(null);
  }, []);

  const checkExpiry = useCallback(() => {
    const currentToken = sessionStorage.getItem('garda_jwt_token');
    if (currentToken) {
      const payload = parseJwtPayload(currentToken);
      if (!payload || !payload.exp || Date.now() >= payload.exp * 1000) {
        logout();
        return false;
      }
      return true;
    }

    if (user && user._exp && Date.now() > user._exp) {
      logout();
      return false;
    }
    return true;
  }, [user, logout]);

  // Periodic session liveness check (setiap 60 detik)
  useEffect(() => {
    const interval = setInterval(() => {
      checkExpiry();
    }, 60000);
    return () => clearInterval(interval);
  }, [checkExpiry]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, checkExpiry }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
