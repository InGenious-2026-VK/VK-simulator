/**
 * Logistics & transport — road and rail corridors that move food through the region.
 * Real data source (planned): Trafikverket transport network.
 * @type {import('../defineLayer.js').LayerPlugin}
 */
export default {
  id: 'logistics',
  label: 'Logistics & transport',
  description: 'Road & rail corridors',
  color: '#6366f1',
  category: 'Supply chain',
  order: 30,
  defaultVisible: true,
  render: { lineWidth: 3 },
  data: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Sample Road Corridor',
          description:
            'Illustrative transport corridor — replace with Trafikverket network data.',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [15.62, 58.41],
            [16.18, 58.59],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {
          name: 'Sample Rail Link',
          description: 'Illustrative rail corridor.',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [15.04, 58.54],
            [15.62, 58.41],
          ],
        },
      },
    ],
  },
};
