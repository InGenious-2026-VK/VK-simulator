/* Talks to the backend's visualisation routes (backend/app/viz/api.py).
   Kept here, not in src/api/client.js, so the whole feature lives in this folder. */

// Same rule as src/api/client.js: `/api` in dev (Vite proxies it to the backend),
// or a deployed backend URL set at build time.
const BASE = import.meta.env.VITE_API_BASE || '/api';

/** One dataset: its title, type, unit, source... plus `rows`, the data to draw. */
export async function getVizDataset(id) {
  const res = await fetch(`${BASE}/viz/datasets/${encodeURIComponent(id)}`);
  if (res.ok) return res.json();
  // Vite's proxy answers 502/504 when the backend is not running; FastAPI's own
  // errors carry a JSON `detail`.
  const detail = await res.json().then((b) => b?.detail, () => null);
  if (detail) throw new Error(detail);
  throw new Error(`Could not reach the backend (HTTP ${res.status}). Is it running on port 8000?`);
}
