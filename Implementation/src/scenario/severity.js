// Shared severity palette for the simulation impact overlay and results panel.
export const SEVERITY_COLOR = {
  none: '#cbd5e1',
  minor: '#fde047',
  moderate: '#fb923c',
  severe: '#ef4444',
  critical: '#b91c1c',
};

export const SEVERITY_ORDER = ['none', 'minor', 'moderate', 'severe', 'critical'];

export const SEVERITY_LABEL = {
  none: 'Supplied',
  minor: 'At risk',
  moderate: 'Moderate shortfall',
  severe: 'Severe shortfall',
  critical: 'Critical shortfall',
};

export function formatPeople(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
