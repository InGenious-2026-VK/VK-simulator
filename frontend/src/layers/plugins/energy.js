/**
 * Energy & water dependencies — substations, fuel depots, water supply that
 * processing, cold storage and irrigation depend on. This is the layer that
 * turns "a substation is down" into "these food facilities are affected".
 *
 * Real infrastructure locations belong in the restricted/governed layer
 * (concept doc, Section 9) — the sample point here is illustrative only.
 * @type {import('../defineLayer.js').LayerPlugin}
 */
export default {
  id: 'energy',
  label: 'Energy & water dependencies',
  description: 'Substations, fuel, water supply',
  color: '#ef4444',
  category: 'Dependencies & demand',
  order: 40,
  data: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Sample Substation X',
          description:
            'Placeholder — real energy infrastructure locations should only be added under the restricted/governed layer (see concept doc, Section 9).',
        },
        geometry: { type: 'Point', coordinates: [15.5, 58.45] },
      },
    ],
  },
};
