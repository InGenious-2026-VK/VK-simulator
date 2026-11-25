import SiteLayout from '../../components/SiteLayout.jsx';
import PageHero from './PageHero.jsx';
import { SITE } from '../../content/site.js';

/** Long-form legal document with a sticky table of contents. */
export default function LegalPage({ kicker, title, intro, sections }) {
  return (
    <SiteLayout>
      <PageHero kicker={kicker} title={title}>
        Last updated {SITE.legalUpdated}
      </PageHero>
      <section className="mk-section mk-section-tight">
        <div className="mk-container mk-legal">
          <nav className="mk-card mk-toc" aria-label="Contents">
            <strong>Contents</strong>
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="mk-card mk-legal-body mk-prose">
            {intro}
            {sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2>{s.title}</h2>
                {s.body}
              </section>
            ))}
          </article>
        </div>
      </section>
    </SiteLayout>
  );
}
