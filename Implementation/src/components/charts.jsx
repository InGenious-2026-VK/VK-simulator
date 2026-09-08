/* Inline-SVG chart primitives, ported from the Claude Design handoff.
   Deterministic (seeded) where the data is illustrative. */

export function makeRng(seed = 42) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/**
 * Multi-series line chart.
 * series: [{ d: number[], c: color, w?, dash?, band? }]
 * shock: [fromIndex, toIndex] shaded window, or null
 */
export function LineChart({ series, w = 300, h = 88, shock = [9, 15] }) {
  const n = series[0].d.length;
  const span = n > 1 ? n - 1 : 1;
  const x = (i) => (i / span) * (w - 4) + 2;
  const all = series.flatMap((s) => s.d);
  const mn = Math.min(...all) * 0.9;
  const mx = Math.max(...all) * 1.05;
  const y = (v) => h - 6 - ((v - mn) / (mx - mn || 1)) * (h - 16);

  const grid = [];
  for (let i = 0; i < 4; i++) {
    const yy = 6 + (i * (h - 14)) / 3;
    grid.push(<line key={i} x1="0" x2={w} y1={yy} y2={yy} stroke="#f4f4f5" strokeWidth="1" />);
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      {grid}
      {shock && (
        <rect x={x(shock[0])} width={x(shock[1]) - x(shock[0])} y="0" height={h} fill="#e7000b" opacity=".05" />
      )}
      {series.map((s, si) => {
        const p = s.d.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
        return (
          <g key={si}>
            {s.band && <path d={`${p} L${x(n - 1)} ${h} L${x(0)} ${h}Z`} fill={s.c} opacity=".07" />}
            <path
              d={p}
              fill="none"
              stroke={s.c}
              strokeWidth={s.w || 1.8}
              strokeDasharray={s.dash || ''}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}

export function StackedBars({ w = 300, h = 96, seed = 7 }) {
  const rng = makeRng(seed);
  const cols = ['#1e4e6e', '#0d9488', '#f97316', '#eab308', '#f59e0b', '#a1a1aa'];
  const bw = (w - 8) / 12;
  const rects = [];
  for (let i = 0; i < 12; i++) {
    let acc = 0;
    const total = h - 18;
    cols.forEach((c, ci) => {
      const v = (0.06 + rng() * 0.18) * total * (1 - ci * 0.06);
      rects.push(
        <rect
          key={`${i}-${ci}`}
          x={(4 + i * bw + 1).toFixed(1)}
          y={(h - 12 - acc - v).toFixed(1)}
          width={(bw - 2).toFixed(1)}
          height={v.toFixed(1)}
          fill={c}
          opacity=".9"
        />
      );
      acc += v;
    });
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      {rects}
      <line x1="0" x2={w} y1={h - 12} y2={h - 12} stroke="#e4e4e7" />
    </svg>
  );
}

export function Histogram({ w = 300, h = 76, seed = 11 }) {
  const rng = makeRng(seed);
  const n = 18;
  const bw = (w - 6) / n;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const t = (i - 8.5) / 4.2;
    const v = Math.exp((-t * t) / 2) * (h - 20) * (0.9 + rng() * 0.2);
    bars.push(
      <rect
        key={i}
        x={(3 + i * bw + 0.8).toFixed(1)}
        y={(h - 10 - v).toFixed(1)}
        width={(bw - 1.6).toFixed(1)}
        height={v.toFixed(1)}
        fill={i < 4 ? '#e7000b' : '#1e4e6e'}
        opacity={i < 4 ? 0.75 : 0.55}
      />
    );
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      {bars}
      <line x1={3 + 4 * bw} x2={3 + 4 * bw} y1="2" y2={h - 10} stroke="#e7000b" strokeWidth="1.2" strokeDasharray="3 3" />
      <line x1="0" x2={w} y1={h - 10} y2={h - 10} stroke="#e4e4e7" />
    </svg>
  );
}

export function Sankey({ w = 300, h = 132, seed = 3 }) {
  const rng = makeRng(seed);
  const cols = [
    [['Farms', 1], ['Import', 0.42]],
    [['Processing', 0.78], ['Direct', 0.34]],
    [['DC', 0.86], ['Local', 0.28]],
    [['Retail', 0.8], ['Food service', 0.3]],
  ];
  const colX = [6, 100, 196, 290];
  const colors = ['#0d9488', '#f97316', '#1e4e6e', '#eab308'];
  const nodes = [];
  const links = [];
  const pos = [];
  cols.forEach((col, ci) => {
    const tot = col.reduce((a, b) => a + b[1], 0);
    let y = 8;
    const avail = h - 30;
    pos[ci] = col.map(([nm, v]) => {
      const hh = (v / tot) * avail;
      const o = { y, h: hh, nm };
      nodes.push(
        <rect key={`n${ci}-${nm}`} x={colX[ci] - (ci === 3 ? 7 : 0)} y={y.toFixed(1)} width="7" height={hh.toFixed(1)} rx="1.5" fill={colors[ci]} />
      );
      nodes.push(
        <text
          key={`t${ci}-${nm}`}
          x={ci === 3 ? colX[ci] - 11 : colX[ci] + 11}
          y={(y + hh / 2 + 3).toFixed(1)}
          fontSize="8.5"
          fill="#71717a"
          textAnchor={ci === 3 ? 'end' : 'start'}
          fontFamily="Geist,system-ui"
        >
          {nm}
        </text>
      );
      y += hh + 8;
      return o;
    });
  });
  for (let ci = 0; ci < 3; ci++) {
    pos[ci].forEach((a, ai) => {
      pos[ci + 1].forEach((b, bi) => {
        if ((ai + bi) % 2 === 1 && rng() > 0.55) return;
        const th = Math.min(a.h, b.h) * (ai === bi ? 0.62 : 0.3);
        const y1 = a.y + a.h / 2;
        const y2 = b.y + b.h / 2;
        const x1 = colX[ci] + 7;
        const x2 = colX[ci + 1] - (ci + 1 === 3 ? 7 : 0);
        const mx = (x1 + x2) / 2;
        links.push(
          <path
            key={`l${ci}-${ai}-${bi}`}
            d={`M${x1} ${y1 - th / 2} C${mx} ${y1 - th / 2} ${mx} ${y2 - th / 2} ${x2} ${y2 - th / 2} L${x2} ${y2 + th / 2} C${mx} ${y2 + th / 2} ${mx} ${y1 + th / 2} ${x1} ${y1 + th / 2}Z`}
            fill={colors[ci]}
            opacity=".16"
          />
        );
      });
    });
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      {links}
      {nodes}
    </svg>
  );
}

export function Radar({ w = 300, h = 170, vals, base }) {
  const axes = ['Redundancy', 'Modularity', 'Buffer', 'Reach', 'Substitut.', 'Recovery'];
  const V = vals || [0.72, 0.58, 0.41, 0.81, 0.55, 0.63];
  const B = base || [0.6, 0.62, 0.66, 0.74, 0.6, 0.7];
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2 - 24;
  const rings = [0.25, 0.5, 0.75, 1].map((r, i) => {
    const pts = axes
      .map((_, k) => {
        const a = (k / axes.length) * Math.PI * 2 - Math.PI / 2;
        return `${cx + Math.cos(a) * R * r},${cy + Math.sin(a) * R * r}`;
      })
      .join(' ');
    return <polygon key={i} points={pts} fill="none" stroke="#f4f4f5" strokeWidth="1" />;
  });
  const spokes = axes.map((ax, i) => {
    const a = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
    return (
      <g key={i}>
        <line x1={cx} y1={cy} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke="#e4e4e7" />
        <text
          x={cx + Math.cos(a) * (R + 13)}
          y={cy + Math.sin(a) * (R + 13) + 3}
          fontSize="7.5"
          fill="#71717a"
          textAnchor="middle"
          fontFamily="Geist,system-ui"
        >
          {ax}
        </text>
      </g>
    );
  });
  const poly = (v, c, f) => {
    const pts = v
      .map((x, i) => {
        const a = (i / v.length) * Math.PI * 2 - Math.PI / 2;
        return `${cx + Math.cos(a) * R * x},${cy + Math.sin(a) * R * x}`;
      })
      .join(' ');
    return <polygon points={pts} fill={c} fillOpacity={f} stroke={c} strokeWidth="1.6" />;
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      {rings}
      {spokes}
      {poly(B, '#a1a1aa', 0.06)}
      {poly(V, '#1e4e6e', 0.14)}
    </svg>
  );
}

export function DivergingBars({ cats, w = 300, h = 110 }) {
  const data = cats || [
    ['Cereals', 8], ['Dairy', 22], ['Meat', -6],
    ['Vegetables', 31], ['Root crops', 26], ['Eggs', 14],
  ];
  const bh = (h - 8) / data.length;
  const mid = w * 0.42;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="xMidYMid meet">
      {data.map(([nm, v], i) => {
        const len = (Math.abs(v) / 35) * (w - mid - 12);
        const x = v < 0 ? mid - len : mid;
        return (
          <g key={nm}>
            <rect
              x={x.toFixed(1)}
              y={(4 + i * bh + 3).toFixed(1)}
              width={len.toFixed(1)}
              height={(bh - 6).toFixed(1)}
              rx="2"
              fill={v < 0 ? '#e7000b' : '#0d9488'}
              opacity=".8"
            />
            <text x={mid - 6} y={(4 + i * bh + bh / 2 + 2.5).toFixed(1)} fontSize="8.5" fill="#71717a" textAnchor="end" fontFamily="Geist,system-ui">
              {nm}
            </text>
          </g>
        );
      })}
      <line x1={mid} x2={mid} y1="2" y2={h - 2} stroke="#e4e4e7" />
    </svg>
  );
}

/** Small area sparkline for the node popover / anywhere compact. */
export function Sparkline({ data, w = 240, h = 40, color = '#f97316', threshold = true }) {
  if (!data || data.length < 2) return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} />;
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const p = data
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (data.length - 1)) * (w - 4) + 2).toFixed(1)} ${(h - 4 - ((v - mn) / (mx - mn || 1)) * (h - 8)).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <path d={`${p} L${w - 2} ${h} L2 ${h}Z`} fill={color} opacity=".1" />
      <path d={p} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      {threshold && <line x1="2" x2={w - 2} y1="8" y2="8" stroke="#e7000b" strokeWidth="1" strokeDasharray="3 3" />}
    </svg>
  );
}

/** Deterministic wandering series with an optional mid-run dip (for mock charts). */
export function synthSeries(n, start, drift, dip, seed = 42) {
  const rng = makeRng(seed);
  const out = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v += drift + (rng() - 0.5) * start * 0.05;
    if (dip && i >= 9 && i < 16) v -= start * 0.045;
    if (dip && i >= 16) v += start * 0.03;
    out.push(v);
  }
  return out;
}
