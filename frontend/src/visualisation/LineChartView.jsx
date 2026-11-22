import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Fixed order: a series keeps its colour by position in the data, never by rank.
const SERIES_COLORS = [
  'var(--viz-series-1)',
  'var(--viz-series-2)',
  'var(--viz-series-3)',
  'var(--viz-series-4)',
];

const numberFormat = new Intl.NumberFormat('en-GB');
const compactFormat = new Intl.NumberFormat('en-GB', { notation: 'compact' });

/** Turn tidy rows (date, series, value) into one object per date. */
function pivot(rows) {
  const series = [];
  const byDate = new Map();
  for (const { date, series: name, value } of rows) {
    if (!series.includes(name)) series.push(name);
    if (!byDate.has(date)) byDate.set(date, { date });
    byDate.get(date)[name] = value;
  }
  return { series, points: [...byDate.values()] };
}

/**
 * Time-series line chart.
 * rows: [{ date, series, value }]; unit is appended to tooltip values.
 */
export default function LineChartView({ rows, unit = '' }) {
  const { series, points } = pivot(rows);
  const withUnit = (v) => `${numberFormat.format(v)}${unit ? ` ${unit}` : ''}`;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--viz-text-muted)', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--viz-axis)' }}
        />
        <YAxis
          tick={{ fill: 'var(--viz-text-muted)', fontSize: 12 }}
          tickFormatter={(v) => compactFormat.format(v)}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          formatter={(v) => withUnit(v)}
          cursor={{ stroke: 'var(--viz-axis)' }}
          contentStyle={{
            border: '1px solid var(--viz-axis)',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--viz-text)',
          }}
          itemStyle={{ color: 'var(--viz-text)' }}
        />
        {series.length > 1 && (
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12 }}
            formatter={(name) => <span style={{ color: 'var(--viz-text)' }}>{name}</span>}
          />
        )}
        {series.map((name, i) => (
          <Line
            key={name}
            dataKey={name}
            type="linear"
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--viz-surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
