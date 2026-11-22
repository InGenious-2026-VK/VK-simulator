import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

// Fixed order: a slice keeps its colour by position in the data, never by rank.
// Six colours, so a pie shows at most six slices; see toSlices().
const SLICE_COLORS = [
  'var(--viz-series-1)',
  'var(--viz-series-2)',
  'var(--viz-series-3)',
  'var(--viz-series-4)',
  'var(--viz-series-5)',
  'var(--viz-series-6)',
];
const MAX_SLICES = SLICE_COLORS.length;
const OTHER = 'Other';

const numberFormat = new Intl.NumberFormat('en-GB');
const percentFormat = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 });

const sum = (items) => items.reduce((total, item) => total + item.value, 0);

/**
 * Turn tidy rows (category, value) into slices, in file order.
 * With more than six rows, the five biggest stay and the rest are added up
 * into one grey "Other" slice: thin slivers in look-alike colours cannot be read.
 */
function toSlices(rows) {
  let slices = rows.map(({ category, value }) => ({ name: category, value }));
  if (slices.length > MAX_SLICES) {
    const biggest = new Set([...slices].sort((a, b) => b.value - a.value).slice(0, MAX_SLICES - 1));
    const rest = slices.filter((s) => !biggest.has(s));
    slices = slices.filter((s) => biggest.has(s));
    slices.push({ name: OTHER, value: sum(rest), fill: 'var(--viz-other)' });
  }
  return slices.map((s, i) => ({ fill: SLICE_COLORS[i], ...s }));
}

/**
 * Pie chart: shares of a whole.
 * rows: [{ category, value }]; unit is appended to tooltip values.
 */
export default function PieChartView({ rows, unit = '' }) {
  const slices = toSlices(rows);
  const total = sum(slices);
  if (total === 0) return <p className="viz-message">Nothing to draw: every value is 0.</p>;

  const share = (v) => percentFormat.format(v / total);
  const withUnit = (v) => `${numberFormat.format(v)}${unit ? ` ${unit}` : ''}`;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          // First slice starts at 12 o'clock, the rest follow clockwise.
          startAngle={90}
          endAngle={-270}
          // A gap in the background colour keeps neighbouring slices apart.
          stroke="var(--viz-surface)"
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Tooltip
          formatter={(v) => `${withUnit(v)} (${share(v)})`}
          contentStyle={{
            border: '1px solid var(--viz-axis)',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--viz-text)',
          }}
          itemStyle={{ color: 'var(--viz-text)' }}
        />
        {/* The legend carries the names and shares, so colour is never the only cue. */}
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="square"
          wrapperStyle={{ fontSize: 12, lineHeight: '22px' }}
          // Same order as the slices (the default sorts by name).
          itemSorter={null}
          formatter={(name, entry) => (
            <span style={{ color: 'var(--viz-text)' }}>
              {name} <span style={{ color: 'var(--viz-text-muted)' }}>{share(entry.payload.value)}</span>
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
