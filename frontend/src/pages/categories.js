/** Display metadata for dataset categories / simulation roles. */
export const CATEGORY_META = {
  production: { label: 'Primary production', color: '#0d9488', blurb: 'Farms, crops, livestock, greenhouses' },
  processing: { label: 'Processing & storage', color: '#f97316', blurb: 'Dairies, mills, silos, cold storage' },
  logistics: { label: 'Logistics & transport', color: '#1e4e6e', blurb: 'Road, rail and port corridors' },
  energy: { label: 'Energy', color: '#eab308', blurb: 'Substations and fuel depots' },
  water: { label: 'Water', color: '#0ea5e9', blurb: 'Water supply infrastructure' },
  population: { label: 'Population & demand', color: '#8b5cf6', blurb: 'People and municipal demand' },
  demand: { label: 'Demand', color: '#a855f7', blurb: 'Food demand by area' },
  vulnerability: { label: 'Vulnerability & risk', color: '#e7000b', blurb: 'Chokepoints and single points of failure' },
  other: { label: 'Other', color: '#71717a', blurb: 'Anything else' },
  reference: { label: 'Reference', color: '#71717a', blurb: 'Display only' },
};

export const CATEGORIES = [
  'production', 'processing', 'logistics', 'energy', 'water', 'population', 'demand', 'vulnerability', 'other',
];

export const FORMATS = ['csv', 'xlsx', 'geojson', 'gpkg', 'shapefile', 'parquet', 'json'];

export const VISIBILITY_META = {
  private: { label: 'Private', icon: '🔒', hint: 'Only you (and platform admins).' },
  group: { label: 'Group', icon: '👥', hint: 'Members of one of your groups.' },
  public: { label: 'Public', icon: '🌐', hint: 'Every signed-in FoodChainIQ user.' },
};

export function catColor(cat) {
  return CATEGORY_META[cat]?.color ?? '#71717a';
}

export function formatBytes(n) {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}
