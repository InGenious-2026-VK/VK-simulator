import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import Logo from './Logo.jsx';
import LoginDialog from './LoginDialog.jsx';
import { UserMenu } from './SiteHeader.jsx';
import { SITE } from '../content/site.js';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About us' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
];

/** Header + footer for the public pages (home, about, pricing, contact, legal). */
export default function SiteLayout({ children, transparentHeader = false }) {
  const { user, setLoginOpen } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // New page: start at the top, close the mobile menu.
  useEffect(() => {
    document.querySelector('.site-page')?.scrollTo(0, 0);
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div
      className="site-page"
      onScroll={(e) => {
        const s = e.currentTarget.scrollTop > 8;
        if (s !== scrolled) setScrolled(s);
      }}
    >
      <header className={`mk-header${scrolled || !transparentHeader ? ' solid' : ''}${menuOpen ? ' open' : ''}`}>
        <div className="mk-container mk-header-row">
          <Link to="/" className="mk-brand" aria-label={`${SITE.product} home`}>
            <Logo className="mk-logo" />
          </Link>
          <nav className="mk-nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mk-actions">
            {user ? (
              <>
                <Link to="/datalake" className="mk-btn mk-btn-primary">
                  Open the app
                </Link>
                <UserMenu />
              </>
            ) : (
              <>
                <button type="button" className="mk-btn mk-btn-ghost" onClick={() => setLoginOpen(true)}>
                  Sign in
                </button>
                <button type="button" className="mk-btn mk-btn-primary" onClick={() => setLoginOpen('register')}>
                  Get started
                </button>
              </>
            )}
          </div>
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
            {user ? (
              <Link to="/datalake" className="mk-btn mk-btn-primary">
                Open the app
              </Link>
            ) : (
              <div className="mk-mobile-actions">
                <button type="button" className="mk-btn mk-btn-outline" onClick={() => setLoginOpen(true)}>
                  Sign in
                </button>
                <button type="button" className="mk-btn mk-btn-primary" onClick={() => setLoginOpen('register')}>
                  Get started
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="mk-main">{children}</main>

      <footer className="mk-footer">
        <div className="mk-container mk-footer-grid">
          <div className="mk-footer-brand">
            <Logo className="mk-footer-logo" />
            <p>Data, visualisation and simulation for resilient regional food systems.</p>
          </div>
          <div>
            <h4>Product</h4>
            <Link to="/#features">Features</Link>
            <Link to="/#how">How it works</Link>
            <Link to="/pricing">Pricing</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/about">About us</Link>
            <Link to="/contact">Contact</Link>
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          </div>
          <div>
            <h4>Legal</h4>
            <Link to="/privacy">Privacy policy</Link>
            <Link to="/terms">Terms of service</Link>
          </div>
        </div>
        <div className="mk-container mk-footer-base">
          <span>
            © {new Date().getFullYear()} {SITE.product}. {SITE.city}.
          </span>
          <span>Baseline and demo data in the prototype are synthetic.</span>
        </div>
      </footer>
      <LoginDialog />
    </div>
  );
}
