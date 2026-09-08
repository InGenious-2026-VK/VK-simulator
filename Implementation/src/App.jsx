import { useEffect, useMemo, useState } from 'react';
import AppBar from './components/AppBar.jsx';
import LayersPanel from './components/LayersPanel.jsx';
import SimulationPanel from './components/SimulationPanel.jsx';
import MapPanel from './components/MapPanel.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import TimelineBar from './components/TimelineBar.jsx';
import ScenarioDialog from './components/ScenarioDialog.jsx';
import { useSimulation } from './scenario/useSimulation.js';
import { LAYER_PLUGINS, initialVisibility } from './layers/registry.js';
import { LIVE_MODEL } from './data/workspaceMock.js';
import './App.css';

const DEFAULT_ORDER = [...LAYER_PLUGINS].reverse().map((p) => p.id);
const PLUGIN_BY_ID = new Map(LAYER_PLUGINS.map((p) => [p.id, p]));
const ORDER_KEY = 'ostergotland.layerOrder';

function loadOrder() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null');
  } catch {
    saved = null;
  }
  if (!Array.isArray(saved)) return DEFAULT_ORDER;
  const known = new Set(DEFAULT_ORDER);
  const result = saved.filter((id) => known.has(id));
  for (const id of DEFAULT_ORDER) {
    if (result.includes(id)) continue;
    const idx = DEFAULT_ORDER.indexOf(id);
    const prev = DEFAULT_ORDER.slice(0, idx)
      .reverse()
      .find((p) => result.includes(p));
    result.splice(prev ? result.indexOf(prev) + 1 : 0, 0, id);
  }
  return result;
}

