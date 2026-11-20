import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getAuthConfig, register } from '../api/client.js';
import { Button } from './ui.jsx';
import { IconX } from './icons.jsx';
import Logo from './Logo.jsx';

// Seeded demo accounts (backend SEED_DEMO) are listed in dev builds only.
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';

const EMPTY_REG = { display_name: '', email: '', organization: '', password: '', confirm: '', note: '' };

function signInError(err) {
  if (err.status === 429) return 'Too many failed attempts. Please wait a few minutes and try again.';
  if (err.status === 401) return 'Wrong email or password.';
  if (err.status === 403) return err.message; // pending approval / registration rejected
  return `Could not sign in: ${err.message}. Is the backend running?`;
}

/** Sign-in dialog; also hosts self-registration ("Create an account"). */
export default function LoginDialog() {
  const { loginOpen, setLoginOpen, login } = useAuth();
  const [mode, setMode] = useState('signin'); // signin | register | registered
  const [registration, setRegistration] = useState(null); // approval | open | closed
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reg, setReg] = useState(EMPTY_REG);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    if (!loginOpen) return;
    setMode('signin');
    setError(null);
    getAuthConfig()
      .then((c) => setRegistration(c.registration))
      .catch(() => setRegistration(null));
  }, [loginOpen]);

  useEffect(() => {
    if (loginOpen) setTimeout(() => firstRef.current?.focus(), 30);
  }, [loginOpen, mode]);

  useEffect(() => {
    if (!loginOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setLoginOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loginOpen, setLoginOpen]);

  if (!loginOpen) return null;

  const switchTo = (m) => {
    setMode(m);
    setError(null);
  };

  const submitSignIn = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      setPassword('');
    } catch (err) {
      setError(signInError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    if (reg.password !== reg.confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await register({
        email: reg.email.trim(),
        display_name: reg.display_name.trim(),
        password: reg.password,
        organization: reg.organization.trim() || null,
        note: reg.note.trim() || null,
      });
      setResult(out);
      setEmail(reg.email.trim());
      setReg(EMPTY_REG);
      switchTo('registered');
    } catch (err) {
      setError(
        err.status === 422
          ? 'Check the form: a valid email and a password of at least 8 characters are required.'
          : err.message
      );
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setReg((r) => ({ ...r, [k]: e.target.value }));
  const canRegister = registration === 'approval' || registration === 'open';
  const title =
    mode === 'register' ? 'Create an account' : mode === 'registered' ? 'Registration received' : 'Sign in to FoodChainIQ';

  const head = (
    <>
      <Logo className="login-logo" />
      <div className="modal-head">
        <h2 id="login-title">{title}</h2>
        <Button icon aria-label="Close" onClick={() => setLoginOpen(false)}>
          <IconX size={15} />
        </Button>
      </div>
    </>
  );
  const errorLine = error && (
    <p className="form-error" role="alert">
      {error}
    </p>
  );

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && setLoginOpen(false)}>
      {mode === 'registered' ? (
        <div className="modal login-modal" role="dialog" aria-labelledby="login-title">
          {head}
          <div className={`callout ${result?.status === 'pending' ? 'info' : 'ok'}`}>
            <p>{result?.message}</p>
            {result?.status === 'pending' && (
              <p>You can sign in once an administrator has approved your account.</p>
            )}
          </div>
          <Button variant="primary" className="block" onClick={() => switchTo('signin')}>
            Back to sign in
          </Button>
        </div>
      ) : mode === 'register' ? (
        <form className="modal login-modal" onSubmit={submitRegister} aria-labelledby="login-title">
          {head}
          {registration === 'approval' && (
            <p className="muted small">An administrator reviews every new account before it can sign in.</p>
          )}
          <label className="field">
            <span>Full name</span>
            <input ref={firstRef} autoComplete="name" value={reg.display_name} onChange={set('display_name')} required maxLength={200} />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" value={reg.email} onChange={set('email')} required />
          </label>
          <label className="field">
            <span>
              Organisation <em className="muted">(optional)</em>
            </span>
            <input autoComplete="organization" value={reg.organization} onChange={set('organization')} maxLength={200} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Password</span>
              <input type="password" autoComplete="new-password" value={reg.password} onChange={set('password')} required minLength={8} maxLength={72} />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input type="password" autoComplete="new-password" value={reg.confirm} onChange={set('confirm')} required minLength={8} maxLength={72} />
            </label>
          </div>
          <label className="field">
            <span>
              Why do you need access? <em className="muted">(optional)</em>
            </span>
            <textarea rows={3} value={reg.note} onChange={set('note')} maxLength={1000} />
          </label>
          {errorLine}
          <Button variant="primary" type="submit" disabled={busy} className="block">
            {busy ? 'Sending…' : registration === 'open' ? 'Create account' : 'Request account'}
          </Button>
          <p className="muted small login-switch">
            Already have an account?{' '}
            <button type="button" className="link-btn" onClick={() => switchTo('signin')}>
              Sign in
            </button>
          </p>
        </form>
      ) : (
        <form className="modal login-modal" onSubmit={submitSignIn} aria-labelledby="login-title">
          {head}
          <label className="field">
            <span>Email</span>
            <input ref={firstRef} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {errorLine}
          <Button variant="primary" type="submit" disabled={busy} className="block">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          {canRegister && (
            <p className="muted small login-switch">
              New to FoodChainIQ?{' '}
              <button type="button" className="link-btn" onClick={() => switchTo('register')}>
                Create an account
              </button>
            </p>
          )}
          {SHOW_DEMO && (
            <p className="muted small">
              Demo accounts: <code>planner@foodchainiq.local</code> / <code>planner1234</code> ·{' '}
              <code>producer@foodchainiq.local</code> / <code>producer1234</code> · admin{' '}
              <code>admin@foodchainiq.local</code> / <code>admin1234</code>
            </p>
          )}
        </form>
      )}
    </div>
  );
}
