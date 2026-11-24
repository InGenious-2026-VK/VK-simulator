import { Link } from 'react-router-dom';
import SiteLayout from '../components/SiteLayout.jsx';
import PageHero from './site/PageHero.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { IcCheck } from './site/icons.jsx';

// Plans and what they include. Prices are set per agreement ("on request")
// until list prices are decided — edit here when they are.
const PLANS = [
  {
    name: 'Explorer',
    price: 'Free',
    note: 'for individuals and evaluation',
    cta: 'Create an account',
    action: 'register',
    features: [
      'Browse public datasets',
      'Upload and share your own datasets',
      'Visualisation and quality checks',
      'Run the built-in disruption scenarios',
      '10 GB storage',
    ],
  },
  {
    name: 'Organisation',
    price: 'On request',
    note: 'for municipalities, county boards and companies',
    cta: 'Contact sales',
    action: 'contact',
    featured: true,
    features: [
      'Everything in Explorer',
      'Groups with your own group admins',
      'Custom scenarios on your own network data',
      'Hour-by-hour playback and result export',
      'Larger storage quotas',
      'Onboarding and email support',
    ],
  },
  {
    name: 'Region',
    price: 'Custom',
    note: 'for regional preparedness networks',
    cta: 'Talk to us',
    action: 'contact',
    features: [
      'Everything in Organisation',
      'A dedicated environment for your region',
      'Your region’s baseline network and map',
      'Custom storage and data-retention terms',
      'Training workshops and priority support',
      'Service-level agreement',
    ],
  },
];

const FAQ = [
  ['Can we try it before committing?', 'Yes. Anyone can create a free Explorer account, and we run pilots with public-sector teams. Get in touch to set one up.'],
  ['Who owns the data we upload?', 'You do. You decide whether each dataset is private, shared with a group or public, and you can ask for its removal at any time.'],
  ['Does it work for our region?', 'The platform is region-independent. The Region plan includes setting up your own baseline network and map.'],
  ['How do you price public-sector organisations?', 'Organisation and Region prices depend on the number of users, storage and support you need. Contact us for a quote.'],
];

export default function PricingPage() {
  const { user, setLoginOpen } = useAuth();
  return (
    <SiteLayout>
      <PageHero kicker="Pricing" title="Simple plans that grow with your network">
        Start for free. Move to an organisation or regional plan when your team is ready.
      </PageHero>

      <section className="mk-section mk-section-tight">
        <div className="mk-container mk-plans">
          {PLANS.map((p) => (
            <article key={p.name} className={`mk-card mk-plan${p.featured ? ' featured' : ''}`}>
              {p.featured && <span className="mk-badge">Most popular</span>}
              <h3>{p.name}</h3>
              <div className="mk-price">{p.price}</div>
              <p className="mk-muted">{p.note}</p>
              {p.action === 'register' ? (
                user ? (
                  <Link to="/datalake" className="mk-btn mk-btn-outline mk-btn-block">
                    Open the app
                  </Link>
                ) : (
                  <button type="button" className="mk-btn mk-btn-outline mk-btn-block" onClick={() => setLoginOpen('register')}>
                    {p.cta}
                  </button>
                )
              ) : (
                <Link
                  to="/contact?topic=pricing"
                  className={`mk-btn mk-btn-block ${p.featured ? 'mk-btn-primary' : 'mk-btn-outline'}`}
                >
                  {p.cta}
                </Link>
              )}
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <IcCheck />
                    {f}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-section mk-section-tint">
        <div className="mk-container mk-narrow">
          <div className="mk-section-head">
            <h2>Frequently asked questions</h2>
          </div>
          <div className="mk-faq">
            {FAQ.map(([q, a]) => (
              <details key={q} className="mk-card">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
