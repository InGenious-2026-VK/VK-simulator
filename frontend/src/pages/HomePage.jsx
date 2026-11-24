import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SiteLayout from '../components/SiteLayout.jsx';
import NetworkBackground from '../components/NetworkBackground.jsx';
import HeroVisual from './site/HeroVisual.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { IcArrow, IcChart, IcCheck, IcDatabase, IcNetwork, IcPlay, IcShield, IcUsers } from './site/icons.jsx';

const FEATURES = [
  {
    icon: IcDatabase,
    title: 'Shared data lake',
    body: 'Collect production, processing, logistics, energy and population data in one place. Every upload carries standard metadata, so others can trust and reuse it.',
  },
  {
    icon: IcChart,
    title: 'Check before you rely on it',
    body: 'Coverage maps, field profiles, automatic charts and cross-dataset checks show gaps and errors before your data feeds a decision.',
  },
  {
    icon: IcNetwork,
    title: 'Disruption simulation',
    body: 'Close a corridor, cut power to a substation, lose half a harvest or ration fuel — and see how the supply network reroutes and where it breaks.',
  },
  {
    icon: IcPlay,
    title: 'Hour-by-hour playback',
    body: 'Play a scenario back on the map: goods moving along corridors, buffers draining, and towns turning red as they run short.',
  },
  {
    icon: IcUsers,
    title: 'Built for collaboration',
    body: 'Keep data private, share it with a group or publish it to everyone signed in. Group admins manage their own members.',
  },
  {
    icon: IcShield,
    title: 'Secure by design',
    body: 'Approved accounts only, role-based access, sensitive datasets that can never be made public, and a full audit log.',
  },
];

const STEPS = [
  {
    title: 'Bring your data',
    body: 'Upload datasets with a metadata file, or use what producers, municipalities and agencies have already shared.',
  },
  {
    title: 'Check and combine',
    body: 'Pick the datasets you need, review them on a map with charts and quality checks, and confirm they are ready to simulate.',
  },
  {
    title: 'Simulate and act',
    body: 'Run disruption scenarios on a network built from your selection, play them back, and export the results for planning.',
  },
];

const QUESTIONS = [
  'Which towns go short first if a main road or rail corridor closes?',
  'How many days do local food buffers last in a fuel or power crisis?',
  'Which facilities are single points of failure for the whole region?',
  'Where would one extra cold store or depot add the most resilience?',
];

const AUDIENCES = ['Municipalities', 'County administrative boards', 'Food producers', 'Logistics operators', 'Civil defence & preparedness'];

export default function HomePage() {
  const { user, setLoginOpen } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Arriving from a protected window while signed out → open the sign-in form.
  useEffect(() => {
    if (location.state?.login && !user) setLoginOpen(true);
  }, [location.state, user, setLoginOpen]);

  // After signing in from a redirect, go back where the user was heading.
  useEffect(() => {
    if (user && location.state?.from) navigate(location.state.from, { replace: true });
  }, [user, location.state, navigate]);

  // /#features, /#how → scroll to that section
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }, [location.hash]);

  const primary = user ? (
    <Link to="/datalake" className="mk-btn mk-btn-primary mk-btn-lg">
      Open the app <IcArrow />
    </Link>
  ) : (
    <button type="button" className="mk-btn mk-btn-primary mk-btn-lg" onClick={() => setLoginOpen('register')}>
      Get started <IcArrow />
    </button>
  );

  return (
    <SiteLayout transparentHeader>
      <section className="mk-hero">
        <NetworkBackground />
        <div className="mk-hero-fade" />
        <div className="mk-container mk-hero-grid">
          <div className="mk-hero-copy">
            <span className="mk-pill">
              <i /> Food supply chain resilience
            </span>
            <h1>
              See how food moves through your region — <span className="mk-grad">and what happens when it stops.</span>
            </h1>
            <p className="mk-lead">
              FoodChainIQ brings production, processing, logistics, energy and population data into one shared
              picture, so planners, producers and preparedness teams can find the weak links before a crisis does.
            </p>
            <div className="mk-hero-actions">
              {primary}
              <a href="#how" className="mk-btn mk-btn-outline mk-btn-lg">
                See how it works
              </a>
            </div>
            <ul className="mk-hero-points">
              <li>
                <IcCheck /> Runs in the browser — nothing to install
              </li>
              <li>
                <IcCheck /> Your data stays yours
              </li>
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="mk-audience">
        <div className="mk-container">
          <p>Built for the people who keep a region fed</p>
          <ul>
            {AUDIENCES.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mk-section" id="features">
        <div className="mk-container">
          <div className="mk-section-head">
            <span className="mk-kicker">Platform</span>
            <h2>Everything you need to understand a regional food system</h2>
            <p>From raw datasets to a playable disruption scenario — in one tool your whole network can use.</p>
          </div>
          <div className="mk-features">
            {FEATURES.map((f) => (
              <article key={f.title} className="mk-card mk-feature">
                <span className="mk-icon">
                  <f.icon />
                </span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section mk-section-tint" id="how">
        <div className="mk-container">
          <div className="mk-section-head">
            <span className="mk-kicker">How it works</span>
            <h2>From data to decisions in three steps</h2>
          </div>
          <ol className="mk-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="mk-card">
                <span className="mk-step-n">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container mk-split">
          <div>
            <span className="mk-kicker">Questions it answers</span>
            <h2>Plan for the disruption before it happens</h2>
            <p className="mk-muted">
              Scenarios run on a network of farms, processors, storage, transport corridors, energy and towns, and
              show who goes without — town by town, hour by hour.
            </p>
            <Link to="/about" className="mk-link">
              Why we built FoodChainIQ <IcArrow />
            </Link>
          </div>
          <ul className="mk-questions">
            {QUESTIONS.map((q) => (
              <li key={q} className="mk-card">
                <span className="mk-q">?</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mk-cta">
        <NetworkBackground color="255, 255, 255" accent="160, 210, 255" density={0.6} />
        <div className="mk-container mk-cta-inner">
          <h2>Start mapping your region's food system</h2>
          <p>Create an account, or talk to us about a pilot for your municipality or county.</p>
          <div className="mk-hero-actions">
            {user ? (
              <Link to="/datalake" className="mk-btn mk-btn-white mk-btn-lg">
                Open the app <IcArrow />
              </Link>
            ) : (
              <button type="button" className="mk-btn mk-btn-white mk-btn-lg" onClick={() => setLoginOpen('register')}>
                Create an account <IcArrow />
              </button>
            )}
            <Link to="/contact" className="mk-btn mk-btn-ghost-white mk-btn-lg">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
