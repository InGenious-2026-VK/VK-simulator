import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Button } from './ui.jsx';
import { IconX } from './icons.jsx';
import Logo from './Logo.jsx';

// Seeded demo accounts (backend SEED_DEMO) are listed in dev builds only.
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';

export default function LoginDialog() {
  const { loginOpen, setLoginOpen, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    if (loginOpen) {
      setError(null);
      setTimeout(() => emailRef.current?.focus(), 30);
    }
  }, [loginOpen]);

  useEffect(() => {
    if (!loginOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setLoginOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loginOpen, setLoginOpen]);

  if (!loginOpen) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      setPassword('');
    } catch (err) {
      setError(
        err.status === 429
          ? 'Too many failed attempts. Please wait a few minutes and try again.'
          : err.status === 401
            ? 'Wrong email or password.'
            : `Could not sign in: ${err.message}. Is the backend running?`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && setLoginOpen(false)}>
      <form className="modal login-modal" onSubmit={submit} aria-labelledby="login-title">
        <Logo className="login-logo" />
        <div className="modal-head">
          <h2 id="login-title">Sign in to FoodChainIQ</h2>
          <Button icon aria-label="Close" onClick={() => setLoginOpen(false)}>
            <IconX size={15} />
          </Button>
        </div>
        <label className="field">
          <span>Email</span>
          <input
            ref={emailRef}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button variant="primary" type="submit" disabled={busy} className="block">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        {SHOW_DEMO && (
        <p className="muted small">
          Demo accounts: <code>planner@foodchainiq.local</code> / <code>planner1234</code> ·{' '}
          <code>producer@foodchainiq.local</code> / <code>producer1234</code> · admin{' '}
          <code>admin@foodchainiq.local</code> / <code>admin1234</code>
        </p>
        )}
      </form>
    </div>
  );
}
