/**
 * Processing & storage — dairies, mills, grain stores, cold storage.
 * Real data source (planned): partner-contributed via Vreta Kluster, under
 * governed access for capacity attributes.
 * @type {import('../defineLayer.js').LayerPlugin}
 */
export default {
  id: 'processing',
  label: 'Processing & storage',
  description: 'Dairies, mills, grain & cold storage',
  color: '#f59e0b',
  category: 'Supply chain',
  order: 20,
  data: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Sample Dairy Processing Plant',
          description:
            'Placeholder — capacity data to be added under governed access.',
        },
        geometry: { type: 'Point', coordinates: [15.62, 58.41] },
      },
      {
        type: 'Feature',
        properties: {
          name: 'Sample Grain Storage Facility',
          description: 'Placeholder silo/warehouse location.',
        },
        geometry: { type: 'Point', coordinates: [15.77, 58.71] },
      },
    ],
  },
};
