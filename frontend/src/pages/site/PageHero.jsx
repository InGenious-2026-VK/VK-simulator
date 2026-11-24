import NetworkBackground from '../../components/NetworkBackground.jsx';

/** Compact hero used at the top of the inner public pages. */
export default function PageHero({ kicker, title, children }) {
  return (
    <section className="mk-page-hero">
      <NetworkBackground density={0.55} />
      <div className="mk-hero-fade" />
      <div className="mk-container mk-page-hero-inner">
        {kicker && <span className="mk-kicker">{kicker}</span>}
        <h1>{title}</h1>
        {children && <p className="mk-lead">{children}</p>}
      </div>
    </section>
  );
}
