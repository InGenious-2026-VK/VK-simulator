import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import Logo from './Logo.jsx';
import LoginDialog from './LoginDialog.jsx';
import NetworkBackground from './NetworkBackground.jsx';
import { UserMenu } from './SiteHeader.jsx';
import { SITE } from '../content/site.js';

const HomeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5" />
  </svg>
);

const NAV = [
  { to: '/', label: 'Home', end: true, icon: HomeIcon },
  { to: '/about', label: 'About us' },
  { to: '/contact', label: 'Contact' },
];

/**
 * Shell for the public pages: white header, deep-blue gradient page with a
 * moving supply-network backdrop, and the blue footer.
 */
export default function SiteLayout({ children }) {
  const { user, setLoginOpen } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // New page: start at the top, close the mobile menu.
  useEffect(() => {
    document.querySelector('.site-page')?.scrollTo(0, 0);
    setMenuOpen(false);
  }, [location.pathname]);

  const actions = user ? (
    <>
      <Link to="/datalake" className="mk-btn mk-btn-primary">
        Open the app
      </Link>
      <UserMenu />
    </>
  ) : (
    <>
      <button type="button" className="mk-btn mk-btn-primary" onClick={() => setLoginOpen('register')}>
        Create account
      </button>
      <button type="button" className="mk-btn mk-btn-outline" onClick={() => setLoginOpen(true)}>
        Log in
      </button>
    </>
  );

  return (
    <div className="site-page">
      <NetworkBackground fixed color="214, 233, 250" accent="160, 220, 140" density={0.7} icons={10} />

      <header className={`mk-header${menuOpen ? ' open' : ''}`}>
        <div className="mk-container mk-header-row">
          <Link to="/" className="mk-brand" aria-label={`${SITE.product} home`}>
            <Logo className="mk-logo" />
          </Link>
          <nav className="mk-nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.icon && <n.icon />}
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mk-actions">{actions}</div>
          <button
            type="button"
            className="mk-burger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        {menuOpen && (
          <div className="mk-mobile">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
            <Link to="/pricing">Pricing</Link>
            <div className="mk-mobile-actions">{actions}</div>
          </div>
        )}
      </header>

      <main className="mk-main">{children}</main>

      <footer className="mk-footer">
        <div className="mk-container mk-footer-grid">
          <div className="mk-footer-brand">
            <h4>{SITE.product}</h4>
            <p>Building resilient food supply chains through data-driven simulation.</p>
          </div>
          <div>
            <h4>Platform</h4>
            <Link to="/about">About us</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/contact?topic=support">Help &amp; support</Link>
          </div>
          <div>
            <h4>Information</h4>
            <Link to="/contact">Contact us</Link>
            <Link to="/privacy">Privacy policy</Link>
            <Link to="/terms">Terms of service</Link>
          </div>
        </div>
        <div className="mk-container mk-footer-base">
          <span>
            © {new Date().getFullYear()} {SITE.product}
          </span>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        </div>
      </footer>
      <LoginDialog />
    </div>
  );
}
