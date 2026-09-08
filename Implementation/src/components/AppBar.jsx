import { Badge, Button, Select } from './ui.jsx';
import { IconDownload, IconPlus, IconPlay } from './icons.jsx';

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
}) {
  const scenarioOptions = [
    { value: '', label: 'Custom scenario' },
    ...presets.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <header className="appbar">
      <div className="brand">
        <strong>InGenious</strong>
        <span className="mono">2026-VK</span>
      </div>
      <div className="divider-v" />

      <div className="select run-meta" style={{ maxWidth: 280 }}>
        <span className="lbl">Study area</span>
        <span>Östergötland · food system</span>
      </div>

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
      <div className="avatar">VK</div>

      <span className="run-meta" style={{ display: 'none' }}>{scenarioName}</span>
    </header>
  );
}
