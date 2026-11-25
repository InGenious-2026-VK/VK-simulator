import './heroVisual.css';
// The hero illustration: a stylised FoodChainIQ workspace (map, KPIs,
// playback) with two floating insight cards. Pure SVG + CSS, decorative only.

// Corridors as smooth curves; ids are reused as motion paths for shipments.
const ROUTES = [
  { id: 'r1', d: 'M70 92 C112 84 150 104 186 128', kind: 'road' },
  { id: 'r2', d: 'M86 196 C118 176 150 152 186 128', kind: 'road' },
  { id: 'r3', d: 'M186 128 C226 118 262 102 300 84', kind: 'rail' },
  { id: 'r4', d: 'M186 128 C204 162 226 186 262 206', kind: 'road' },
  { id: 'r5', d: 'M300 84 C320 120 314 166 262 206', kind: 'closed' },
  { id: 'r6', d: 'M86 196 C140 214 200 224 262 206', kind: 'road' },
  { id: 'r7', d: 'M300 84 C332 70 352 72 370 98', kind: 'road' },
];

const NODES = [
  { x: 70, y: 92, kind: 'farm' },
  { x: 86, y: 196, kind: 'farm' },
  { x: 186, y: 128, kind: 'hub' },
  { x: 300, y: 84, kind: 'store' },
  { x: 262, y: 206, kind: 'town', alert: 'severe' },
  { x: 370, y: 98, kind: 'town', alert: 'minor' },
];

const SHIPMENTS = [
  { route: 'r1', dur: 4.2, delay: 0 },
  { route: 'r1', dur: 4.2, delay: 2.1 },
  { route: 'r2', dur: 3.6, delay: 0.8 },
  { route: 'r3', dur: 3.2, delay: 0.3, rail: true },
  { route: 'r3', dur: 3.2, delay: 1.9, rail: true },
  { route: 'r4', dur: 3.4, delay: 1.2 },
  { route: 'r6', dur: 5, delay: 0.5 },
  { route: 'r7', dur: 2.8, delay: 1.5 },
];

