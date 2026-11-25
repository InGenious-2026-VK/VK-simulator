import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SiteLayout from '../components/SiteLayout.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { SITE } from '../content/site.js';
import DemoThumbnail from './site/DemoThumbnail.jsx';

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

const CARDS = [
  {
    title: 'Visualize',
    body: 'Map supply chain actors, infrastructure and production lines.',
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <circle cx="6" cy="12" r="2.6" />
        <circle cx="17.5" cy="6" r="2.6" />
        <circle cx="17.5" cy="18" r="2.6" />
        <path d="M8.3 10.8 15.2 7.2M8.3 13.2l6.9 3.6" />
      </svg>
    ),
    art: (
      <svg viewBox="0 0 80 64" aria-hidden="true">
        {[[40, 32, 10, 6], [40, 32, 72, 10], [40, 32, 74, 50], [40, 32, 8, 54], [40, 32, 36, 2], [40, 32, 52, 62]].map(([a, b, c, d], i) => (
          <line key={i} x1={a} y1={b} x2={c} y2={d} stroke="#9bc3e6" strokeWidth="1" />
        ))}
        {[[10, 6], [72, 10], [74, 50], [8, 54], [36, 2], [52, 62]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.4" fill="#6aa7dc" />
        ))}
        <circle cx="40" cy="32" r="13" fill="#e9f3fc" stroke="#3b82c4" strokeWidth="1.4" />
        <circle cx="40" cy="28.5" r="3.6" fill="none" stroke="#1f6fb5" strokeWidth="1.4" />
        <path d="M33.5 39c1-3.6 3.6-5 6.5-5s5.5 1.4 6.5 5" fill="none" stroke="#1f6fb5" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Identify',
    body: 'Understand critical dependencies and potential vulnerabilities.',
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M12 3.5 5 6v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6z" />
        <path d="M12 8.5v4.5M12 16v.2" />
      </svg>
    ),
    art: (
      <svg viewBox="0 0 80 64" aria-hidden="true">
        <path d="M6 60h68" stroke="#9bc3e6" strokeWidth="1.4" />
        {[[12, 40], [28, 28], [44, 16], [60, 6]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="11" height={60 - y} rx="1.5" fill="#fff" stroke="#3b82c4" strokeWidth="1.8" />
        ))}
        <path d="M58 36 70 57H46z" fill="#facc15" stroke="#0b2f57" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M58 43v7M58 53.5v.2" stroke="#0b2f57" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Simulate',
    body: 'Explore what-if scenarios and their potential consequences.',
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M7 5v14l11-7z" />
      </svg>
    ),
    art: (
      <svg viewBox="0 0 80 64" aria-hidden="true" fill="none" stroke="#2563a8" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M36 6 60 18 36 30 12 18z" />
        <path d="M12 28 36 40 60 28" />
        <path d="M12 38 36 50 50 43" />
        <path d="M64 42v16M56 50h16" />
      </svg>
    ),
  },
];

const LeafIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" stroke="#4ca72b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 36V22" />
    <path d="M20 22c-1-8-7-12-15-12 0 8 5 13 15 12z" />
    <path d="M20 26c1-9 7-14 15-14 0 9-5 15-15 14z" />
  </svg>
);

function DemoFrame({ hasVideo, onPlay, children }) {
  return hasVideo ? (
    <button type="button" className="demo-thumb" onClick={onPlay} aria-label="Play the product demonstration">
      {children}
    </button>
  ) : (
    <div className="demo-thumb demo-thumb-static" role="img" aria-label="FoodChainIQ product demonstration preview">
      {children}
    </div>
  );
}

function DemoDialog({ onClose, onTry }) {
  const url = SITE.demoVideoUrl;
  const youtube = url && /youtube\.com|youtu\.be|vimeo\.com/.test(url);
  return (
    <Modal title="FoodChainIQ in action" wide onClose={onClose}>
      {youtube ? (
        <div className="demo-video">
          <iframe src={url} title="FoodChainIQ product demonstration" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <div className="demo-video">
          <video src={url} controls autoPlay playsInline />
        </div>
      )}
      <div className="modal-foot">
        <div className="spacer" />
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn-primary" onClick={onTry}>
          Try it yourself
        </button>
      </div>
    </Modal>
  );
}

