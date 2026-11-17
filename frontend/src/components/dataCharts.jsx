/* Data-driven inline-SVG charts for the Visualization window. They take the
   `charts[]` entries produced by the backend (kind: timeseries | bar |
   histogram | table) — unlike charts.jsx, nothing here is illustrative. */

const fmt = (v) => {
  if (typeof v !== 'number') return String(v ?? '');
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${Math.round(v / 1e3)}k`;
  if (a >= 100) return Math.round(v).toLocaleString('en-GB');
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

export function TimeSeriesChart({ data, color = '#1e4e6e', h = 140, unit }) {
  const w = 320;
  const pad = { l: 38, r: 8, t: 8, b: 22 };
  if (!data?.length) return null;
  const ys = data.map((d) => d[1]);
  const mn = Math.min(0, ...ys);
  const mx = Math.max(...ys) || 1;
  const x = (i) => pad.l + (i / Math.max(1, data.length - 1)) * (w - pad.l - pad.r);
  const y = (v) => h - pad.b - ((v - mn) / (mx - mn || 1)) * (h - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[1]).toFixed(1)}`).join(' ');
  const ticks = [mn, (mn + mx) / 2, mx];
  const labelEvery = Math.ceil(data.length / 6);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" className="dchart" role="img" aria-label="Time series">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={pad.l - 4} y={y(t) + 3} textAnchor="end" className="tick">
            {fmt(t)}
          </text>
        </g>
      ))}
      <path d={`${path} L${x(data.length - 1)} ${y(mn)} L${x(0)} ${y(mn)}Z`} fill={color} opacity=".08" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d[1])} r="2.4" fill={color}>
            <title>
              {d[0]}: {fmt(d[1])}
              {unit ? ` ${unit}` : ''}
            </title>
          </circle>
          {i % labelEvery === 0 && (
            <text x={x(i)} y={h - 6} textAnchor="middle" className="tick">
              {String(d[0]).slice(0, 7)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function BarChart({ data, color = '#f97316', unit }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d[1])) || 1;
  return (
    <div className="hbars" role="img" aria-label="Bar chart">
      {data.map(([k, v]) => (
        <div key={k} className="hbar" title={`${k}: ${fmt(v)}${unit ? ` ${unit}` : ''}`}>
          <span className="hbar-label">{k}</span>
          <span className="hbar-track">
            <i style={{ width: `${(100 * v) / max}%`, background: color }} />
          </span>
          <span className="hbar-value mono">{fmt(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function HistogramChart({ data, color = '#0d9488', h = 110, unit }) {
  if (!data?.counts?.length) return null;
  const w = 320;
  const max = Math.max(...data.counts) || 1;
  const bw = (w - 8) / data.counts.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 16}`} width="100%" className="dchart" role="img" aria-label="Histogram">
      {data.counts.map((c, i) => {
        const bh = (c / max) * (h - 8);
        return (
          <rect key={i} x={4 + i * bw + 1} y={h - bh} width={bw - 2} height={bh} rx="2" fill={color} opacity=".85">
            <title>
              {fmt(data.bins[i])}–{fmt(data.bins[i + 1])}
              {unit ? ` ${unit}` : ''}: {c}
            </title>
          </rect>
        );
      })}
      <text x="4" y={h + 13} className="tick">
        {fmt(data.bins[0])}
      </text>
      <text x={w - 4} y={h + 13} textAnchor="end" className="tick">
        {fmt(data.bins[data.bins.length - 1])}
        {unit ? ` ${unit}` : ''}
      </text>
    </svg>
  );
}

export function TableChart({ columns, data }) {
  return (
    <div className="preview-scroll">
      <table className="mini-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>{v == null ? '' : String(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
