// Builds GeoJSON for the two map overlays the simulator owns:
//   sim-network  — the backend's supply-chain graph (nodes + corridors)
//   sim-impact   — per-town severity + corridor utilisation after a run
import { SEVERITY_COLOR } from './severity.js';
import { townAt } from './playback.js';

export const EMPTY_FC = { type: 'FeatureCollection', features: [] };

export const NODE_COLOR = {
  farm: '#0ea5e9',
  import: '#0d9488',
  processing: '#f59e0b',
  storage: '#8b5cf6',
  demand: '#a855f7',
  energy: '#ef4444',
};

const NODE_RADIUS = {
  farm: 4,
  import: 6,
  processing: 5,
  storage: 6,
  demand: 7,
  energy: 5,
};

export function networkToFeatures(network, scenario) {
  if (!network) return { nodesFC: EMPTY_FC, edgesFC: EMPTY_FC };
  const closed = new Set(scenario?.closedEdges ?? []);
  const offline = new Set(scenario?.offlineNodes ?? []);

  const edgesFC = {
    type: 'FeatureCollection',
    features: network.edges.map((e) => ({
      type: 'Feature',
      properties: { id: e.id, mode: e.mode, closed: closed.has(e.id) },
      geometry: { type: 'LineString', coordinates: e.coords },
    })),
  };

  const nodesFC = {
    type: 'FeatureCollection',
    features: network.nodes.map((n) => ({
      type: 'Feature',
      properties: {
        id: n.id,
        type: n.type,
        name: n.name,
        color: NODE_COLOR[n.type] ?? '#64748b',
        radius: NODE_RADIUS[n.type] ?? 5,
        offline: offline.has(n.id),
      },
      geometry: { type: 'Point', coordinates: n.coords },
    })),
  };

  return { nodesFC, edgesFC };
}

/**
 * Impact overlay. With a playback `frame`, towns show their state at that
 * moment (severity, people going without); without one, the end of the run.
 */
export function resultToFeatures(result, frame = null) {
  if (!result) return { demandFC: EMPTY_FC, edgesFC: EMPTY_FC };

  const demandFC = {
    type: 'FeatureCollection',
    features: result.nodes
      .filter((n) => n.type === 'demand')
      .map((n) => {
        const now = frame ? townAt(frame, n) : n;
        const share = n.population ? Math.min(1, now.people_affected / n.population) : 0;
        return {
          type: 'Feature',
          properties: {
            id: n.id,
            name: n.name,
            severity: now.severity,
            color: SEVERITY_COLOR[now.severity],
            people: now.people_affected,
            unmet: n.unmet_fraction,
            // radius grows with population; the fill darkens as people go without
            radius: 8 + Math.sqrt(n.population) / 45,
            fill: 0.12 + 0.55 * Math.sqrt(share),
            stroke: 1.5 + 3 * Math.sqrt(share),
          },
          geometry: { type: 'Point', coordinates: n.coords },
        };
      }),
  };

  const edgesFC = {
    type: 'FeatureCollection',
    features: result.edges.map((e) => ({
      type: 'Feature',
      properties: {
        id: e.id,
        closed: e.closed,
        saturated: e.saturated,
        utilization: e.utilization,
      },
      geometry: { type: 'LineString', coordinates: e.coords },
    })),
  };

  return { demandFC, edgesFC };
}

// ---------------------------------------------------------------- moving goods

const HOURS_PER_HOP = 6; // a shipment crosses one corridor in ~6 simulated hours

/** Corridors carrying food in the run, with how many "shipments" to draw on each. */
export function flowPaths(result) {
  if (!result) return [];
  const edges = result.edges.filter((e) => !e.closed && e.flow_tpd > 0.05 && e.coords?.length === 2);
  const max = Math.max(1, ...edges.map((e) => e.flow_tpd));
  return edges.map((e) => ({
    from: e.coords[0],
    to: e.coords[1],
    dots: Math.max(1, Math.min(4, Math.round((e.flow_tpd / max) * 4))),
    mode: e.mode,
    saturated: e.saturated,
  }));
}

/** Shipment positions at continuous simulated hour `hour`. */
export function flowDotsAt(paths, hour) {
  const features = [];
  for (const p of paths) {
    for (let i = 0; i < p.dots; i++) {
      const f = (((hour / HOURS_PER_HOP + i / p.dots) % 1) + 1) % 1;
      features.push({
        type: 'Feature',
        properties: {
          color: p.saturated ? '#b91c1c' : p.mode === 'rail' ? '#1e4e6e' : '#0f766e',
        },
        geometry: {
          type: 'Point',
          coordinates: [p.from[0] + (p.to[0] - p.from[0]) * f, p.from[1] + (p.to[1] - p.from[1]) * f],
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}
