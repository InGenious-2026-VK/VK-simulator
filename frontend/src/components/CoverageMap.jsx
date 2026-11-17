import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import boundaryData from '../data/ostergotland-boundary.json';
import { BASE_STYLES, BBOX, withStyleFallback } from './MapView.jsx';
import { getGeometryUrl } from '../api/client.js';
import { propsTableHtml } from '../lib/escape.js';

/**
 * Map of one or more datasets' features over the county boundary.
 * layers: [{ id, title, color, url }] — url is the API geometry_url.
 */
export default function CoverageMap({ layers, height = 340, bbox }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const [failed, setFailed] = useState([]);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: ref.current,
      style: BASE_STYLES.light,
      bounds: [
        [BBOX[0], BBOX[1]],
        [BBOX[2], BBOX[3]],
      ],
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    withStyleFallback(map);
    mapRef.current = map;

    map.on('load', async () => {
      map.addSource('boundary', { type: 'geojson', data: boundaryData });
      map.addLayer({
        id: 'boundary',
        type: 'line',
        source: 'boundary',
        paint: { 'line-color': '#71717a', 'line-width': 1.5, 'line-dasharray': [2, 2] },
      });
      const bad = [];
      for (const layer of layers) {
        let fc;
        try {
          fc = await getGeometryUrl(`${layer.url}${layer.url.includes('?') ? '&' : '?'}simplify=0.0005`);
        } catch {
          bad.push(layer.title);
          continue;
        }
        if (mapRef.current !== map) return;
        const src = `ds-${layer.id}`;
        map.addSource(src, { type: 'geojson', data: fc });
        map.addLayer({
          id: `${src}-fill`,
          type: 'fill',
          source: src,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': layer.color, 'fill-opacity': 0.25 },
        });
        map.addLayer({
          id: `${src}-line`,
          type: 'line',
          source: src,
          filter: ['match', ['geometry-type'], ['LineString', 'Polygon'], true, false],
          paint: { 'line-color': layer.color, 'line-width': 2, 'line-opacity': 0.85 },
        });
        map.addLayer({
          id: `${src}-pt`,
          type: 'circle',
          source: src,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': 5,
            'circle-color': layer.color,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 1.5,
          },
        });
        for (const kind of ['pt', 'line', 'fill']) {
          map.on('click', `${src}-${kind}`, (e) => {
            new maplibregl.Popup({ maxWidth: '280px' })
              .setLngLat(e.lngLat)
              .setHTML(propsTableHtml(layer.title, e.features[0].properties))
              .addTo(map);
          });
          map.on('mouseenter', `${src}-${kind}`, () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', `${src}-${kind}`, () => (map.getCanvas().style.cursor = ''));
        }
      }
      setFailed(bad);
      if (bbox) {
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 40, maxZoom: 10, duration: 0 }
        );
      }
    });
    return () => {
      mapRef.current = null;
      map.remove();
    };
    // Layers are fixed for the lifetime of a summary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="coverage-map" style={{ height }}>
      <div ref={ref} className="coverage-map-canvas" />
      {failed.length > 0 && <div className="map-note">Could not load: {failed.join(', ')}</div>}
    </div>
  );
}