export default function HomePage() {
  const { user, setLoginOpen } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [demoOpen, setDemoOpen] = useState(false);

  // Arriving from a protected window while signed out → open the sign-in form.
  useEffect(() => {
    if (location.state?.login && !user) setLoginOpen(true);
  }, [location.state, user, setLoginOpen]);

  // After signing in from a redirect, go back where the user was heading.
  useEffect(() => {
    if (user && location.state?.from) navigate(location.state.from, { replace: true });
  }, [user, location.state, navigate]);

  // /#demo, /#who → scroll to that section
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }, [location.hash]);

  const tryIt = () => {
    setDemoOpen(false);
    if (user) navigate('/simulate');
    else setLoginOpen('register');
  };

  return (
    <SiteLayout>
      <section className="mk-hero">
        <div className="mk-container">
          <h1>
            Understand your supply chain.
            <span>Prepare for tomorrow.</span>
          </h1>
        </div>
      </section>

      <section className="mk-section mk-insight">
        <div className="mk-container">
          <div className="mk-section-head">
            <h2>Turn complex data into strategic insight</h2>
            <p>FoodChainIQ helps you understand the relationships that shape regional food supply chains.</p>
          </div>
          <div className="mk-pillars">
            {CARDS.map((c) => (
              <article key={c.title} className="mk-card mk-pillar">
                <span className="mk-pillar-icon">{c.icon}</span>
                <div className="mk-pillar-text">
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </div>
                <span className="mk-pillar-art">{c.art}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section mk-demo" id="demo">
        <div className="mk-container">
          <div className="mk-section-head">
            <span className="mk-chip">Product demonstration</span>
            <h2>See FoodChainIQ in action</h2>
            <p>Discover how to visualize supply chain networks, simulate disruptions, and identify potential vulnerabilities.</p>
          </div>
          {/* Clickable only once a video is set (SITE.demoVideoUrl); until then it's a still preview. */}
          <DemoFrame hasVideo={Boolean(SITE.demoVideoUrl)} onPlay={() => setDemoOpen(true)}>
            <DemoThumbnail />
            <span className="demo-region">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z" />
                <circle cx="12" cy="10" r="2.3" />
              </svg>
              Östergötland
            </span>
            <span className="demo-play">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5.5v13l10.5-6.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
          </DemoFrame>
        </div>
      </section>

      <section className="mk-section mk-who" id="who">
        <div className="mk-container">
          <h2>Who we are</h2>
          <p>
            FoodChainIQ is driven by the ambition to make supply chains more transparent, understandable and resilient.
            We develop data-driven solutions that help organizations gain a clearer picture of their supply-chain
            networks, understand critical dependencies and anticipate potential disruptions.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section-tight">
        <div className="mk-container">
          <div className="mk-card mk-ready">
            <span className="mk-ready-icon">
              <LeafIcon />
            </span>
            <div className="mk-ready-text">
              <h3>Ready to get started?</h3>
              <p>Create an account and start exploring your food supply chain.</p>
            </div>
            <div className="mk-ready-actions">
              {user ? (
                <button type="button" className="mk-btn mk-btn-primary mk-btn-lg" onClick={() => navigate('/datalake')}>
                  Open the app
                </button>
              ) : (
                <>
                  <button type="button" className="mk-btn mk-btn-primary mk-btn-lg" onClick={() => setLoginOpen('register')}>
                    Create account
                  </button>
                  <button type="button" className="mk-btn mk-btn-outline mk-btn-lg" onClick={() => setLoginOpen(true)}>
                    Log in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {demoOpen && <DemoDialog onClose={() => setDemoOpen(false)} onTry={tryIt} />}
    </SiteLayout>
  );
}
