import maplibregl from 'maplibre-gl';

export const EMPTY_FC = { type: 'FeatureCollection', features: [] };

const RENDER_DEFAULTS = {
  circleRadius: 6,
  lineWidth: 2,
  fillOpacity: 0.22,
};

// Default renderer: one fill (polygons), one line (lines + polygon outlines),
// one circle (points), all in the plugin's colour. A plugin can replace this
// wholesale via `mapLayers`.
function defaultMapLayers(plugin) {
  const r = { ...RENDER_DEFAULTS, ...(plugin.render || {}) };
  return [
    {
      id: 'fill',
      type: 'fill',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': r.fillColor || plugin.color,
        'fill-opacity': r.fillOpacity,
      },
    },
    {
      id: 'line',
      type: 'line',
      filter: ['match', ['geometry-type'], ['LineString', 'Polygon'], true, false],
      paint: { 'line-color': r.lineColor || plugin.color, 'line-width': r.lineWidth },
    },
    {
      id: 'point',
      type: 'circle',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': r.circleRadius,
        'circle-color': r.pointColor || plugin.color,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
      },
    },
  ];
}

function defaultPopup(feature, plugin) {
  const props = feature.properties || {};
  const title = props.name || plugin.label;
  const desc = props.description || '';
  return `<strong>${title}</strong>${desc ? `<br/>${desc}` : ''}`;
}

/**
 * Mounts a layer plugin onto a MapLibre map: adds its source and layers, wires
 * click popups and hover cursor. Returns a handle to toggle visibility, push
 * new data, or remove it again.
 *
 * @param {maplibregl.Map} map
 * @param {import('./defineLayer.js').LayerPlugin} plugin
 * @param {GeoJSON.FeatureCollection} data
 * @param {{ beforeId?: string, visible?: boolean }} [opts]
 */
export function mountLayer(map, plugin, data, opts = {}) {
  const sourceId = `layer:${plugin.id}`;
  const visibility = opts.visible ?? plugin.defaultVisible ? 'visible' : 'none';

  map.addSource(sourceId, { type: 'geojson', data: data || EMPTY_FC });

  const specs = plugin.mapLayers
    ? plugin.mapLayers({ plugin, color: plugin.color })
    : defaultMapLayers(plugin);
  const renderPopup = plugin.renderPopup || defaultPopup;

  const layerIds = [];
  for (const spec of specs) {
    const layerId = `${plugin.id}:${spec.id}`;
    map.addLayer(
      {
        ...spec,
        id: layerId,
        source: sourceId,
        layout: { ...(spec.layout || {}), visibility },
      },
      opts.beforeId
    );
    layerIds.push(layerId);

    map.on('click', layerId, (e) => {
      const feature = e.features && e.features[0];
      if (!feature) return;
      const html = renderPopup(feature, plugin);
      if (!html) return;
      new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    });
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  }

  return {
    id: plugin.id,
    layerIds,
    setVisible(next) {
      for (const layerId of layerIds) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', next ? 'visible' : 'none');
        }
      }
    },
    setData(next) {
      const source = map.getSource(sourceId);
      if (source) source.setData(next || EMPTY_FC);
    },
    remove() {
      for (const layerId of layerIds) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    },
  };
}
