import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import boundaryData from '../data/ostergotland-boundary.json';
import { LAYER_PLUGINS } from '../layers/registry.js';
import { mountLayer, EMPTY_FC } from '../layers/applyLayer.js';
import { networkToFeatures, resultToFeatures } from '../scenario/simLayers.js';

// Minimal light basemap — OpenStreetMap data as vector tiles via OpenFreeMap
// (free, no API key). Terrain / satellite are raster fallbacks.
const raster = (tiles, attribution) => ({
  version: 8,
  sources: { base: { type: 'raster', tiles, tileSize: 256, attribution, maxzoom: 18 } },
  layers: [{ id: 'base', type: 'raster', source: 'base' }],
});

const BASE_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  terrain: raster(
    [
      'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
    ],
    '© OpenTopoMap (CC-BY-SA)'
  ),
  satellite: raster(
    ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    'Imagery © Esri'
  ),
};

const BOUNDARY_RING = boundaryData.features[0].geometry.coordinates[0];

const BBOX = BOUNDARY_RING.reduce(
  (b, [lng, lat]) => [
    Math.min(b[0], lng),
    Math.min(b[1], lat),
    Math.max(b[2], lng),
    Math.max(b[3], lat),
  ],
  [180, 90, -180, -90]
);

const MASK_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-40, 30],
            [60, 30],
            [60, 75],
            [-40, 75],
            [-40, 30],
          ],
          BOUNDARY_RING,
        ],
      },
    },
  ],
};

const SIM_LAYER_IDS = [
  'sim-net-edge',
  'sim-net-edge-closed',
  'sim-impact-edge',
  'sim-net-node',
  'sim-impact-ring',
];

function restackLayers(map, layerOrder, handles) {
  for (const id of [...layerOrder].reverse()) {
    const handle = handles.get(id);
    if (!handle) continue;
    for (const layerId of handle.layerIds) {
      if (map.getLayer(layerId)) map.moveLayer(layerId);
    }
  }
}

function setupSimLayers(map) {
  for (const id of ['sim-net-edges', 'sim-net-nodes', 'sim-impact-edges', 'sim-impact-demand']) {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY_FC });
  }

  map.addLayer({
    id: 'sim-net-edge',
    type: 'line',
    source: 'sim-net-edges',
    filter: ['!', ['get', 'closed']],
    paint: {
      'line-color': ['match', ['get', 'mode'], 'rail', '#1e4e6e', '#475569'],
      'line-width': 1.8,
      'line-opacity': 0.5,
    },
  });
  map.addLayer({
    id: 'sim-net-edge-closed',
    type: 'line',
    source: 'sim-net-edges',
    filter: ['get', 'closed'],
    paint: {
      'line-color': '#e7000b',
      'line-width': 2.2,
      'line-opacity': 0.9,
      'line-dasharray': [2, 2],
    },
  });
  map.addLayer({
    id: 'sim-net-node',
    type: 'circle',
    source: 'sim-net-nodes',
    paint: {
      'circle-radius': ['get', 'radius'],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': ['case', ['get', 'offline'], '#b91c1c', '#ffffff'],
      'circle-stroke-width': ['case', ['get', 'offline'], 3, 1.6],
    },
  });
  map.addLayer({
    id: 'sim-impact-edge',
    type: 'line',
    source: 'sim-impact-edges',
    paint: {
      'line-color': [
        'case',
        ['get', 'closed'], '#94a3b8',
        ['get', 'saturated'], '#b91c1c',
        ['interpolate', ['linear'], ['get', 'utilization'], 0, '#cbd5e1', 0.8, '#f59e0b', 1, '#ef4444'],
      ],
      'line-width': ['case', ['get', 'saturated'], 3.5, 2.4],
      'line-opacity': ['case', ['get', 'closed'], 0.4, 0.85],
    },
  });
  map.addLayer({
    id: 'sim-impact-ring',
    type: 'circle',
    source: 'sim-impact-demand',
    paint: {
      'circle-radius': ['get', 'radius'],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.22,
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 2.5,
    },
  });

}

