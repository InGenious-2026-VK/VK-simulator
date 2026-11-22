import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader.jsx';
import { Badge, Button } from '../components/ui.jsx';
import { IconX } from '../components/icons.jsx';
import CoverageMap from '../components/CoverageMap.jsx';
import { BarChart, HistogramChart, TableChart, TimeSeriesChart } from '../components/dataCharts.jsx';
import * as api from '../api/client.js';
import { CATEGORY_META, VISIBILITY_META, catColor, formatDate } from './categories.js';

const INPUT_LABELS = {
  production: 'Primary production (farms)',
  processing: 'Processing & storage',
  logistics: 'Transport corridors',
  energy: 'Energy dependencies',
  population: 'Population & demand',
};

// Distinct colours per dataset on the coverage map (category colour first).
const EXTRA = ['#0d9488', '#f97316', '#1e4e6e', '#eab308', '#8b5cf6', '#e7000b', '#0ea5e9', '#65a30d'];
function datasetColors(datasets) {
  const used = new Set();
  return Object.fromEntries(
    datasets.map((d, i) => {
      let c = catColor(d.category);
      if (used.has(c)) c = EXTRA.find((x) => !used.has(x)) ?? EXTRA[i % EXTRA.length];
      used.add(c);
      return [d.id, c];
    })
  );
}

function Chart({ chart, color }) {
  return (
    <figure className="chart-fig">
      <figcaption>
        {chart.title}
        {chart.unit ? <span className="muted"> · {chart.unit}</span> : null}
      </figcaption>
      {chart.kind === 'timeseries' && <TimeSeriesChart data={chart.data} color={color} unit={chart.unit} />}
      {chart.kind === 'bar' && <BarChart data={chart.data} color={color} unit={chart.unit} />}
      {chart.kind === 'histogram' && <HistogramChart data={chart.data} color={color} unit={chart.unit} />}
      {chart.kind === 'table' && <TableChart columns={chart.columns} data={chart.data} />}
    </figure>
  );
}

