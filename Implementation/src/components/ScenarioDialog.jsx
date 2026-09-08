import { useEffect, useState } from 'react';
import { Button, Switch } from './ui.jsx';

const SHOCKS = [
  ['transport', 'Transport link failure', 'Remove road or rail segments; reroute at cost. Pick corridors on the map after creating.'],
  ['production', 'Production loss', 'Yield reduction across farm clusters — wired to the engine as a region-wide production shock.'],
  ['facility', 'Facility outage', 'Take processing or DC nodes offline. Pick facilities on the map after creating.'],
  ['demand', 'Demand surge', 'Step change in municipal consumption (planned model — not yet wired).'],
];

export default function ScenarioDialog({ open, onClose, presets, onCreate }) {
  const [name, setName] = useState('S-05 Vättern drought + E4 closure');
  const [baseline, setBaseline] = useState('2026 calibrated (SCB + Jordbruksverket)');
  const [shock, setShock] = useState('production');
  const [extent, setExtent] = useState('Selected features on map');
  const [onset, setOnset] = useState('2026-W14');
  const [durationWk, setDurationWk] = useState(18);
  const [severity, setSeverity] = useState(65);
  const [adaptive, setAdaptive] = useState(true);
  const [monteCarlo, setMonteCarlo] = useState(true);

  useEffect(() => {
    if (open) return;
    // reset transient bits when closed
  }, [open]);

  if (!open) return null;

  const submit = () => {
    onCreate({
      name,
      shock,
      durationDays: Math.min(120, Math.max(7, durationWk * 7)),
      severity,
      monteCarlo,
      adaptive,
      run: shock === 'production',
    });
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <div className="dlg-head">
          <h2>New scenario</h2>
          <p>
            Define a shock, its extent and how it propagates. Runs against the 2026 calibrated
            baseline.
          </p>
        </div>

        <div className="dlg-body">
          <div className="steps">
            <div className="step done">
              <i>✓</i>Basis
            </div>
            <div className="step on">
              <i>2</i>Shock
            </div>
            <div className="step">
              <i>3</i>Models
            </div>
            <div className="step">
              <i>4</i>Review
            </div>
          </div>

          <div className="paramgrid" style={{ margin: '0 0 16px' }}>
            <div className="field">
              <label>Scenario name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Baseline</label>
              <select className="input" value={baseline} onChange={(e) => setBaseline(e.target.value)}>
                <option>2026 calibrated (SCB + Jordbruksverket)</option>
                <option>2024 observed</option>
              </select>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <label>Shock type</label>
          </div>
          <div className="shockcards">
            {SHOCKS.map(([id, title, desc]) => (
              <button
                key={id}
                className={`shockcard${shock === id ? ' on' : ''}`}
                onClick={() => setShock(id)}
              >
                <b>{title}</b>
                <p>{desc}</p>
              </button>
            ))}
          </div>

          <div className="paramgrid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>Extent</label>
              <select className="input" value={extent} onChange={(e) => setExtent(e.target.value)}>
                <option>Selected features on map</option>
                <option>Whole region</option>
                <option>By municipality</option>
              </select>
            </div>
            <div className="field">
              <label>Onset week</label>
              <input className="input mono" value={onset} onChange={(e) => setOnset(e.target.value)} />
            </div>
            <div className="field">
              <label>Duration</label>
              <div className="slider-row">
                <input
                  type="range"
                  min="1"
                  max="52"
                  value={durationWk}
                  onChange={(e) => setDurationWk(Number(e.target.value))}
                />
                <span className="slider-val mono">{durationWk} wk</span>
              </div>
            </div>
            <div className="field">
              <label>Severity</label>
              <div className="slider-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value))}
                />
                <span className="slider-val mono">{severity}%</span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '11px 12px',
            }}
          >
            <div className="switch-row" style={{ marginBottom: 9 }}>
              <div>
                <b style={{ fontSize: 12 }}>Adaptive actor behaviour</b>
                <div className="hint">Let retailers and hauliers re-source during the shock.</div>
              </div>
              <Switch checked={adaptive} onChange={setAdaptive} />
            </div>
            <div className="switch-row">
              <div>
                <b style={{ fontSize: 12 }}>Monte-Carlo uncertainty</b>
                <div className="hint">200 draws over yield and demand variance (sample).</div>
              </div>
              <Switch checked={monteCarlo} onChange={setMonteCarlo} />
            </div>
          </div>
        </div>

        <div className="dlg-foot">
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {presets.length} presets available ·{' '}
            <b className="mono">
              {shock === 'production' ? 'runs now' : 'pick features on map, then Run'}
            </b>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" disabled>
              Back
            </Button>
            <Button variant="primary" size="sm" onClick={submit}>
              {shock === 'production' ? 'Create & run' : 'Create scenario'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
