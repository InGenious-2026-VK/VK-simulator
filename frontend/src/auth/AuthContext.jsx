import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import * as api from '../api/client.js';

const AuthContext = createContext(null);

/**
 * Session state for every window. On load it tries a silent refresh (the
 * httpOnly refresh cookie), so a signed-in user stays signed in across reloads.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .refreshSession()
      .then((data) => alive && setUser(data.user))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setReady(true));
    const off = api.onSessionLost(() => setUser(null));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    setLoginOpen(false);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
  }, []);

  const reloadUser = useCallback(async () => {
    const me = await api.getMe();
    setUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout, reloadUser, loginOpen, setLoginOpen }),
    [user, ready, login, logout, reloadUser, loginOpen]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Signed-out visitors are sent to Home with the login form open. */
export function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="page-loading">
        <span className="spinner" /> Checking your session…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/" replace state={{ login: true, from: location.pathname + location.search }} />;
  }
  return children;
}