export default function App() {
  const sim = useSimulation();

  const [activeLayers, setActiveLayers] = useState(() => initialVisibility(LAYER_PLUGINS));
  const [order, setOrder] = useState(loadOrder);

  const [basemap, setBasemap] = useState('light');
  const [activeModel, setActiveModel] = useState(LIVE_MODEL);
  const [montecarlo, setMontecarlo] = useState(true);
  const [shock, setShock] = useState({
    type: 'Rail closure',
    severity: 0,
    durationDays: 14,
    reroute: 'Least cost',
  });

  const [showNetwork, setShowNetwork] = useState(true);
  const [showImpact, setShowImpact] = useState(true);
  const [networkOpacity, setNetworkOpacity] = useState(90);
  const [impactOpacity, setImpactOpacity] = useState(70);

  const [collapsed, setCollapsed] = useState({ left: false, right: false, top: false, bottom: true });
  const [focus, setFocus] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Persist layer order.
  useEffect(() => {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {
      /* storage disabled */
    }
  }, [order]);

  // Wire the live "Disruption / shock" model to the engine's global knobs.
  useEffect(() => {
    sim.setProduction(1 - shock.severity / 100);
    sim.setDuration(shock.durationDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shock.severity, shock.durationDays]);

  const orderedPlugins = useMemo(
    () => order.map((id) => PLUGIN_BY_ID.get(id)).filter(Boolean),
    [order]
  );

  const toggleLayer = (id) => setActiveLayers((p) => ({ ...p, [id]: !p[id] }));
  const moveLayer = (from, to) =>
    setOrder((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [id] = next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });

  const patchShock = (fields) => setShock((s) => ({ ...s, ...fields }));

  const mode = sim.status === 'loading'
    ? 'running'
    : compareOpen && sim.result
      ? 'compare'
      : sim.result
        ? 'results'
        : 'idle';

  const runBadge =
    mode === 'running' ? 'run · solving' : sim.result ? 'run · committed' : 'no run';

  const canRun = sim.disruptionCount > 0;

  const doRun = () => {
    if (!canRun) return;
    setCompareOpen(false);
    sim.run();
  };

  const setPanel = (key, value) =>
    setCollapsed((c) => ({ ...c, [key]: value ?? !c[key] }));

  const toggleFocus = () => {
    setFocus((f) => {
      const next = !f;
      setCollapsed({ left: next, right: next, top: next, bottom: true });
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (dialogOpen) setDialogOpen(false);
      else if (compareOpen) setCompareOpen(false);
      else if (focus) toggleFocus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, compareOpen, focus]);

  const onExport = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      scenario: sim.scenario,
      result: sim.result ?? null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ingenious-scenario-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onCreateScenario = (cfg) => {
    setDialogOpen(false);
    setActiveModel(LIVE_MODEL);
    patchShock({ severity: cfg.severity, durationDays: cfg.durationDays });
    setMontecarlo(cfg.monteCarlo);
    if (cfg.run) {
      // production shock is region-wide — safe to run immediately
      setTimeout(() => sim.run(), 60);
    }
  };

  const scenarioValue = sim.scenario.presetId ?? '';
  const scenarioName =
    sim.presets.find((p) => p.id === sim.scenario.presetId)?.name ??
    (sim.disruptionCount ? 'Custom scenario' : 'Baseline 2026');

  const workClass = [
    'work',
    collapsed.left && 'left-collapsed',
    collapsed.right && 'right-collapsed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="app">
      <AppBar
        scenarioName={scenarioName}
        scenarioValue={scenarioValue}
        presets={sim.presets}
        onPickScenario={(id) => (id ? sim.applyPreset(id) : sim.clearScenario())}
        runBadge={runBadge}
        running={sim.status === 'loading'}
        canRun={canRun}
        onNewScenario={() => setDialogOpen(true)}
        onRun={doRun}
        onExport={onExport}
      />

      <div className={workClass}>
        <LayersPanel
          plugins={LAYER_PLUGINS}
          order={order}
          active={activeLayers}
          onToggle={toggleLayer}
          onMove={moveLayer}
          showNetwork={showNetwork}
          showImpact={showImpact}
          hasResult={!!sim.result}
          onToggleNetwork={() => setShowNetwork((v) => !v)}
          onToggleImpact={() => setShowImpact((v) => !v)}
          networkOpacity={networkOpacity}
          impactOpacity={impactOpacity}
          onNetworkOpacity={setNetworkOpacity}
          onImpactOpacity={setImpactOpacity}
          basemap={basemap}
          onBasemap={setBasemap}
          collapsed={collapsed.left}
          onCollapse={() => setPanel('left')}
        />

        <section className="center">
          <SimulationPanel
            activeModel={activeModel}
            onModel={setActiveModel}
            collapsed={collapsed.top}
            onCollapse={() => setPanel('top')}
            status={sim.status}
            shock={shock}
            onShock={patchShock}
            disruptionCount={sim.disruptionCount}
            montecarlo={montecarlo}
            onMontecarlo={setMontecarlo}
            onRun={doRun}
            onCancel={sim.clearScenario}
            canRun={canRun}
            lastRunMeta={
              sim.result
                ? `${sim.result.duration_days}-day run · ${sim.result.nodes.length} nodes`
                : null
            }
          />

          <MapPanel
            status={sim.status}
            hasResult={!!sim.result}
            summary={sim.result?.region_summary}
            onSplitView={() => setCompareOpen(true)}
            onFocus={toggleFocus}
            simState={{
              activeLayers,
              layerOrder: order,
              simNetwork: sim.network,
              simScenario: sim.scenario,
              simResult: sim.result,
              showNetwork,
              showImpact,
              networkOpacity,
              impactOpacity,
              basemap,
              onToggleEdge: sim.toggleEdgeClosure,
              onToggleNode: sim.toggleNodeOutage,
            }}
          />
        </section>

        <ResultsPanel
          mode={mode}
          result={sim.result}
          network={sim.network}
          error={sim.networkError || sim.error}
          onRun={doRun}
          onCompare={() => setCompareOpen(true)}
          onExitCompare={() => setCompareOpen(false)}
          onCollapse={() => setPanel('right')}
          onExport={onExport}
        />
      </div>

      <TimelineBar
        collapsed={collapsed.bottom}
        onCollapse={() => setPanel('bottom')}
        result={sim.result}
      />

      <ScenarioDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        presets={sim.presets}
        onCreate={onCreateScenario}
      />
    </div>
  );
}
