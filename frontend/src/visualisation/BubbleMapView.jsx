import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// The same light background map as the main app (OpenStreetMap data served by
// OpenFreeMap: free, no API key, needs an internet connection).
const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';
const LAYER = 'viz-bubbles';

const MAX_RADIUS = 22; // px, the circle for the biggest value
const LEGEND_PAD = 8; // px around the legend circles

// Each place gets a level from 5 (smallest value in the data) to 100 (biggest),
// in steps of 1. The level sets both the circle's size and its colour.
const MIN_LEVEL = 5;
const MAX_LEVEL = 100;
// One hue, light to dark (a sequential scale): light pink for the smallest
// value, dark red for the biggest. Mixed in Lab space, so the steps look even.
const LIGHT = '#f7b6c4';
const DARK = '#7a0c1e';

const numberFormat = new Intl.NumberFormat('en-GB');

/** Level 5–100 of a value, in whole steps, between the data's min and max. */
function levelFor(value, min, max) {
  if (max <= min) return MAX_LEVEL;
  return Math.round(MIN_LEVEL + ((value - min) / (max - min)) * (MAX_LEVEL - MIN_LEVEL));
}

/** The circle's AREA follows the level, so the radius grows with its square root. */
const radiusFor = (level) => MAX_RADIUS * Math.sqrt(level / MAX_LEVEL);

/** Same colour as the map draws (MapLibre's interpolate-lab), for the legend. */
function colorFor(level) {
  const t = (level - MIN_LEVEL) / (MAX_LEVEL - MIN_LEVEL);
  const lab = (hex) => {
    const lin = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const [x, y, z] = [
      (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047,
      0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2],
      (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883,
    ].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const [a, b] = [lab(LIGHT), lab(DARK)];
  const [L, A, B] = a.map((v, i) => v + (b[i] - v) * t);
  const fy = (L + 16) / 116;
  const [x, y, z] = [fy + A / 500, fy, fy - B / 200].map((f) =>
    f ** 3 > 0.008856 ? f ** 3 : (f - 16 / 116) / 7.787
  );
  const [X, Z] = [x * 0.95047, z * 1.08883];
  const rgb = [
    3.2406 * X - 1.5372 * y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * y + 0.0415 * Z,
    0.0557 * X - 0.204 * y + 1.057 * Z,
  ].map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  });
  return `rgb(${rgb.join(',')})`;
}

/**
 * Bubble map: one circle per place, sized and coloured by its value.
 * Circles carry no name labels (with many places they collided and were
 * confusing); the tooltip names a place on hover or tap.
 * rows: [{ name, lat, lon, value }]; unit is appended to values.
 *
 * It is its own small map inside the panel, not a layer on the main app's map.
 * wheelZoom: false leaves the mouse wheel to the page around the map
 * (the data overview's card stacks use it to turn cards); the buttons still zoom.
 */
export default function BubbleMapView({ rows, unit = '', wheelZoom = true }) {
  const container = useRef(null);
  const [hover, setHover] = useState(null); // { x, y, name, value, flip }
  const [failed, setFailed] = useState(false);

  const values = rows.map((r) => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
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
      // On an overview card the wheel turns cards instead, so it never zooms.
      cooperativeGestures: wheelZoom,
      scrollZoom: wheelZoom,
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
            properties: { name: r.name, value: r.value, level: levelFor(r.value, min, max) },
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
          // Same formulas as radiusFor() and colorFor(), which draw the legend.
          'circle-radius': ['*', MAX_RADIUS, ['sqrt', ['/', ['get', 'level'], MAX_LEVEL]]],
          'circle-color': ['interpolate-lab', ['linear'], ['get', 'level'], MIN_LEVEL, LIGHT, MAX_LEVEL, DARK],
          'circle-opacity': 0.9,
          // A ring in the background colour keeps overlapping circles apart.
          'circle-stroke-color': css('--viz-surface'),
          'circle-stroke-width': 1.5,
        },
      });
    });
    // Without the background map's style nothing can be drawn at all.
    map.on('error', (e) => {
      console.error('Bubble map:', e.error ?? e);
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
  }, [rows, min, max, wheelZoom]);

  if (failed) {
    return (
      <p className="viz-message viz-error">
        Could not load the background map. Check the internet connection and reload.
      </p>
    );
  }

  // Legend: the smallest and the biggest circle, with their values.
  const legend = max > min ? [MAX_LEVEL, MIN_LEVEL].map((level) => ({ level, value: level === MAX_LEVEL ? max : min })) : [{ level: MAX_LEVEL, value: max }];
  const legendRadius = MAX_RADIUS;

  return (
    <div className="viz-map">
      <div ref={container} className="viz-map-canvas" />
      <svg
        className="viz-map-legend"
        width={legendRadius * 2 + 110}
        height={legend.length * (legendRadius * 2 + LEGEND_PAD)}
        role="img"
        aria-label={`Bigger and darker circles show higher values, from ${withUnit(min)} to ${withUnit(max)}`}
      >
        {legend.map(({ level, value }, i) => {
          const r = radiusFor(level);
          const cy = i * (legendRadius * 2 + LEGEND_PAD) + legendRadius + LEGEND_PAD / 2;
          return (
            <g key={level}>
              <circle cx={legendRadius + 1} cy={cy} r={r} style={{ fill: colorFor(level) }} />
              <text x={legendRadius * 2 + 10} y={cy} dominantBaseline="middle">
                {level === MAX_LEVEL ? 'highest' : 'lowest'} {withUnit(value)}
              </text>
            </g>
          );
        })}
      </svg>
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
