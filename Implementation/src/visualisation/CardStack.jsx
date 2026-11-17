import { useEffect, useRef } from 'react';
import { CHARTS, MAP_TYPES } from './charts.js';
import { useViewStack } from './useViewStack.js';

// Cards kept in the page, by depth relative to the top card:
// -1 has just peeled off (invisible, kept so going back can animate it in again),
//  0 is the top card, 1 and 2 lie greyed underneath,
//  3 waits invisibly at the bottom, so it can fade in when the stack moves up.
const DEPTHS = [-1, 0, 1, 2, 3];

// Mouse wheel: how much scrolling turns one card, and how long one gesture
// (a fast spin, or a trackpad's inertia) is treated as a single turn.
const WHEEL_STEP = 50; // px of deltaY
const GESTURE_GAP = 200; // ms without wheel events that ends a gesture
const TURN_LOCK = 600; // ms after a turn before the same gesture may turn again

/**
 * One dataset as a stack of cards, one view (a small chart) per card.
 * Mouse wheel, arrow keys or the buttons turn the cards; more views are
 * loaded from the backend as the user gets near the bottom of what is loaded.
 */
export default function CardStack({ datasetId }) {
  const stack = useViewStack(datasetId);
  const { status, dataset, views, total, error, index, next, prev } = stack;
  const tile = useRef(null);

  // The wheel listener is attached once; it reads the latest state from here.
  const latest = useRef(stack);
  latest.current = stack;

  useEffect(() => {
    const el = tile.current;
    let sum = 0;
    let lastEvent = 0;
    let lockedUntil = 0;

    const onWheel = (e) => {
      const s = latest.current;
      const dir = Math.sign(e.deltaY);
      if (!dir) return;
      // At either end of the stack the wheel scrolls the page as usual.
      if (dir > 0 ? s.index >= s.total - 1 : s.index <= 0) return;
      e.preventDefault(); // needs { passive: false }, below

      const now = performance.now();
      const newGesture = now - lastEvent > GESTURE_GAP;
      lastEvent = now;
      if (newGesture) sum = 0;
      else if (now < lockedUntil) return;

      // deltaMode 1 = lines, 2 = pages (some mice and browsers).
      sum += e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1);
      if (Math.abs(sum) < WHEEL_STEP) return;
      sum = 0;
      lockedUntil = now + TURN_LOCK;
      if (dir > 0) s.next();
      else s.prev();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onKeyDown = (e) => {
    if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) next();
    else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) prev();
    else return;
    e.preventDefault();
  };

  const waitingForMore = status === 'ready' && index === views.length - 1 && views.length < total;

  return (
    <section
      ref={tile}
      className="viz-tile"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-roledescription="card stack"
      aria-label={dataset ? `${dataset.title}: card ${index + 1} of ${total}` : 'Loading dataset'}
    >
      <header className="viz-tile-header">
        <h2>{dataset?.title ?? datasetId}</h2>
        {dataset?.subtitle && <p>{dataset.subtitle}</p>}
      </header>

      <div className="viz-stack">
        <div className="viz-stack-inner">
          {status === 'loading' && <PlaceholderCard text="Loading…" />}
          {status === 'error' && <PlaceholderCard text={error.message} isError />}
          {DEPTHS.map((depth) => {
            const view = views[index + depth];
            return view && <Card key={view.index} view={view} depth={depth} />;
          })}
        </div>
      </div>

      <footer className="viz-tile-footer">
        <div className="viz-tile-controls">
          <button type="button" onClick={prev} disabled={index === 0} aria-label="Previous card">
            ‹
          </button>
          <span className="viz-tile-count">
            {status === 'ready' ? `${index + 1} / ${total}` : '–'}
          </span>
          <button type="button" onClick={next} disabled={index >= views.length - 1} aria-label="Next card">
            ›
          </button>
          {waitingForMore && !error && <span className="viz-tile-note">loading more…</span>}
          {status === 'ready' && error && <span className="viz-tile-note viz-error">could not load more</span>}
        </div>
        {dataset?.source && <span className="viz-tile-source">Source: {dataset.source}</span>}
      </footer>
    </section>
  );
}

function Card({ view, depth }) {
  const View = CHARTS[view.type];
  // Only the top card (and the one peeling away from it) draws a live map:
  // browsers allow few WebGL maps at once, and the cards below are greyed anyway.
  const isMap = MAP_TYPES.has(view.type);
  const drawn = isMap ? depth <= 0 : depth <= 2;

  let content = null;
  if (!View) content = <p className="viz-message viz-error">No chart for type "{view.type}" yet.</p>;
  else if (drawn) content = <View rows={view.rows} unit={view.unit ?? ''} wheelZoom={false} />;
  else if (isMap) content = <div className="viz-card-map-placeholder" />;

  return (
    <article className="viz-card" data-depth={depth} aria-hidden={depth !== 0}>
      <header className="viz-card-header">
        <h3>{view.title}</h3>
        {view.subtitle && <p>{view.subtitle}</p>}
      </header>
      <div className="viz-card-body">{content}</div>
    </article>
  );
}

function PlaceholderCard({ text, isError = false }) {
  return (
    <article className="viz-card" data-depth={0}>
      <p className={`viz-message${isError ? ' viz-error' : ''}`}>{text}</p>
    </article>
  );
}