function FieldProfile({ fields }) {
  const shown = fields.filter((f) => f.type !== 'geometry');
  if (!shown.length) return null;
  return (
    <div className="preview-scroll">
      <table className="mini-table profile">
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Unit</th>
            <th>Missing</th>
            <th>Range / top values</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((f) => (
            <tr key={`${f.file}:${f.name}`}>
              <td>
                <strong>{f.name}</strong>
                <span className="muted small"> {f.file}</span>
              </td>
              <td className="mono">{f.type}</td>
              <td>{f.unit ?? ''}</td>
              <td className="mono">{f.missing_pct ?? 0}%</td>
              <td className="small">
                {f.min != null
                  ? `${f.min} – ${f.max}${f.mean != null ? ` (mean ${f.mean})` : ''}`
                  : (f.top_values ?? [])
                      .slice(0, 4)
                      .map((t) => `${t.value} (${t.count})`)
                      .join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function VisualizationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const selectionId = params.get('selection');
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectionId) return;
    let alive = true;
    setSummary(null);
    setError(null);
    api
      .getSelectionSummary(selectionId)
      .then((s) => alive && setSummary(s))
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [selectionId]);

  if (!selectionId) {
    return (
      <div className="page">
        <SiteHeader />
        <div className="empty center-msg">
          <p>No datasets selected.</p>
          <Link className="btn btn-primary" to="/datalake">
            Go to the data lake
          </Link>
        </div>
      </div>
    );
  }

  const removeDataset = async (id) => {
    const rest = summary.datasets.filter((d) => d.id !== id).map((d) => d.id);
    if (!rest.length) {
      navigate('/datalake');
      return;
    }
    setBusy(true);
    try {
      const sel = await api.createSelection(rest);
      navigate(`/visualize?selection=${sel.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const colors = summary ? datasetColors(summary.datasets) : {};
  const mapLayers = summary
    ? summary.datasets
        .filter((d) => d.features_with_geometry > 0)
        .map((d) => ({ id: d.id, title: d.title, color: colors[d.id], url: `/api/datasets/${d.id}/geometry` }))
    : [];
  const ov = summary?.overview;

  return (
    <div className="page">
      <SiteHeader />
      <div className="viz-head">
        <div className="viz-head-row">
          <Link to={`/overview?selection=${selectionId}`} className="back-link">
            ← Back to overview
          </Link>
          <h1>Visualization</h1>
          <div className="spacer" />
          <Button
            variant="primary"
            disabled={!summary || !summary.datasets.length}
            onClick={() => navigate(`/simulate?selection=${selectionId}`)}
          >
            To simulation →
          </Button>
        </div>
        {summary && (
          <div className="sel-chips">
            {summary.datasets.map((d) => (
              <span key={d.id} className="sel-chip">
                <i className="dot" style={{ background: colors[d.id] }} />
                {d.title}
                <button type="button" aria-label={`Remove ${d.title}`} disabled={busy} onClick={() => removeDataset(d.id)}>
                  <IconX size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <main className="viz">
        {error && (
          <div className="callout danger">
            {error.status === 404 ? 'This selection no longer exists or has expired.' : error.message}{' '}
            <Link to="/datalake">Select datasets again</Link>
          </div>
        )}
        {!summary && !error && (
          <p className="muted">
            <span className="spinner" /> Summarising the selected datasets…
          </p>
        )}
        {summary?.unavailable?.length > 0 && (
          <div className="callout warn">
            Some datasets are no longer available to you and were left out:{' '}
            {summary.unavailable.map((u) => `${u.title ?? u.id} (${u.reason.replace('_', ' ')})`).join(', ')}.
          </div>
        )}

        {summary && (
          <>
            <section className="kpis">
              <div className="kpi">
                <span className="muted small">Datasets</span>
                <strong className="mono">{ov.dataset_count}</strong>
              </div>
              <div className="kpi">
                <span className="muted small">Records</span>
                <strong className="mono">{ov.total_records.toLocaleString('en-GB')}</strong>
              </div>
              <div className="kpi">
                <span className="muted small">Features with geometry</span>
                <strong className="mono">{ov.features_with_geometry.toLocaleString('en-GB')}</strong>
              </div>
              <div className="kpi">
                <span className="muted small">Time span</span>
                <strong className="mono small-kpi">
                  {ov.time_span.start ? `${ov.time_span.start} → ${ov.time_span.end}` : '—'}
                </strong>
              </div>
              <div className="kpi">
                <span className="muted small">Municipalities covered</span>
                <strong className="mono">{ov.municipalities_covered} / 13</strong>
              </div>
            </section>

            <section className="viz-grid">
              <div className="panel map-panel-viz">
                <div className="panel-title">
                  <h2>Coverage</h2>
                  <div className="legend-inline">
                    {mapLayers.map((l) => (
                      <span key={l.id}>
                        <i className="dot" style={{ background: l.color }} /> {l.title}
                      </span>
                    ))}
                  </div>
                </div>
                {mapLayers.length ? (
                  <CoverageMap key={selectionId} layers={mapLayers} bbox={ov.combined_bbox} />
                ) : (
                  <p className="muted">None of the selected datasets has geometry.</p>
                )}
              </div>
              <div className="side-panels">
                <div className="panel">
                  <h2>Simulation readiness</h2>
                  <p className="muted small">What the selection feeds into the simulator; the rest uses the synthetic baseline.</p>
                  <ul className="readiness">
                    {Object.entries(summary.simulation_readiness).map(([role, src]) => {
                      const ds = src.startsWith('dataset:') && summary.datasets.find((d) => d.id === src.slice(8));
                      return (
                        <li key={role} className={ds ? 'ok' : ''}>
                          <span className="tick-mark">{ds ? '✓' : '○'}</span>
                          <span>
                            <strong>{INPUT_LABELS[role] ?? role}</strong>
                            <span className="muted small">{ds ? ds.title : 'built-in baseline'}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="panel">
                  <h2>Cross-dataset checks</h2>
                  {summary.cross_checks.length ? (
                    <ul className="checks">
                      {summary.cross_checks.map((c, i) => (
                        <li key={i} className={`check-${c.level}`}>
                          <Badge variant={c.level === 'warning' ? 'warn' : c.level === 'error' ? 'danger' : 'info'}>{c.level}</Badge>
                          {c.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">No issues found.</p>
                  )}
                  {ov.municipalities?.length > 0 && (
                    <p className="muted small">Covers: {ov.municipalities.join(', ')}.</p>
                  )}
                </div>
              </div>
            </section>

            {summary.datasets.map((d) => (
              <section key={d.id} className="panel ds-viz">
                <div className="ds-viz-head">
                  <i className="dot lg" style={{ background: colors[d.id] }} />
                  <div>
                    <h2>{d.title}</h2>
                    <p className="muted small">
                      {CATEGORY_META[d.category]?.label ?? d.category} · {d.owner?.display_name} ·{' '}
                      {VISIBILITY_META[d.visibility]?.icon} {d.visibility} · {d.license} ·{' '}
                      {d.source?.organization} · updated {formatDate(d.updated_at)}
                    </p>
                  </div>
                  <div className="spacer" />
                  <Badge variant="outline">role: {d.simulation_role ?? 'none'}</Badge>
                  <Badge variant="outline" className="mono">
                    {d.record_count.toLocaleString('en-GB')} records
                  </Badge>
                </div>
                {d.notes?.length > 0 && <div className="callout info">{d.notes.join(' · ')}</div>}
                <div className="chart-grid">
                  {d.charts
                    .filter((c) => !['point_map', 'choropleth', 'line_map'].includes(c.kind))
                    .map((c, i) => (
                      <Chart key={i} chart={c} color={colors[d.id]} />
                    ))}
                </div>
                <details className="profile-details">
                  <summary>Field profile ({d.fields.filter((f) => f.type !== 'geometry').length} fields)</summary>
                  <FieldProfile fields={d.fields} />
                </details>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