function Spark({ d, color }) {
  return (
    <svg viewBox="0 0 64 20" className="hv-spark" aria-hidden="true">
      <path d={`${d} L64 20 L0 20 Z`} fill={color} opacity=".1" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HeroVisual() {
  return (
    <div className="hv" aria-hidden="true">
      <div className="hv-glow" />

      <div className="hv-window">
        <div className="hv-bar">
          <span className="hv-lights">
            <i />
            <i />
            <i />
          </span>
          <span className="hv-tabs">
            <b>Scenario</b>
            <span>Winter corridor closure</span>
          </span>
          <span className="hv-live">
            <i /> Playback
          </span>
        </div>

        <div className="hv-body">
          <div className="hv-map">
            <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="hv-land" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#f2f7fd" />
                  <stop offset="1" stopColor="#e3eefa" />
                </linearGradient>
                <linearGradient id="hv-road" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#7fb0de" />
                  <stop offset="1" stopColor="#3d8bd0" />
                </linearGradient>
                <radialGradient id="hv-halo-severe">
                  <stop offset="0" stopColor="#ef4444" stopOpacity=".35" />
                  <stop offset="1" stopColor="#ef4444" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="hv-halo-minor">
                  <stop offset="0" stopColor="#f59e0b" stopOpacity=".32" />
                  <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
                </radialGradient>
                <pattern id="hv-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M20 0H0V20" fill="none" stroke="#dbe7f4" strokeWidth=".6" />
                </pattern>
              </defs>

              <rect width="400" height="260" fill="#f8fbfe" />
              <rect width="400" height="260" fill="url(#hv-grid)" />
              {/* region and a lake */}
              <path
                d="M28 70 C60 30 140 22 210 34 C270 44 340 30 380 66 C404 92 396 150 372 190 C344 236 270 250 196 244 C120 238 50 226 30 180 C16 146 10 100 28 70 Z"
                fill="url(#hv-land)"
                stroke="#c9dcf0"
                strokeWidth="1.2"
              />
              <path d="M122 52 C140 44 164 50 166 62 C168 74 146 80 130 76 C116 72 110 60 122 52 Z" fill="#cfe3f7" />
              {/* contour lines */}
              <path d="M40 150 C90 130 120 170 170 160 S260 120 330 150" fill="none" stroke="#d6e5f4" strokeWidth="1" />
              <path d="M50 120 C100 100 140 140 190 128 S270 96 360 120" fill="none" stroke="#dfeaf6" strokeWidth="1" />

              {ROUTES.map((r) => (
                <path
                  key={r.id}
                  id={`hv-${r.id}`}
                  d={r.d}
                  fill="none"
                  stroke={r.kind === 'closed' ? '#ef4444' : r.kind === 'rail' ? '#011e3b' : 'url(#hv-road)'}
                  strokeWidth={r.kind === 'rail' ? 2.6 : 3}
                  strokeLinecap="round"
                  strokeDasharray={r.kind === 'closed' ? '6 6' : undefined}
                  opacity={r.kind === 'closed' ? 0.85 : 0.9}
                />
              ))}
              {/* closure marker */}
              <g transform="translate(318 146)">
                <circle r="9" fill="#fff" stroke="#ef4444" strokeWidth="1.6" />
                <path d="M-3.5 -3.5 3.5 3.5M3.5 -3.5 -3.5 3.5" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />
              </g>

              {SHIPMENTS.map((s, i) => (
                <circle key={i} r={s.rail ? 3.4 : 3} fill={s.rail ? '#011e3b' : '#0061ac'} stroke="#fff" strokeWidth="1.4">
                  <animateMotion dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" rotate="auto">
                    <mpath href={`#hv-${s.route}`} />
                  </animateMotion>
                </circle>
              ))}

              {NODES.map((n, i) => (
                <g key={i} transform={`translate(${n.x} ${n.y})`}>
                  {n.alert && <circle r="26" fill={`url(#hv-halo-${n.alert})`} className="hv-pulse" />}
                  {n.kind === 'hub' ? (
                    <>
                      <circle r="11" fill="#fff" stroke="#0061ac" strokeWidth="2" />
                      <circle r="5" fill="#0061ac" />
                    </>
                  ) : n.kind === 'store' ? (
                    <rect x="-7" y="-7" width="14" height="14" rx="3.5" fill="#011e3b" stroke="#fff" strokeWidth="2" />
                  ) : n.kind === 'farm' ? (
                    <circle r="6.5" fill="#4ca72b" stroke="#fff" strokeWidth="2.2" />
                  ) : (
                    <circle r="7.5" fill={n.alert === 'severe' ? '#ef4444' : '#f59e0b'} stroke="#fff" strokeWidth="2.4" />
                  )}
                </g>
              ))}
            </svg>

            <div className="hv-legend">
              <span>
                <i className="farm" /> Farms
              </span>
              <span>
                <i className="hub" /> Processing
              </span>
              <span>
                <i className="rail" /> Rail
              </span>
              <span>
                <i className="closed" /> Closed
              </span>
            </div>
          </div>

          <div className="hv-kpis">
            <div className="hv-kpi">
              <small>Demand met</small>
              <b>87.4%</b>
              <Spark d="M0 4 C10 4 16 6 24 8 S40 12 48 13 64 14 64 14" color="#0061ac" />
            </div>
            <div className="hv-kpi">
              <small>Buffers left</small>
              <b>3.2 days</b>
              <Spark d="M0 3 L16 6 L32 10 L48 14 L64 17" color="#f59e0b" />
            </div>
            <div className="hv-kpi">
              <small>Towns at risk</small>
              <b className="bad">2 of 13</b>
              <Spark d="M0 18 L20 18 L32 15 L44 11 L64 6" color="#ef4444" />
            </div>
          </div>
        </div>

        <div className="hv-timeline">
          <span className="hv-play">
            <svg viewBox="0 0 12 12">
              <path d="M3 2v8l7-4z" fill="currentColor" />
            </svg>
          </span>
          <span className="hv-clock">Day 4 · 14:00</span>
          <div className="hv-track">
            <i className="hv-fill" />
            <i className="hv-mark warn" style={{ left: '8%' }} />
            <i className="hv-mark bad" style={{ left: '72%' }} />
          </div>
          <span className="hv-speed">2×</span>
        </div>
      </div>

      <div className="hv-float hv-float-a">
        <span className="hv-float-icon bad">!</span>
        <div>
          <b>Shortfall in 2 towns</b>
          <small>Local buffers run out on day 6</small>
        </div>
      </div>

      <div className="hv-float hv-float-b">
        <span className="hv-float-icon ok">
          <svg viewBox="0 0 16 16">
            <path d="M2 11h7l-2 3M14 5H7l2-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <b>Rerouted via rail</b>
          <small>+18% capacity on the east line</small>
        </div>
      </div>
    </div>
  );
}
