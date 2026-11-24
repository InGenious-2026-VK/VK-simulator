import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Progress } from './ui.jsx';
import {
  IconChevronsRight,
  IconChart,
  IconGrid,
  IconFlow,
  IconCompare,
  IconDownload,
} from './icons.jsx';
import {
  LineChart,
  StackedBars,
  Sankey,
  Radar,
  Histogram,
  DivergingBars,
  synthSeries,
} from './charts.jsx';
import { COMMODITY_LEGEND, COMPARE_INDICATORS } from '../data/workspaceMock.js';
import { listRuns } from '../api/client.js';
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../scenario/severity.js';
import { formatClock, townAt } from '../scenario/playback.js';

function Kpi({ k, v, unit, delta, dir }) {
  return (
    <div className="kpi">
      <div className="k">{k}</div>
      <div className="v">
        {v}
        {unit && <small>{unit}</small>}
      </div>
      {delta && <div className={`d ${dir || ''}`}>{delta}</div>}
    </div>
  );
}

function ChartBox({ title, meta, children, legend }) {
  return (
    <div className="chartbox">
      <div className="ct">
        <b>{title}</b>
        {meta && <span className="mono">{meta}</span>}
      </div>
      {children}
      {legend && (
        <div className="legend-inline">
          {legend.map(([label, color]) => (
            <div key={label}>
              <i style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Sample() {
  return <Badge variant="warn" style={{ marginLeft: 'auto' }}>sample</Badge>;
}

/* ---------------- results (a completed run) ---------------- */
function Results({ result, frame }) {
  const s = result.region_summary;
  const now = frame?.region;
  const demand = useMemo(
    () =>
      (result.nodes ?? [])
        .filter((n) => n.type === 'demand')
        .map((n) => {
          const t = townAt(frame, n);
          return {
            name: n.name,
            population: n.population,
            people: t.people_affected,
            buffer: t.buffer_days,
            severity: t.severity,
            suff: 1 - (n.unmet_fraction ?? 0),
          };
        })
        .sort((a, b) => b.people - a.people || a.buffer - b.buffer || a.suff - b.suff),
    [result, frame]
  );

  // Daily series with a day-0 point, so the chart x-axis is "days since the shock".
  const supply = [s.total_demand_tpd - (result.timeline[0]?.unmet_tpd ?? 0), ...result.timeline.map((t) => Math.max(0, s.total_demand_tpd - t.unmet_tpd))];
  const demandLine = supply.map(() => s.total_demand_tpd);
  const people = [0, ...result.timeline.map((t) => t.people_affected)];
  const buffer = [100, ...result.timeline.map((t) => t.buffer_reserve_pct)];
  const cursor = frame ? frame.t : null;
  const when = frame ? formatClock(frame.hour, frame.end).label : `day ${result.duration_days}`;

  return (
    <>
      <div className="rsection">
        <div className="rhead">
          <h4>Scenario impact</h4>
          <div className="spacer" />
          <span className="meta mono">{frame && !frame.atEnd ? `at ${when}` : 'end of run'}</span>
        </div>
        <div className="kpis">
          <Kpi
            k="Demand met"
            v={(now?.pct_demand_met ?? s.pct_demand_met).toFixed(1)}
            unit="%"
            delta={`▼ ${(100 - (now?.pct_demand_met ?? s.pct_demand_met)).toFixed(1)} pp from supply`}
            dir="down"
          />
          <Kpi
            k="Without food now"
            v={(now?.people_affected ?? 0).toLocaleString('sv-SE')}
            delta={frame?.worst ? `worst: ${frame.worst.name}` : `end: ${s.people_affected.toLocaleString('sv-SE')} at risk`}
            dir={now?.people_affected ? 'down' : 'up'}
          />
          <Kpi
            k="Buffers left"
            v={Math.round(now?.buffer_reserve_pct ?? 100)}
            unit="%"
            delta={s.first_buffer_failure_day ? `towns run out from d${s.first_buffer_failure_day}` : 'buffers hold'}
            dir={s.first_buffer_failure_day ? 'down' : 'up'}
          />
          <Kpi
            k="Shortfall"
            v={(now?.unmet_tpd ?? s.total_unmet_tpd).toFixed(1)}
            unit="t/day"
            delta={`of ${s.total_demand_tpd} t/day`}
            dir="down"
          />
        </div>
      </div>

      <div className="rsection">
        <ChartBox
          title="Supply vs demand"
          meta="t / day"
          legend={[
            ['Scenario supply', '#1e4e6e'],
            ['Demand', '#a1a1aa'],
          ]}
        >
          <LineChart
            shock={null}
            cursor={cursor}
            series={[
              { d: supply, c: '#1e4e6e', band: true },
              { d: demandLine, c: '#a1a1aa', w: 1.4, dash: '4 3' },
            ]}
          />
        </ChartBox>
      </div>

      <div className="rsection">
        <ChartBox
          title="People affected over time"
          meta={frame ? `${(now?.people_affected ?? 0).toLocaleString('sv-SE')} now · ${when}` : `${result.duration_days} days`}
          legend={[
            ['People without food', '#e7000b'],
            ['Regional buffer left', '#a1a1aa'],
          ]}
        >
          <LineChart
            shock={null}
            cursor={cursor}
            series={[
              { d: people, c: '#e7000b', band: true },
              { d: buffer, c: '#a1a1aa', w: 1.4, dash: '4 3' },
            ]}
          />
        </ChartBox>
      </div>

      <div className="rsection">
        <ChartBox title="Throughput by commodity" meta="monthly · sample" legend={COMMODITY_LEGEND}>
          <StackedBars />
        </ChartBox>
      </div>

      <div className="rsection">
        <ChartBox
          title="Regional food flow"
          meta="annual · sample"
          legend={[['Farms → Processing → DC → Retail · width = volume', 'transparent']]}
        >
          <Sankey />
        </ChartBox>
      </div>

      <div className="rsection">
        <div className="rhead">
          <h4>Uncertainty</h4>
          <div className="spacer" />
          <Badge variant="warn">sample · 200 draws</Badge>
        </div>
        <ChartBox
          title="Unmet demand distribution"
          meta="P5 4.1 · P50 8.4 · P95 15.2"
          legend={[['Draws breaching 12% threshold', '#e7000b']]}
        >
          <Histogram />
        </ChartBox>
      </div>

      <div className="rsection">
        <div className="rhead">
          <h4>Network resilience</h4>
          <div className="spacer" />
          <Badge variant="warn">sample</Badge>
        </div>
        <ChartBox
          title="Structural metrics"
          meta="scenario vs baseline"
          legend={[
            ['Scenario', '#1e4e6e'],
            ['Baseline', '#a1a1aa'],
          ]}
        >
          <Radar />
        </ChartBox>
      </div>

      <div className="rsection">
        <div className="rhead">
          <h4>Municipalities</h4>
          <div className="spacer" />
          <span className="meta mono">{frame && !frame.atEnd ? `at ${when}` : 'end of run'}</span>
        </div>
        <table className="rank">
          <thead>
            <tr>
              <th>Municipality</th>
              <th className="num">Without food</th>
              <th className="num">Buffer left</th>
            </tr>
          </thead>
          <tbody>
            {demand.slice(0, 8).map((d) => (
              <tr key={d.name}>
                <td>
                  <span
                    className="sev-dot"
                    title={SEVERITY_LABEL[d.severity]}
                    style={{ background: SEVERITY_COLOR[d.severity] }}
                  />
                  {d.name}
                </td>
                <td className="num mono" style={{ color: d.people > 0 ? '#b91c1c' : 'inherit' }}>
                  {d.people.toLocaleString('sv-SE')}
                </td>
                <td className="num" style={{ width: 90 }}>
                  <span className="mono">{d.buffer.toFixed(1)} d</span>
                  <div className="minibar">
                    <i
                      style={{
                        width: `${Math.min(100, (d.buffer / 7) * 100)}%`,
                        background: d.buffer < 1 ? '#e7000b' : d.buffer < 3 ? '#f59e0b' : '#1e4e6e',
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- compare A/B ---------------- */
function Compare({ onExit, result }) {
  const rankBase = (result?.nodes ?? [])
    .filter((n) => n.type === 'demand')
    .map((n) => ({ name: n.name, suff: 1 - (n.unmet_fraction ?? 0) }))
    .sort((a, b) => a.suff - b.suff)
    .slice(0, 6);

  return (
    <>
      <div className="rsection">
        <div className="rhead">
          <h4>Scenario comparison</h4>
          <div className="spacer" />
          <Button size="sm" onClick={onExit}>
            Exit
          </Button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="select" style={{ flex: 1, height: 30 }}>
            <span className="lbl" style={{ color: '#1e4e6e' }}>
              A
            </span>
            <span style={{ fontSize: 11.5 }}>Current run</span>
          </div>
          <div className="select" style={{ flex: 1, height: 30 }}>
            <span className="lbl" style={{ color: '#f97316' }}>
              B
            </span>
            <span style={{ fontSize: 11.5 }}>S-02 Local sourcing</span>
          </div>
        </div>
        <Badge variant="warn" style={{ marginTop: 8 }}>
          Comparison figures are illustrative
        </Badge>
      </div>

      <div className="rsection">
        <table className="rank">
          <thead>
            <tr>
              <th>Indicator</th>
              <th className="num" style={{ color: '#1e4e6e' }}>
                A
              </th>
              <th className="num" style={{ color: '#f97316' }}>
                B
              </th>
              <th className="num">Δ</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_INDICATORS.map(([k, a, b, d, good]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="num mono">{a}</td>
                <td className="num mono">{b}</td>
                <td className={`num mono ${good ? 'up' : 'down'}`}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rsection">
        <ChartBox
          title="Self-sufficiency trajectory"
          meta="% · sample"
          legend={[
            ['A · current', '#1e4e6e'],
            ['B · S-02', '#f97316'],
          ]}
        >
          <LineChart
            shock={null}
            series={[
              { d: synthSeries(24, 48, -0.35, true, 4), c: '#1e4e6e', band: true },
              { d: synthSeries(24, 50, 0.42, false, 8), c: '#f97316', w: 1.8 },
            ]}
          />
        </ChartBox>
      </div>

      <div className="rsection">
        <ChartBox title="Divergence by commodity" meta="B − A, % · sample">
          <DivergingBars />
        </ChartBox>
      </div>

      {rankBase.length > 0 && (
        <div className="rsection">
          <div className="rhead">
            <h4>Where they differ most</h4>
          </div>
          <table className="rank">
            <thead>
              <tr>
                <th>Municipality</th>
                <th className="num">A</th>
                <th className="num">B</th>
              </tr>
            </thead>
            <tbody>
              {rankBase.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="num mono">{r.suff.toFixed(2)}</td>
                  <td className="num mono up">{Math.min(0.98, r.suff + 0.14).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ---------------- running ---------------- */
function Running() {
  const stages = [
    ['Load baseline & network', 'done'],
    ['Apply shock set', 'done'],
    ['Routing & allocation', 'now'],
    ['Draw down reserves day-by-day', 'wait'],
    ['Aggregate indicators', 'wait'],
  ];
  return (
    <>
      <div className="rsection">
        <div className="rhead">
          <h4>Run in progress</h4>
          <div className="spacer" />
          <Badge variant="warn" dot>
            solving
          </Badge>
        </div>
        <div style={{ marginBottom: 12 }}>
          <Progress value={45} />
        </div>
        {stages.map(([label, st]) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4.5px 0',
              fontSize: 11.5,
              color: st === 'wait' ? 'var(--muted-foreground)' : 'inherit',
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
                background: st === 'done' ? '#1e4e6e' : st === 'now' ? '#f97316' : 'var(--secondary)',
                color: '#fff',
                fontSize: 8,
              }}
            >
              {st === 'done' ? '✓' : st === 'now' ? '·' : ''}
            </span>
            {label}
          </div>
        ))}
      </div>
      <div className="rsection">
        <div className="rhead">
          <h4>Charts</h4>
          <div className="spacer" />
          <span className="meta">available when the run finishes</span>
        </div>
        <div className="skel" style={{ height: 104, marginBottom: 10 }} />
        <div className="skel" style={{ height: 104, marginBottom: 10 }} />
        <div className="skel" style={{ height: 132 }} />
      </div>
    </>
  );
}

/* ---------------- idle ---------------- */
function Idle({ onRun, network, error }) {
  return (
    <>
      <div className="empty">
        <div className="ico">
          <IconChart size={18} />
        </div>
        <h4>No results yet</h4>
        <p>
          Configure a shock in the Simulation panel — or click corridors and facilities on the map —
          then run it to see indicators, flows and municipality rankings here.
        </p>
        <Button variant="primary" size="sm" onClick={onRun}>
          Run simulation
        </Button>
        {error && (
          <p className="notice notice-error" style={{ marginTop: 12, textAlign: 'left' }}>
            {error}
          </p>
        )}
      </div>
      <div className="rsection" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="rhead">
          <h4>Baseline 2026</h4>
          <div className="spacer" />
          <span className="meta mono">{network ? 'from engine' : 'backend offline'}</span>
        </div>
        <div className="kpis">
          <Kpi k="Nodes" v={network ? network.nodes.length : '—'} />
          <Kpi k="Corridors" v={network ? network.edges.length : '—'} />
          <Kpi
            k="Region demand"
            v={network ? Math.round(network.nodes.filter((n) => n.type === 'demand').reduce((a, n) => a + (n.demand_tpd || 0), 0)) : '—'}
            unit="t/d"
          />
          <Kpi k="Municipalities" v={network ? network.nodes.filter((n) => n.type === 'demand').length : '—'} />
        </div>
      </div>
      <RecentRuns />
    </>
  );
}

function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

/** The signed-in user's stored runs (GET /api/simulations). */
function RecentRuns() {
  const [runs, setRuns] = useState(null);
  useEffect(() => {
    listRuns()
      .then((d) => setRuns(d.items))
      .catch(() => setRuns([]));
  }, []);
  return (
    <div className="rsection">
      <div className="rhead">
        <h4>Recent runs</h4>
      </div>
      {runs && runs.length === 0 && (
        <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: 0 }}>No runs yet.</p>
      )}
      <table className="rank">
        <tbody>
          {(runs ?? []).slice(0, 5).map((r) => (
            <tr key={r.run_id}>
              <td>
                {r.scenario?.name || 'Custom scenario'}
                <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                  {ago(r.created_at)} · {r.inputs?.datasets?.length ? `${r.inputs.datasets.length} datasets` : 'baseline'}
                </div>
              </td>
              <td className="num mono" style={{ color: 'var(--muted-foreground)' }}>
                {r.summary?.pct_demand_met != null ? `${r.summary.pct_demand_met}%` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ResultsPanel({
  mode, // 'idle' | 'running' | 'results' | 'compare'
  result,
  frame,
  network,
  error,
  onRun,
  onCompare,
  onExitCompare,
  onCollapse,
  onExport,
}) {
  return (
    <aside className="panel panel-right">
      <div className="rail">
        <button className="rail-btn on" title="Results" onClick={onCollapse}>
          <IconChart size={16} />
        </button>
        <div className="divider-h" />
        <button className="rail-btn" title="KPIs">
          <IconGrid size={16} />
        </button>
        <button className="rail-btn" title="Flows">
          <IconFlow size={16} />
        </button>
        <button className="rail-btn" title="Compare" onClick={onCompare}>
          <IconCompare size={16} />
        </button>
        <button className="rail-btn" title="Export" onClick={onExport}>
          <IconDownload size={16} />
        </button>
      </div>

      <div className="expanded">
        <div className="phead">
          <h3>Results</h3>
          <div className="spacer" />
          {mode === 'results' && (
            <Button size="sm" onClick={onCompare}>
              Compare
            </Button>
          )}
          <button className="btn btn-ghost btn-icon" title="Collapse panel" onClick={onCollapse}>
            <IconChevronsRight size={14} />
          </button>
        </div>
        <div className="pbody">
          {mode === 'compare' && <Compare onExit={onExitCompare} result={result} />}
          {mode === 'running' && <Running />}
          {mode === 'results' && result && <Results result={result} frame={frame} />}
          {mode === 'idle' && <Idle onRun={onRun} network={network} error={error} />}
        </div>
      </div>
    </aside>
  );
}
