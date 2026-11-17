import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Button } from './ui.jsx';
import LoginDialog from './LoginDialog.jsx';

/** Brand mark shared by every window. */
export function Brand({ to = '/' }) {
  return (
    <Link to={to} className="fciq-brand" aria-label="FoodChainIQ home">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="17" r="2.6" fill="#0d9488" />
        <circle cx="12" cy="7" r="2.6" fill="#f97316" />
        <circle cx="19" cy="15" r="2.6" fill="#1e4e6e" />
        <path d="M5 17 12 7l7 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <strong>
        FoodChain<span>IQ</span>
      </strong>
    </Link>
  );
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const initials = user.display_name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="user-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="avatar">{initials}</span>
        <span className="hide-sm">{user.display_name}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <strong>{user.display_name}</strong>
            <span>{user.email}</span>
            <span className="muted">
              {user.role === 'admin' ? 'Platform admin' : 'User'}
              {user.groups?.length ? ` · ${user.groups.map((g) => g.name).join(', ')}` : ''}
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate('/');
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Header for Home / Data Lake / Visualization. */
export default function SiteHeader({ children }) {
  const { user, setLoginOpen } = useAuth();
  return (
    <header className="site-header">
      <Brand />
      {user && (
        <nav className="site-nav" aria-label="Windows">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/datalake">Data Lake</NavLink>
        </nav>
      )}
      <div className="site-header-slot">{children}</div>
      {user ? (
        <UserMenu />
      ) : (
        <Button variant="primary" size="sm" onClick={() => setLoginOpen(true)}>
          Sign in
        </Button>
      )}
      <LoginDialog />
    </header>
  );
}
