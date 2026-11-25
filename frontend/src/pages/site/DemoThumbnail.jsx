import boundary from '../../data/ostergotland-boundary.json';

// Project the region outline into a 640×360 frame (equirectangular, corrected
// for latitude), so the thumbnail shows the real shape of the demo region.
const W = 640;
const H = 360;
const ring = boundary.features[0].geometry.coordinates[0];
const lats = ring.map((p) => p[1]);
const lons = ring.map((p) => p[0]);
const k = Math.cos(((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180));
const minX = Math.min(...lons) * k;
const maxX = Math.max(...lons) * k;
const minY = Math.min(...lats);
const maxY = Math.max(...lats);
const scale = Math.min((W * 0.8) / (maxX - minX), (H * 0.82) / (maxY - minY));
const offX = (W - (maxX - minX) * scale) / 2;
const offY = (H - (maxY - minY) * scale) / 2;
const project = ([lon, lat]) => [offX + (lon * k - minX) * scale, offY + (maxY - lat) * scale];
const OUTLINE = ring.map((p, i) => `${i ? 'L' : 'M'}${project(p).map((v) => v.toFixed(1)).join(' ')}`).join(' ') + 'Z';

// Nodes in relative frame positions, each with a small icon.
const NODES = [
  { x: 0.34, y: 0.6, icon: 'wheat' },
  { x: 0.4, y: 0.3, icon: 'factory' },
  { x: 0.46, y: 0.74, icon: 'warehouse' },
  { x: 0.61, y: 0.62, icon: 'truck' },
  { x: 0.73, y: 0.44, icon: 'cart' },
  { x: 0.67, y: 0.9, icon: 'people' },
].map((n) => ({ ...n, x: n.x * W, y: n.y * H }));
const LINKS = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [1, 4], [3, 5], [2, 5]];

const ICON = {
  wheat: 'M12 20V9M12 9c-2-1-3-3-3-5 2 1 3 2.5 3 5zM12 9c2-1 3-3 3-5-2 1-3 2.5-3 5zM12 14c-2.5-.5-4-2.5-4.5-4.5 2.3.3 4 2 4.5 4.5zM12 14c2.5-.5 4-2.5 4.5-4.5-2.3.3-4 2-4.5 4.5z',
  factory: 'M4 19V11l4 2.5V11l4 2.5V11l4 2.5V6h3v13z',
  warehouse: 'M4 10l8-4.5 8 4.5v9H4zM8 19v-5h8v5',
  truck: 'M3 8h10v8H3zM13 11h4l3 3v2h-7zM7 18.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8zM17 18.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z',
  cart: 'M4 5h2l2 9h9l2-6H7M9.5 18.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zM16.5 18.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
  people: 'M9 11a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 9 11zM4.5 18c.5-2.6 2.3-4 4.5-4s4 1.4 4.5 4M16 11.5a2.2 2.2 0 1 0 0-4.4M15.5 14c1.9.2 3.4 1.5 3.9 4',
};

/** Dark, glowing map of the demo region used as the "video" thumbnail. */
export default function DemoThumbnail() {
  return (
    <svg className="demo-thumb-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="dt-bg" cx="50%" cy="45%" r="75%">
          <stop offset="0" stopColor="#0f3b6e" />
          <stop offset="1" stopColor="#041427" />
        </radialGradient>
        <filter id="dt-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="dt-land" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e5d99" stopOpacity=".55" />
          <stop offset="1" stopColor="#0b2f57" stopOpacity=".55" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#dt-bg)" />
      {Array.from({ length: 70 }, (_, i) => (
        <circle key={i} cx={(i * 97) % W} cy={(i * 53) % H} r={(i % 3) * 0.5 + 0.4} fill="#9fd0ff" opacity={0.15 + (i % 5) * 0.06} />
      ))}
      <path d={OUTLINE} fill="url(#dt-land)" stroke="#6fb8ff" strokeWidth="1.6" filter="url(#dt-glow)" />
      {LINKS.map(([a, b], i) => (
        <path
          key={i}
          id={`dt-l${i}`}
          d={`M${NODES[a].x} ${NODES[a].y} Q${(NODES[a].x + NODES[b].x) / 2} ${(NODES[a].y + NODES[b].y) / 2 - 22} ${NODES[b].x} ${NODES[b].y}`}
          fill="none"
          stroke="#7cc4ff"
          strokeWidth="1.4"
          opacity=".55"
        />
      ))}
      {LINKS.map((_, i) => (
        <circle key={i} r="2.6" fill="#d8efff" filter="url(#dt-glow)">
          <animateMotion dur={`${3 + (i % 3)}s`} begin={`${i * 0.4}s`} repeatCount="indefinite">
            <mpath href={`#dt-l${i}`} />
          </animateMotion>
        </circle>
      ))}
      {NODES.map((n, i) => (
        <g key={i} transform={`translate(${n.x} ${n.y})`}>
          <circle r="21" fill="#0b2f57" stroke="#8fd0ff" strokeWidth="1.6" filter="url(#dt-glow)" />
          <g transform="translate(-12 -12)" fill="none" stroke="#e6f4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICON[n.icon]} />
          </g>
        </g>
      ))}
    </svg>
  );
}
