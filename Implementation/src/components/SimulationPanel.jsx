import { useState } from 'react';
import { Badge, Button, Switch, Progress } from './ui.jsx';
import { IconChevronsUp, IconChevronsDown, IconPlay, IconSpinner } from './icons.jsx';
import { SIM_MODELS, LIVE_MODEL } from '../data/workspaceMock.js';

function Range({ label, value, unit, min, max, signed, onChange, disabled }) {
  const step = max - min <= 5 ? 0.1 : 1;
  const display = signed && value > 0 ? `+${value}${unit}` : `${value}${unit}`;
  return (
    <div className="field">
      <label>{label}</label>
      <div className="slider-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="slider-val mono">{display}</span>
      </div>
    </div>
  );
}

function SelectField({ label, options, value, onChange, disabled }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select
        className="input"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

/** Ephemeral params for a non-wired model — purely illustrative. */
function MockParams({ model }) {
  const [state, setState] = useState({});
  return (
    <>
      {SIM_MODELS[model].map(([kind, label, a, unit, min, max]) => {
        if (kind === 'select') {
          return (
            <SelectField
              key={label}
              label={label}
              options={a}
              value={state[label] ?? a[0]}
              onChange={(v) => setState((s) => ({ ...s, [label]: v }))}
            />
          );
        }
        const signed = String(a).startsWith('+') || String(a).startsWith('-');
        return (
          <Range
            key={label}
            label={label}
            unit={unit}
            min={min}
            max={max}
            signed={signed}
            value={state[label] ?? parseFloat(a)}
            onChange={(v) => setState((s) => ({ ...s, [label]: v }))}
          />
        );
      })}
    </>
  );
}

/** The live model, wired to the Python engine via `shock` + `onShock`. */
function LiveParams({ shock, onShock, disruptionCount }) {
  return (
    <>
      <SelectField
        label="Shock type"
        options={['Road link failure', 'Rail closure', 'Facility outage', 'Combined']}
        value={shock.type}
        onChange={(v) => onShock({ type: v })}
      />
      <Range
        label="Severity"
        unit="%"
        min={0}
        max={100}
        value={shock.severity}
        onChange={(v) => onShock({ severity: v })}
      />
      <Range
        label="Duration"
        unit=" d"
        min={7}
        max={120}
        value={shock.durationDays}
        onChange={(v) => onShock({ durationDays: v })}
      />
      <SelectField
        label="Reroute policy"
        options={['Least cost', 'Shortest time', 'No rerouting']}
        value={shock.reroute}
        onChange={(v) => onShock({ reroute: v })}
      />
      <div className="field">
        <label>Map disruptions</label>
        <div className="hint">
          {disruptionCount > 0
            ? `${disruptionCount} corridor/facility ${disruptionCount === 1 ? 'cut' : 'cuts'} selected — click the map to add or remove.`
            : 'Click a corridor or facility on the map to knock it out.'}
        </div>
      </div>
    </>
  );
}

export default function SimulationPanel({
  activeModel,
  onModel,
  collapsed,
  onCollapse,
  status,
  shock,
  onShock,
  disruptionCount,
  montecarlo,
  onMontecarlo,
  onRun,
  onCancel,
  canRun,
  lastRunMeta,
}) {
  const running = status === 'loading';
  const models = Object.keys(SIM_MODELS);
  const isLive = activeModel === LIVE_MODEL;

  return (
    <div className={`simpanel${collapsed ? ' collapsed' : ''}`}>
      <div className="sim-strip">
        <button className="btn btn-ghost btn-icon" onClick={onCollapse} title="Collapse">
          {collapsed ? <IconChevronsDown size={14} /> : <IconChevronsUp size={14} />}
        </button>
        <h3>Simulation</h3>
        <Badge variant="outline">{models.length} models</Badge>
        <div className="spacer" />
        {running && (
          <span className="run-meta" style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
            Solving…
          </span>
        )}
        {status === 'ready' && lastRunMeta && (
          <span className="run-meta" style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
            {lastRunMeta}
          </span>
        )}
        {status === 'ready' && (
          <Button variant="outline" size="sm" onClick={onRun} disabled={!canRun}>
            Re-run
          </Button>
        )}
        {running ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onRun} disabled={!canRun}>
            <IconPlay size={13} />
            Run
          </Button>
        )}
      </div>

      <div className="sim-body">
        <div className="tabs">
          {models.map((m) => (
            <button
              key={m}
              className={`tab${m === activeModel ? ' on' : ''}`}
              onClick={() => onModel(m)}
            >
              {m}
            </button>
          ))}
        </div>

        {running && (
          <div style={{ marginTop: 12 }}>
            <Progress value={40} />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 7,
                fontSize: 11,
                color: 'var(--muted-foreground)',
              }}
            >
              <span>
                <IconSpinner size={11} /> Routing &amp; allocation
              </span>
              <span className="mono">solving day-by-day</span>
            </div>
          </div>
        )}

        {!isLive && (
          <p className="notice" style={{ marginTop: 12 }}>
            <strong>{activeModel}</strong> is a planned model — parameters shown are illustrative and
            not yet connected to the engine. The <strong>{LIVE_MODEL}</strong> tab runs against the
            live simulation.
          </p>
        )}

        <div className="paramgrid">
          {isLive ? (
            <LiveParams shock={shock} onShock={onShock} disruptionCount={disruptionCount} />
          ) : (
            <MockParams model={activeModel} />
          )}
          <div className="field">
            <label>Run options</label>
            <div className="switch-row" style={{ height: 32 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                Monte-Carlo (200) <span className="badge badge-outline">sample</span>
              </span>
              <Switch checked={montecarlo} onChange={onMontecarlo} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
