import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// The same light background map as the main app (OpenStreetMap data served by
// OpenFreeMap: free, no API key, needs an internet connection).
const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';
const LAYER = 'viz-bubbles';
const LABEL_FONT = ['Noto Sans Regular']; // a font the background map provides
const LABEL_SIZE = 11; // px

const MAX_RADIUS = 22; // px, the circle for the biggest value
const MIN_RADIUS = 2; // px, so a place with a tiny value stays findable
const LEGEND_PAD = 8; // px above the legend circles, room for the top label

const numberFormat = new Intl.NumberFormat('en-GB');

/** The circle's AREA shows the value, so the radius grows with the square root. */
const radiusFor = (value, max) =>
  max > 0 ? Math.max(MIN_RADIUS, MAX_RADIUS * Math.sqrt(value / max)) : MIN_RADIUS;

/** Biggest "round" number (1, 2 or 5 followed by zeros) that is not above max. */
function roundBelow(max) {
  const power = 10 ** Math.floor(Math.log10(max));
  return [5, 2, 1].find((step) => step * power <= max) * power;
}

/**
 * Bubble map: one circle per place, sized by its value.
 * rows: [{ name, lat, lon, value }]; unit is appended to values.
 *
 * It is its own small map inside the panel, not a layer on the main app's map.
 */
export default function BubbleMapView({ rows, unit = '' }) {
  const container = useRef(null);
  const [hover, setHover] = useState(null); // { x, y, name, value, flip }
  const [failed, setFailed] = useState(false);

  const max = Math.max(...rows.map((r) => r.value));
  const withUnit = (v) => `${numberFormat.format(v)}${unit ? ` ${unit}` : ''}`;

  useEffect(() => {
    const el = container.current;
    // MapLibre cannot read CSS variables, so hand it the panel's colours as text.
    const css = (name) => getComputedStyle(el).getPropertyValue(name).trim();

    const lons = rows.map((r) => r.lon);
    const lats = rows.map((r) => r.lat);
    const map = new maplibregl.Map({
      container: el,
      style: BASEMAP,
      // Start zoomed to fit all places, with room for the biggest circle.
      bounds: [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      // More room on the right for the zoom buttons, at the bottom for the map credits.
      fitBoundsOptions: {
        padding: { top: MAX_RADIUS + 12, left: MAX_RADIUS + 12, right: MAX_RADIUS + 40, bottom: MAX_RADIUS + 40 },
        maxZoom: 10,
      },
      // Scrolling the page must not zoom the map by accident: zoom needs Ctrl + scroll.
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    let styleLoaded = false;
    map.on('style.load', () => {
      styleLoaded = true;
      map.addSource(LAYER, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: rows.map((r) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
            properties: { name: r.name, value: r.value, radius: radiusFor(r.value, max) },
          })),
        },
      });
      map.addLayer({
        id: LAYER,
        type: 'circle',
        source: LAYER,
        // Small circles are drawn last, so a big one never hides them.
        layout: { 'circle-sort-key': ['-', ['get', 'value']] },
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': css('--viz-series-1'),
          'circle-opacity': 0.6,
          // A ring in the background colour keeps overlapping circles apart.
          'circle-stroke-color': css('--viz-surface'),
          'circle-stroke-width': 1.5,
        },
      });
      // Place names next to the circles. Where two names would collide the map
      // leaves one out; the tooltip still names every circle.
      map.addLayer({
        id: `${LAYER}-names`,
        type: 'symbol',
        source: LAYER,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': LABEL_FONT,
          'text-size': LABEL_SIZE,
          // Just outside the circle's edge, on whichever side has room.
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': ['/', ['+', ['get', 'radius'], 3], LABEL_SIZE],
          // The biggest values get their name first.
          'symbol-sort-key': ['-', ['get', 'value']],
        },
        paint: {
          'text-color': css('--viz-text'),
          'text-halo-color': css('--viz-surface'),
          'text-halo-width': 1.5,
        },
      });
    });
    // Without the background map's style nothing can be drawn at all.
    map.on('error', () => {
      if (!styleLoaded) setFailed(true);
    });

    const show = (e) => {
      const { name, value } = e.features[0].properties;
      // In the right half the tooltip opens to the left, so it stays inside the map.
      setHover({ x: e.point.x, y: e.point.y, name, value, flip: e.point.x > el.clientWidth / 2 });
    };
    map.on('mousemove', LAYER, show);
    map.on('click', LAYER, show); // touch screens have no hover
    map.on('mouseleave', LAYER, () => setHover(null));

    return () => map.remove();
  }, [rows, max]);

  if (failed) {
    return (
      <p className="viz-message viz-error">
        Could not load the background map. Check the internet connection and reload.
      </p>
    );
  }

  // Size legend: a round value near the top of the data, and a quarter of it.
  const reference = max > 0 ? roundBelow(max) : null;
  const legend = reference ? [reference, reference / 4] : [];
  const legendRadius = reference ? radiusFor(reference, max) : 0;

  return (
    <div className="viz-map">
      <div ref={container} className="viz-map-canvas" />
      {legend.length > 0 && (
        <svg
          className="viz-map-legend"
          width={legendRadius * 2 + 52}
          height={legendRadius * 2 + LEGEND_PAD + 1}
          role="img"
          aria-label={`Circle size shows the value: ${legend.map(withUnit).join(', ')}`}
        >
          {legend.map((value) => {
            const r = radiusFor(value, max);
            const top = LEGEND_PAD + (legendRadius - r) * 2; // circles share the same bottom edge
            return (
              <g key={value}>
                <circle cx={legendRadius + 1} cy={top + r} r={r} />
                <line x1={legendRadius + 1} x2={legendRadius * 2 + 8} y1={top} y2={top} />
                <text x={legendRadius * 2 + 12} y={top} dominantBaseline="middle">
                  {withUnit(value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover && (
        <div
          className={`viz-map-tooltip${hover.flip ? ' viz-map-tooltip-left' : ''}`}
          style={{ left: hover.x, top: hover.y }}
        >
          <strong>{hover.name}</strong>
          <span>{withUnit(hover.value)}</span>
        </div>
      )}
    </div>
  );
}
