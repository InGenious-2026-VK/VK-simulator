/**
 * Primary production — farms, dairy, horticulture.
 * Real data source (planned): Jordbruksverket block data + Vreta Kluster network.
 * @type {import('../defineLayer.js').LayerPlugin}
 */
export default {
  id: 'production',
  label: 'Primary production',
  description: 'Farms, dairy, horticulture',
  color: '#0ea5e9',
  category: 'Supply chain',
  order: 10,
  defaultVisible: true,
  data: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Sample Farm A',
          description:
            'Placeholder arable farm — replace with Jordbruksverket block data.',
        },
        geometry: { type: 'Point', coordinates: [15.4, 58.3] },
      },
      {
        type: 'Feature',
        properties: {
          name: 'Sample Dairy Farm B',
          description: 'Placeholder livestock operation.',
        },
        geometry: { type: 'Point', coordinates: [15.95, 58.55] },
      },
      {
        type: 'Feature',
        properties: {
          name: 'Sample Greenhouse C',
          description: 'Placeholder horticulture site.',
        },
        geometry: { type: 'Point', coordinates: [16.1, 58.4] },
      },
    ],
  },
};