// One-time interaction wiring (kept out of setupSimLayers so a basemap swap
// doesn't stack duplicate listeners).
function wireSimInteractions(map, onToggleEdgeRef, onInspectNodeRef) {
  map.on('click', (e) => {
    if (!map.getLayer('sim-net-node')) return;
    if (map.getLayoutProperty('sim-net-node', 'visibility') === 'none') return;
    const near = map.queryRenderedFeatures(
      [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6],
      ],
      { layers: ['sim-net-node', 'sim-net-edge', 'sim-net-edge-closed'].filter((l) => map.getLayer(l)) }
    );
    const node = near.find((f) => f.layer.id === 'sim-net-node');
    const edge = near.find((f) => f.layer.id.startsWith('sim-net-edge'));
    if (node && onInspectNodeRef.current) {
      onInspectNodeRef.current({ ...node.properties, point: e.point });
    } else if (edge && onToggleEdgeRef.current) {
      onToggleEdgeRef.current(edge.properties.id);
    }
  });
  for (const id of ['sim-net-edge', 'sim-net-edge-closed', 'sim-net-node']) {
    map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
  }
}

export default function MapView({
  activeLayers,
  layerOrder,
  simNetwork,
  simScenario,
  simResult,
  showNetwork = true,
  showImpact = true,
  impactOpacity = 100,
  networkOpacity = 100,
  basemap = 'light',
  onToggleEdge,
  onToggleNode,
  onInspectNode,
  onMapRef,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const handlesRef = useRef(new Map());
  const dataCacheRef = useRef(new Map());
  const [mapReady, setMapReady] = useState(false);

  const activeLayersRef = useRef(activeLayers);
  activeLayersRef.current = activeLayers;
  const layerOrderRef = useRef(layerOrder);
  layerOrderRef.current = layerOrder;
  const onToggleEdgeRef = useRef(onToggleEdge);
  onToggleEdgeRef.current = onToggleEdge;
  const onToggleNodeRef = useRef(onToggleNode);
  onToggleNodeRef.current = onToggleNode;
  const onInspectNodeRef = useRef(onInspectNode);
  onInspectNodeRef.current = onInspectNode;

  // (Re)build every workspace layer on top of the current basemap style.
  // Idempotent: tears down anything it previously added first, so a repeated
  // call (StrictMode, HMR, basemap swap) never throws "already exists".
  const buildingRef = useRef(false);
  async function buildLayers(map) {
    if (buildingRef.current) return;
    buildingRef.current = true;
    setMapReady(false);

    for (const h of handlesRef.current.values()) {
      try {
        h.remove();
      } catch {
        /* style may already be gone */
      }
    }
    handlesRef.current.clear();
    for (const id of [...SIM_LAYER_IDS, 'boundary-line', 'mask-fill']) {
      if (map.getLayer(id)) map.removeLayer(id);
    }

    if (!map.getSource('mask')) map.addSource('mask', { type: 'geojson', data: MASK_GEOJSON });
    map.addLayer({
      id: 'mask-fill',
      type: 'fill',
      source: 'mask',
      paint: { 'fill-color': '#ffffff', 'fill-opacity': basemap === 'light' ? 1 : 0.72 },
    });

    if (!map.getSource('boundary')) map.addSource('boundary', { type: 'geojson', data: boundaryData });
    map.addLayer({
      id: 'boundary-line',
      type: 'line',
      source: 'boundary',
      paint: { 'line-color': '#a1a1aa', 'line-width': 1.5 },
    });

    setupSimLayers(map);

    const loaded = new Map();
    const ctx = { bbox: BBOX, boundary: boundaryData, getLayerData: (id) => loaded.get(id) };

    for (const plugin of LAYER_PLUGINS) {
      let data = dataCacheRef.current.get(plugin.id);
      if (!data) {
        try {
          data = plugin.loadData ? await plugin.loadData(ctx) : plugin.data || EMPTY_FC;
        } catch (err) {
          console.error(`Layer plugin "${plugin.id}" failed to load:`, err);
          data = EMPTY_FC;
        }
        dataCacheRef.current.set(plugin.id, data);
      }
      loaded.set(plugin.id, data);
      if (mapRef.current !== map) {
        buildingRef.current = false;
        return;
      }
      if (map.getSource(`layer:${plugin.id}`)) continue; // already mounted
      const handle = mountLayer(map, plugin, data, {
        visible: !!activeLayersRef.current[plugin.id],
      });
      handlesRef.current.set(plugin.id, handle);
      restackLayers(map, layerOrderRef.current, handlesRef.current);
    }

    buildingRef.current = false;
    if (mapRef.current === map) setMapReady(true);
  }

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLES.light,
      bounds: [
        [BBOX[0], BBOX[1]],
        [BBOX[2], BBOX[3]],
      ],
      fitBoundsOptions: { padding: 24 },
      maxBounds: [
        [BBOX[0] - 0.4, BBOX[1] - 0.4],
        [BBOX[2] + 0.4, BBOX[3] + 0.4],
      ],
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    onMapRef?.(map);
    if (import.meta.env.DEV) window.__map = map;

    map.on('load', async () => {
      map.setMinZoom(map.getZoom() - 0.4);
      wireSimInteractions(map, onToggleEdgeRef, onInspectNodeRef);
      await buildLayers(map);
    });

    return () => {
      mapRef.current = null;
      handlesRef.current.clear();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap switch: swap the style, then re-attach every workspace layer.
  // Compare against the *applied* basemap (not a first-run flag) so StrictMode's
  // double effect invocation can't trigger a spurious restyle on mount.
  const appliedBasemapRef = useRef('light');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedBasemapRef.current === basemap) return;
    appliedBasemapRef.current = basemap;
    map.setStyle(BASE_STYLES[basemap] || BASE_STYLES.light, { diff: false });
    map.once('style.load', () => buildLayers(map));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  useEffect(() => {
    for (const [id, handle] of handlesRef.current) {
      handle.setVisible(!!activeLayers[id]);
    }
  }, [activeLayers, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getSource('sim-net-edges')) return;

    const { nodesFC, edgesFC } = networkToFeatures(simNetwork, simScenario);
    map.getSource('sim-net-nodes').setData(nodesFC);
    map.getSource('sim-net-edges').setData(edgesFC);

    const { demandFC, edgesFC: impactEdgesFC } = resultToFeatures(simResult);
    map.getSource('sim-impact-demand').setData(demandFC);
    map.getSource('sim-impact-edges').setData(impactEdgesFC);

    const vis = {
      'sim-net-edge': showNetwork,
      'sim-net-edge-closed': showNetwork,
      'sim-net-node': showNetwork,
      'sim-impact-edge': showImpact && !!simResult,
      'sim-impact-ring': showImpact && !!simResult,
    };
    for (const [id, on] of Object.entries(vis)) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
    if (map.getLayer('sim-net-edge')) {
      map.setPaintProperty('sim-net-edge', 'line-opacity', 0.5 * (networkOpacity / 100));
      map.setPaintProperty('sim-net-edge-closed', 'line-opacity', 0.9 * (networkOpacity / 100));
    }
    if (map.getLayer('sim-impact-ring')) {
      map.setPaintProperty('sim-impact-ring', 'circle-opacity', 0.22 * (impactOpacity / 100));
    }
    for (const id of SIM_LAYER_IDS) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }, [mapReady, simNetwork, simScenario, simResult, showNetwork, showImpact, impactOpacity, networkOpacity]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && handlesRef.current.size) {
      restackLayers(map, layerOrder, handlesRef.current);
    }
  }, [layerOrder, mapReady]);

  return <div ref={containerRef} className="map-root" />;
}

export { BBOX };
