import { useCallback, useEffect, useMemo, useState } from 'react';
import { getNetwork, getPresets, runSimulation } from '../api/client.js';

const EMPTY_SCENARIO = {
  presetId: null,
  closedEdges: [],
  offlineNodes: [],
  production: 1, // remaining fraction of harvest
  fuel: 1, // remaining fraction of road haulage capacity
  durationDays: 14,
};

function toggle(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Turn UI scenario state into the backend's Scenario payload. */
function toPayload(scenario, nodeTypeById, name) {
  const disruptions = [];
  for (const edgeId of scenario.closedEdges) {
    disruptions.push({ kind: 'edge_closure', edge_id: edgeId });
  }
  for (const nodeId of scenario.offlineNodes) {
    if (nodeTypeById.get(nodeId) === 'energy') {
      disruptions.push({ kind: 'energy_outage', node_id: nodeId, backup_factor: 0 });
    } else {
      disruptions.push({ kind: 'node_outage', node_id: nodeId, capacity_factor: 0 });
    }
  }
  if (scenario.production < 1) {
    disruptions.push({ kind: 'production_shock', factor: Number(scenario.production.toFixed(2)) });
  }
  if (scenario.fuel < 1) {
    disruptions.push({ kind: 'fuel_shortage', factor: Number(scenario.fuel.toFixed(2)) });
  }
  return { name, duration_days: scenario.durationDays, disruptions };
}

/** Parse a preset's disruption list back into UI scenario state. */
function fromPreset(preset) {
  const s = { ...EMPTY_SCENARIO, presetId: preset.id, closedEdges: [], offlineNodes: [] };
  s.durationDays = preset.scenario.duration_days ?? 14;
  for (const d of preset.scenario.disruptions ?? []) {
    if (d.kind === 'edge_closure') s.closedEdges = [...s.closedEdges, d.edge_id];
    else if (d.kind === 'energy_outage' || d.kind === 'node_outage')
      s.offlineNodes = [...s.offlineNodes, d.node_id];
    else if (d.kind === 'production_shock') s.production = d.factor;
    else if (d.kind === 'fuel_shortage') s.fuel = d.factor;
  }
  return s;
}

export function useSimulation() {
  const [network, setNetwork] = useState(null);
  const [networkError, setNetworkError] = useState(null);
  const [presets, setPresets] = useState([]);
  const [scenario, setScenario] = useState(EMPTY_SCENARIO);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    getNetwork()
      .then((n) => alive && setNetwork(n))
      .catch((e) => alive && setNetworkError(e.message));
    getPresets()
      .then((p) => alive && setPresets(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const nodeTypeById = useMemo(() => {
    const m = new Map();
    for (const n of network?.nodes ?? []) m.set(n.id, n.type);
    return m;
  }, [network]);

  const patch = useCallback((fields) => {
    setScenario((s) => ({ ...s, presetId: null, ...fields }));
  }, []);

  const actions = useMemo(
    () => ({
      toggleEdgeClosure: (id) =>
        setScenario((s) => ({ ...s, presetId: null, closedEdges: toggle(s.closedEdges, id) })),
      toggleNodeOutage: (id) =>
        setScenario((s) => ({ ...s, presetId: null, offlineNodes: toggle(s.offlineNodes, id) })),
      setProduction: (v) => patch({ production: v }),
      setFuel: (v) => patch({ fuel: v }),
      setDuration: (v) => patch({ durationDays: v }),
      applyPreset: (id) => {
        const preset = presets.find((p) => p.id === id);
        if (preset) setScenario(fromPreset(preset));
      },
      clearScenario: () => {
        setScenario(EMPTY_SCENARIO);
        setResult(null);
        setStatus('idle');
        setError(null);
      },
      run: async () => {
        setStatus('loading');
        setError(null);
        const preset = presets.find((p) => p.id === scenario.presetId);
        try {
          const res = await runSimulation(
            toPayload(scenario, nodeTypeById, preset?.name ?? 'Custom scenario')
          );
          setResult(res);
          setStatus('ready');
        } catch (e) {
          setError(e.message);
          setStatus('error');
        }
      },
    }),
    [patch, presets, scenario, nodeTypeById]
  );

  const disruptionCount =
    scenario.closedEdges.length +
    scenario.offlineNodes.length +
    (scenario.production < 1 ? 1 : 0) +
    (scenario.fuel < 1 ? 1 : 0);

  return {
    network,
    networkError,
    presets,
    scenario,
    result,
    status,
    error,
    disruptionCount,
    ...actions,
  };
}
