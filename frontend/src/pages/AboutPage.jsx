import { Link } from 'react-router-dom';
import SiteLayout from '../components/SiteLayout.jsx';
import PageHero from './site/PageHero.jsx';
import { IcArrow, IcNetwork, IcShield, IcUsers } from './site/icons.jsx';

const VALUES = [
  {
    icon: IcNetwork,
    title: 'See the whole chain',
    body: 'Food security depends on farms, processors, storage, transport, energy and people at once. We put them on one map so the dependencies become visible.',
  },
  {
    icon: IcUsers,
    title: 'Share to prepare',
    body: 'No single organisation holds the full picture. FoodChainIQ makes it safe and simple to share exactly what is needed, with exactly who needs it.',
  },
  {
    icon: IcShield,
    title: 'Trust by default',
    body: 'Clear metadata, quality checks, access control and an audit trail, so decisions rest on data people can stand behind.',
  },
];

export default function AboutPage() {
  return (
    <SiteLayout>
      <PageHero kicker="About us" title="Making regional food systems easier to understand — and harder to break">
        FoodChainIQ helps the people responsible for feeding a region see how food moves, where it is vulnerable,
        and what to do about it.
      </PageHero>

      <section className="mk-section">
        <div className="mk-container mk-split mk-split-top">
          <div>
            <span className="mk-kicker">Our story</span>
            <h2>Born from a preparedness challenge</h2>
          </div>
          <div className="mk-prose">
            <p>
              FoodChainIQ started in the <strong>InGenious 2026</strong> programme at Linköping University, together
              with the food cluster <strong>Vreta Kluster</strong>. Municipalities, county administrative boards and
              food producers told us the same thing: the data needed to plan for a crisis exists, but it is spread
              across organisations, formats and spreadsheets — and nobody can see the whole chain at once.
            </p>
            <p>
              So we built a shared data lake for food-system data, tools to check it, and a simulator that turns it
              into a living network. Planners can close a road, cut the power or lose a harvest, and watch — hour by
              hour — which towns run short and how long their buffers last.
            </p>
            <p>
              The platform is built to work for any region. It is designed to support national and regional
              supply-preparedness and food strategies, and to make total-defence planning more concrete.
            </p>
          </div>
        </div>
      </section>

      <section className="mk-section mk-section-tint">
        <div className="mk-container">
          <div className="mk-section-head">
            <span className="mk-kicker">What we believe</span>
            <h2>Our principles</h2>
          </div>
          <div className="mk-features mk-features-3">
            {VALUES.map((v) => (
              <article key={v.title} className="mk-card mk-feature">
                <span className="mk-icon">
                  <v.icon />
                </span>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container mk-callout">
          <div>
            <h2>Want to bring FoodChainIQ to your region?</h2>
            <p className="mk-muted">We work with municipalities, county boards and producer networks on pilots.</p>
          </div>
          <Link to="/contact" className="mk-btn mk-btn-primary mk-btn-lg">
            Talk to us <IcArrow />
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
