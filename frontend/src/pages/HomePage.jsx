import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader.jsx';
import Logo from '../components/Logo.jsx';
import { Button } from '../components/ui.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { getPublicStats } from '../api/client.js';
import { CATEGORY_META } from './categories.js';

const STEPS = [
  {
    n: '1',
    title: 'Data Lake',
    body: 'Browse datasets shared by producers, municipalities and agencies. Upload your own with a standard metadata file and keep them private, share them with a group, or publish them to all signed-in users.',
  },
  {
    n: '2',
    title: 'Visualization',
    body: 'See what you selected before you rely on it: coverage map, field profiles, automatic charts, cross-dataset checks and a simulation-readiness checklist.',
  },
  {
    n: '3',
    title: 'Simulation',
    body: 'Run disruption scenarios — a severed corridor, a substation failure, a poor harvest, a fuel shortage — on a network built from your datasets, and see who goes without, town by town and day by day.',
  },
];

const LAYERS = ['production', 'processing', 'logistics', 'energy', 'population', 'vulnerability'];

export default function HomePage() {
  const { user, setLoginOpen } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);

  // Arriving from a protected window while signed out → open the login form.
  useEffect(() => {
    if (location.state?.login && !user) setLoginOpen(true);
  }, [location.state, user, setLoginOpen]);

  // After signing in from a redirect, go back where the user was heading.
  useEffect(() => {
    if (user && location.state?.from) navigate(location.state.from, { replace: true });
  }, [user, location.state, navigate]);

  useEffect(() => {
    getPublicStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  return (
    <div className="page">
      <SiteHeader />
      <main className="home">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Food supply chain resilience</span>
            <h1>
              See how food moves through your region — and what happens when it stops.
            </h1>
            <p className="lead">
              FoodChainIQ brings production, processing, logistics, energy and population data into
              one shared picture, so planners, producers and civil-defence actors in any region can
              find the weak links before a crisis does.
            </p>
            <div className="hero-actions">
              {user ? (
                <Button variant="primary" className="btn-lg" onClick={() => navigate('/datalake')}>
                  To data lake →
                </Button>
              ) : (
                <Button variant="primary" className="btn-lg" onClick={() => setLoginOpen(true)}>
                  Sign in to get started
                </Button>
              )}
              <a className="btn btn-outline btn-lg" href="#how">
                How it works
              </a>
            </div>
            {user && <p className="muted small">Signed in as {user.display_name}.</p>}
          </div>
          <HeroGraphic />
        </section>

        <section className="home-section" id="how">
          <h2>How it works</h2>
          <div className="steps">
            {STEPS.map((s) => (
              <article key={s.n} className="step-card">
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section split">
          <div>
            <h2>Data layers</h2>
            <p className="muted">
              Each layer is useful alone; together they show dependencies — that a dairy depends on
              feed transport, a substation and a cold chain.
            </p>
            <ul className="layer-list">
              {LAYERS.map((id) => (
                <li key={id}>
                  <i style={{ background: CATEGORY_META[id].color }} />
                  <strong>{CATEGORY_META[id].label}</strong>
                  <span className="muted">{CATEGORY_META[id].blurb}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="stats-card">
            <h3>Public catalogue</h3>
            {stats ? (
              <>
                <p className="big-number mono">{stats.public_datasets}</p>
                <p className="muted">public datasets available to signed-in users</p>
                <ul className="cat-counts">
                  {Object.entries(stats.categories).map(([cat, n]) => (
                    <li key={cat}>
                      <i style={{ background: CATEGORY_META[cat]?.color ?? '#a1a1aa' }} />
                      {CATEGORY_META[cat]?.label ?? cat}
                      <span className="mono">{n}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">Catalogue statistics appear here when the backend is running.</p>
            )}
            <p className="muted small">
              Dataset contents are only ever shown to signed-in users. Restricted data can never be
              made public.
            </p>
          </div>
        </section>

        <section className="home-section">
          <h2>Partners</h2>
          <p className="muted partners">
            Developed in the <strong>InGenious 2026</strong> programme (Linköping University) with{' '}
            <strong>Vreta Kluster</strong>. Built for municipalities, county administrative boards,
            food producers and preparedness actors in any region, and designed to support national
            and regional supply-preparedness and food strategies.
          </p>
        </section>
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          <Logo className="footer-logo" />
          <span>Food system resilience</span>
        </span>
        <span className="muted">Prototype — baseline and demo data are synthetic.</span>
      </footer>
    </div>
  );
}

function HeroGraphic() {
  // A small stylised supply network: farms → processing → storage → towns.
  const nodes = [
    [40, 60, '#0d9488'], [50, 160, '#0d9488'], [30, 250, '#0d9488'],
    [160, 100, '#f97316'], [170, 220, '#f97316'],
    [280, 150, '#1e4e6e'],
    [390, 70, '#eab308'], [400, 160, '#eab308'], [380, 250, '#eab308'],
  ];
  const links = [[0, 3], [1, 3], [1, 4], [2, 4], [3, 5], [4, 5], [5, 6], [5, 7], [5, 8], [4, 8]];
  return (
    <svg className="hero-graphic" viewBox="0 0 430 310" role="img" aria-label="Stylised food supply network">
      {links.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a][0]}
          y1={nodes[a][1]}
          x2={nodes[b][0]}
          y2={nodes[b][1]}
          stroke={i === 4 ? '#e7000b' : '#a1a1aa'}
          strokeDasharray={i === 4 ? '5 4' : ''}
          strokeWidth="2"
        />
      ))}
      {nodes.map(([x, y, c], i) => (
        <circle key={i} cx={x} cy={y} r={i === 5 ? 14 : 10} fill={c} stroke="#fff" strokeWidth="3" />
      ))}
      <text x="12" y="300" className="hero-label">farms</text>
      <text x="140" y="300" className="hero-label">processing</text>
      <text x="258" y="300" className="hero-label">storage</text>
      <text x="370" y="300" className="hero-label">towns</text>
    </svg>
  );
}
