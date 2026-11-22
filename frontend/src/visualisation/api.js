/* Talks to the backend's data overview routes (backend/app/viz/api.py).
   Kept here, not in src/api/client.js, so the whole feature lives in this folder.
   Uses the shared client's request(), which signs requests in and turns error
   responses into ApiError. */
import { request } from '../api/client.js';

function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * The datasets of a Data Lake selection that can be charted:
 * { selection_id, datasets: [{ id, version, type, title, subtitle?, unit?, source? }],
 *   skipped: [{ id, title, reason, message? }] }.
 */
export const getSelectionDatasets = (selectionId) =>
  request(`/viz/selections/${encodeURIComponent(selectionId)}/datasets`);

/**
 * One page of a dataset's views, the cards of the data overview:
 * { dataset, total, offset, views: [{ index, title, subtitle, type, unit, rows }] }.
 */
export const getVizViews = (id, version, offset, limit) =>
  request(`/viz/datasets/${encodeURIComponent(id)}/views${qs({ version, offset, limit })}`);
