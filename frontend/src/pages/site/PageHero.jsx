/** Title block at the top of the inner public pages (on the blue gradient). */
export default function PageHero({ kicker, title, children }) {
  return (
    <section className="mk-page-hero">
      <div className="mk-container mk-page-hero-inner">
        {kicker && <span className="mk-chip">{kicker}</span>}
        <h1>{title}</h1>
        {children && <p className="mk-lead">{children}</p>}
      </div>
    </section>
  );
}
