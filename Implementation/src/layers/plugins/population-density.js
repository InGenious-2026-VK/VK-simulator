/**
 * Population density — a modelled "heat" surface of where people live in
 * Östergötland, styled after woatlas.com/density: a warm yellow→dark-red ramp
 * over a minimal basemap, densest cores in deep red.
 *
 * Data: WorldPop 2020, 1 km resolution population density, binned to ~1.5 km
 * and clipped to the county boundary. Served from `public/data/` and fetched on
 * demand (it is ~110 kB, too big to inline). Each grid cell is
 * `[lng, lat, peoplePerKm2]`.
 *
 * @type {import('../defineLayer.js').LayerPlugin}
 */

const DATA_URL = `${import.meta.env.BASE_URL}data/population-density.json`;

const WARM_RAMP = [
  '#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026',
];

// WorldPop density is very skewed (most cells single digits, city cores in the
// thousands), so weight is stretched with hand-set stops rather than linear.
const WEIGHT_EXPR = [
  'interpolate', ['linear'], ['get', 'd'],
  0, 0,
  5, 0.12,
  20, 0.28,
  75, 0.45,
  250, 0.65,
  1000, 0.85,
  4000, 1,
];

export default {
  id: 'population-density',
  label: 'Population density',
  description: 'WorldPop 2020 · people per km²',
  color: '#e31a1c',
  category: 'Dependencies & demand',
  order: 8, // a context wash — sits low in the stack by default

  loadData: async () => {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`population-density data: HTTP ${res.status}`);
    const grid = await res.json();
    return {
      type: 'FeatureCollection',
      features: grid.cells.map(([lng, lat, d]) => ({
        type: 'Feature',
        properties: { d },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      })),
    };
  },

  mapLayers: () => [
    {
      id: 'heat',
      type: 'heatmap',
      paint: {
        'heatmap-weight': WEIGHT_EXPR,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 7, 0.9, 11, 2.6],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 7, 9, 9, 16, 12, 34],
        'heatmap-opacity': 0.9,
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(255,255,204,0)',
          0.08, WARM_RAMP[1],
          0.22, WARM_RAMP[2],
          0.38, WARM_RAMP[3],
          0.54, WARM_RAMP[4],
          0.7, WARM_RAMP[5],
          0.85, WARM_RAMP[6],
          1, WARM_RAMP[7],
        ],
      },
    },
  ],

  legend: {
    title: 'People per km²',
    gradient: WARM_RAMP,
    min: '1',
    max: '5k+',
  },
};
