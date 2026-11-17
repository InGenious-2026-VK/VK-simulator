import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Select } from './ui.jsx';
import { IconDownload, IconPlus, IconPlay } from './icons.jsx';
import { Brand, UserMenu } from './SiteHeader.jsx';

const ROLE_LABELS = {
  production: 'Production',
  processing: 'Processing & storage',
  logistics: 'Logistics',
  energy: 'Energy',
  population: 'Population & demand',
};

/** "Datasets" chip: which simulation inputs come from the selection. */
function DatasetsChip({ selectionId, context }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  if (!selectionId) {
    return (
      <Link to="/datalake" className="select run-meta" title="Using the synthetic baseline only">
        <span className="lbl">Datasets</span>
        <span>Baseline only · choose…</span>
      </Link>
    );
  }
  const inputs = Object.entries(context?.inputs ?? {});
  const fromData = inputs.filter(([, v]) => v.source === 'dataset').length;
  return (
    <div className="chip-wrap" ref={ref}>
      <button type="button" className="select run-meta" onClick={() => setOpen((o) => !o)}>
        <span className="lbl">Datasets</span>
        <span>
          {context?.map_layers?.length ?? 0} layers · {fromData}/{inputs.length} inputs
        </span>
      </button>
      {open && (
        <div className="menu datasets-menu">
          <strong>Simulation inputs</strong>
          <ul>
            {inputs.map(([role, v]) => (
              <li key={role}>
                <span className={v.source === 'dataset' ? 'ok' : 'muted'}>{v.source === 'dataset' ? '✓' : '○'}</span>
                <span>
                  {ROLE_LABELS[role] ?? role}
                  <span className="muted small">
                    {v.source === 'dataset'
                      ? `${v.title} · ${v.nodes_replaced + v.edges_replaced} replaced, ${v.nodes_added + v.edges_added} added`
                      : 'synthetic baseline'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {context?.warnings?.length > 0 && (
            <div className="callout warn small">{context.warnings.join(' ')}</div>
          )}
          <div className="row-gap">
            <Link className="btn btn-outline btn-sm" to={`/visualize?selection=${selectionId}`}>
              Visualization
            </Link>
            <Link className="btn btn-outline btn-sm" to={`/datalake?selection=${selectionId}`}>
              Change datasets
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Top application bar: identity, study area, active scenario, run controls. */
export default function AppBar({
  scenarioName,
  scenarioValue,
  presets,
  onPickScenario,
  runBadge,
  running,
  onNewScenario,
  onRun,
  onExport,
  canRun,
  selectionId,
  context,
}) {
  const scenarioOptions = [
    { value: '', label: 'Custom scenario' },
    ...presets.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <header className="appbar">
      <Brand />
      <Link to="/datalake" className="appbar-link hide-sm">
        Data Lake
      </Link>
      <div className="divider-v" />

      <div className="select run-meta" style={{ maxWidth: 280 }}>
        <span className="lbl">Study area</span>
        <span>Östergötland · food system</span>
      </div>

      <DatasetsChip selectionId={selectionId} context={context} />

      <Select
        label="Scenario"
        value={scenarioValue}
        options={scenarioOptions}
        onChange={onPickScenario}
      />

      <Badge variant="outline" className="mono run-meta">
        {runBadge}
      </Badge>

      <div className="spacer" />

      <Button size="sm" className="hide-sm" onClick={onExport}>
        <IconDownload size={14} />
        Export
      </Button>
      <Button variant="outline" size="sm" onClick={onNewScenario}>
        <IconPlus size={14} />
        New scenario
      </Button>
      <Button variant="primary" size="sm" onClick={onRun} disabled={!canRun || running}>
        <IconPlay size={13} />
        {running ? 'Running…' : 'Run simulation'}
      </Button>

      <div className="divider-v" />
      <UserMenu />

      <span className="run-meta" style={{ display: 'none' }}>{scenarioName}</span>
    </header>
  );
}
