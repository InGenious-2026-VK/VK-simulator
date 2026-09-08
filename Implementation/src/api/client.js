/**
 * Thin client for the Python simulation backend (see ../../backend).
 *
 * In dev, Vite proxies `/api` to http://localhost:8000 (vite.config.js). If the
 * backend isn't running these reject — callers should surface that as a
 * friendly "start the backend" message rather than crashing the map.
 */

const BASE = '/api';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return res.json();
}

/** Baseline supply-chain network: nodes + edges with coordinates. */
export function getNetwork() {
  return get('/network');
}

/** Named example scenarios. */
export function getPresets() {
  return get('/presets');
}

/**
 * Run a scenario.
 * @param {{ name?: string, duration_days?: number, disruptions: object[] }} scenario
 * @returns {Promise<object>} SimulationResult
 */
export async function runSimulation(scenario) {
  const res = await fetch(`${BASE}/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.detail ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(`Simulation failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}
