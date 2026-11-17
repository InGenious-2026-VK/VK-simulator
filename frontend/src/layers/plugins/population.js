/**
 * Population & demand — where the food needs to reach, and in what volume.
 * Real data source (planned): SCB demographic data.
 * @type {import('../defineLayer.js').LayerPlugin}
 */
export default {
  id: 'population',
  label: 'Population & demand',
  description: 'Population centres',
  color: '#a855f7',
  category: 'Dependencies & demand',
  order: 50,
  render: { circleRadius: 9 },
  data: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Linköping (illustrative)',
          description: 'Population centre — replace with SCB demographic data.',
        },
        geometry: { type: 'Point', coordinates: [15.62, 58.41] },
      },
      {
        type: 'Feature',
        properties: {
          name: 'Norrköping (illustrative)',
          description: 'Population centre — replace with SCB demographic data.',
        },
        geometry: { type: 'Point', coordinates: [16.18, 58.59] },
      },
    ],
  },
};
