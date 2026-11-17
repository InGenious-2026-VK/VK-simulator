// Builds GeoJSON for the two map overlays the simulator owns:
//   sim-network  — the backend's supply-chain graph (nodes + corridors)
//   sim-impact   — per-town severity + corridor utilisation after a run
import { SEVERITY_COLOR } from './severity.js';

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

export function resultToFeatures(result) {
  if (!result) return { demandFC: EMPTY_FC, edgesFC: EMPTY_FC };

  const demandFC = {
    type: 'FeatureCollection',
    features: result.nodes
      .filter((n) => n.type === 'demand')
      .map((n) => ({
        type: 'Feature',
        properties: {
          id: n.id,
          name: n.name,
          severity: n.severity,
          color: SEVERITY_COLOR[n.severity],
          people: n.people_affected,
          unmet: n.unmet_fraction,
          // radius grows with population, ring with severity
          radius: 8 + Math.sqrt(n.population) / 45,
        },
        geometry: { type: 'Point', coordinates: n.coords },
      })),
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
