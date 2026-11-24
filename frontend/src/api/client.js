/**
 * Client for the FoodChainIQ backend (see ../../backend and
 * ../../documentation/api/README.md).
 *
 * In dev, Vite proxies `/api` to http://127.0.0.1:8000 (vite.config.js). On a
 * static host set VITE_API_BASE at build time (e.g. https://my-api.example/api).
 *
 * Auth: the access token lives in memory only; the refresh token is an httpOnly
 * cookie the browser sends to /api/auth/refresh. A request that fails with 401
 * is retried once after a silent refresh.
 */

const BASE = import.meta.env.VITE_API_BASE || '/api';

let accessToken = null;
let refreshing = null;
const listeners = new Set();

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || {};
  }
}

export function setAccessToken(token) {
  accessToken = token;
}

/** Called with `null` when the session is lost (refresh failed). */
export function onSessionLost(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function parseError(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  const e = body?.error;
  if (e) return new ApiError(res.status, e.code, e.message, e.details);
  const detail = typeof body?.detail === 'string' ? body.detail : '';
  return new ApiError(res.status, 'http_error', detail || `HTTP ${res.status}`);
}

async function rawRequest(path, { method = 'GET', body, form, headers = {}, auth = true } = {}) {
  const h = { ...headers };
  if (auth && accessToken) h.Authorization = `Bearer ${accessToken}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    h['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  return fetch(`${BASE}${path}`, { method, headers: h, body: payload, credentials: 'include' });
}

export async function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      const res = await rawRequest('/auth/refresh', { method: 'POST', auth: false });
      if (!res.ok) {
        accessToken = null;
        throw await parseError(res);
      }
      const data = await res.json();
      accessToken = data.access_token;
      return data;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function request(path, opts = {}) {
  let res = await rawRequest(path, opts);
  if (res.status === 401 && opts.auth !== false && !opts._retried) {
    try {
      await refreshSession();
      res = await rawRequest(path, { ...opts, _retried: true });
    } catch {
      listeners.forEach((fn) => fn(null));
    }
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  return type.includes('json') ? res.json() : res.blob();
}

function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ---------------------------------------------------------------- Window 1: auth

export async function login(email, password) {
  const data = await request('/auth/login', { method: 'POST', body: { email, password }, auth: false });
  accessToken = data.access_token;
  return data;
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST', auth: false });
  } finally {
    accessToken = null;
  }
}

export const getMe = () => request('/auth/me');
export const getAuthConfig = () => request('/auth/config', { auth: false });
/** Self-registration: `{ email, display_name, password, organization?, note? }`. */
export const register = (body) => request('/auth/register', { method: 'POST', body, auth: false });
export const getPublicStats = () => request('/stats/public', { auth: false });
export const sendContactMessage = (body) => request('/contact', { method: 'POST', body, auth: false });

// ---------------------------------------------------------------- Window 2: data lake

export const listDatasets = (params) => request(`/datasets${qs(params)}`);
export const getDataset = (id) => request(`/datasets/${id}`);
export const patchDataset = (id, body) => request(`/datasets/${id}`, { method: 'PATCH', body });
export const getPreview = (id, params) => request(`/datasets/${id}/preview${qs(params)}`);
export const listGroups = () => request('/groups?page_size=100');
export const listGroupMembers = (groupId) => request(`/groups/${groupId}/members`);
/** `member`: `{ email }` or `{ user_id }`, plus optional `role` (member | admin). */
export const addGroupMember = (groupId, member) =>
  request(`/groups/${groupId}/members`, { method: 'POST', body: member });
export const setGroupMemberRole = (groupId, userId, role) =>
  request(`/groups/${groupId}/members/${userId}`, { method: 'PATCH', body: { role } });
export const removeGroupMember = (groupId, userId) =>
  request(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
export const updateGroup = (groupId, body) => request(`/groups/${groupId}`, { method: 'PATCH', body });
export const getMetadataTemplate = () => request('/metadata/template');
export const validateMetadata = (meta) => request('/metadata/validate', { method: 'POST', body: meta });
export const requestRemoval = (id, reason) =>
  request(`/datasets/${id}/removal-requests`, { method: 'POST', body: { reason } });
export const listRemovalRequests = (params) => request(`/removal-requests${qs(params)}`);
export const cancelRemovalRequest = (id) => request(`/removal-requests/${id}/cancel`, { method: 'POST' });

/** Upload a dataset: one metadata File + data Files. */
export function uploadDataset({ metadataFile, files, visibility, groupId }) {
  const form = new FormData();
  form.append('metadata', metadataFile, 'metadata.json');
  for (const f of files) form.append('files', f, f.name);
  form.append('visibility', visibility);
  if (groupId) form.append('group_id', groupId);
  return request('/datasets', { method: 'POST', form });
}

export async function downloadFile(datasetId, file) {
  const blob = await request(`/datasets/${datasetId}/files/${file.id}`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

export const createSelection = (datasetIds) =>
  request('/selections', { method: 'POST', body: { dataset_ids: datasetIds } });
export const getSelection = (id) => request(`/selections/${id}`);

// ---------------------------------------------------------------- admin

export const adminRemovalQueue = (status = 'pending') => request(`/admin/removal-requests${qs({ status })}`);
export const adminDecide = (id, decision, note) =>
  request(`/admin/removal-requests/${id}/decision`, { method: 'POST', body: { decision, note } });
export const adminListUsers = (params) => request(`/admin/users${qs({ page_size: 100, ...params })}`);
export const adminCreateUser = (body) => request('/admin/users', { method: 'POST', body });
export const adminUpdateUser = (id, body) => request(`/admin/users/${id}`, { method: 'PATCH', body });
export const adminDeleteUser = (id, transferTo) =>
  request(`/admin/users/${id}${qs({ transfer_to: transferTo })}`, { method: 'DELETE' });
export const adminCreateGroup = (body) => request('/admin/groups', { method: 'POST', body });
export const adminDeleteGroup = (id) => request(`/admin/groups/${id}`, { method: 'DELETE' });
export const adminContactMessages = (status = 'open') =>
  request(`/admin/contact-messages${qs({ status, page_size: 100 })}`);
export const adminMarkContactMessage = (id, handled) =>
  request(`/admin/contact-messages/${id}`, { method: 'PATCH', body: { handled } });
export const adminRegistrations = (status = 'pending') =>
  request(`/admin/registrations${qs({ status, page_size: 100 })}`);
export const adminDecideRegistration = (userId, decision, note) =>
  request(`/admin/registrations/${userId}/decision`, { method: 'POST', body: { decision, note } });

// ---------------------------------------------------------------- Window 3: visualization

export const getSelectionSummary = (selectionId) =>
  request(`/visualizations/summary${qs({ selection_id: selectionId })}`);

/** geometry_url values from the API start with /api — strip it for request(). */
export function getGeometryUrl(url) {
  return request(url.replace(/^\/api/, ''));
}

// ---------------------------------------------------------------- Window 4: simulation

/** Network: the synthetic baseline, or merged with a selection. */
export const getNetwork = (selectionId) => request(`/network${qs({ selection_id: selectionId })}`);
export const getPresets = () => request('/presets');
export const getSimulationContext = (selectionId) =>
  request(`/simulation/context${qs({ selection_id: selectionId })}`);
export const listRuns = () => request('/simulations?page_size=10');

/**
 * Run a scenario.
 * @param {{ name?: string, duration_days?: number, disruptions: object[], selection_id?: string }} scenario
 */
export async function runSimulation(scenario) {
  try {
    return await request('/simulate', { method: 'POST', body: scenario });
  } catch (e) {
    throw new Error(`Simulation failed (HTTP ${e.status ?? '?'}): ${e.message}`);
  }
}
