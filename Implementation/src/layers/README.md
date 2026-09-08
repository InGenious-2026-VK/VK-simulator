# Layer plugins

Every map layer in the platform is a **plugin**: a single module under
`src/layers/plugins/` that describes one layer and how to draw it. The app core
knows nothing about specific layers — it discovers them, loads their data, adds
them to the map, and renders a toggle in the sidebar.

```
src/layers/
  defineLayer.js   the plugin contract (JSDoc types) + defaults/validation
  registry.js      auto-discovery of plugins/*.js, dependency ordering, grouping
  applyLayer.js    runtime: mounts a plugin's source + layers onto MapLibre,
                   wires popups and hover, returns a show/hide/update handle
  plugins/
    production.js
    processing.js
    logistics.js
    energy.js
    population.js
    population-density.js   (heatmap from WorldPop grid, async loadData, gradient legend)
    vulnerability.js        (derived from `logistics`)
```

Small static data lives inline in the plugin. Larger datasets go in
`Implementation/public/data/` and are fetched in `loadData` (see
`population-density.js`).

## Adding a layer

1. Create `src/layers/plugins/<id>.js`.
2. `export default` a plugin object.
3. That's it — the registry (`import.meta.glob('./plugins/*.js')`) picks it up,
   the sidebar shows a switch, and `MapView` mounts it.

### Minimal example

```js
/** @type {import('../defineLayer.js').LayerPlugin} */
export default {
  id: 'markets',
  label: 'Retail & markets',
  description: 'Supermarkets, wholesale, public kitchens',
  color: '#14b8a6',
  category: 'Dependencies & demand',
  order: 55,
  data: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Central wholesale market', description: '…' },
        geometry: { type: 'Point', coordinates: [15.62, 58.41] },
      },
    ],
  },
};
```

### Fields

| Field            | Required | Purpose |
|------------------|----------|---------|
| `id`             | yes      | Unique, stable, kebab-case. |
| `label`          | yes      | Sidebar name. |
| `color`          | yes      | Accent colour (hex): sidebar dot + default paint. |
| `description`    | no       | One line under the label. |
| `category`       | no       | Sidebar group. Default `"Layers"`. |
| `order`          | no       | Sort/draw weight, ascending. Default `100`. |
| `defaultVisible` | no       | Shown on first load. Default `false`. |
| `dependsOn`      | no       | Ids of layers this one derives from — they load first. |
| `data`           | \*       | Static GeoJSON `FeatureCollection`. |
| `loadData(ctx)`  | \*       | Async / derived GeoJSON. Wins over `data`. |
| `render`         | no       | Paint tweaks for the default renderer (see below). |
| `mapLayers(ctx)` | no       | Full control: return raw MapLibre layer specs. |
| `renderPopup(feature, plugin)` | no | HTML string for the click popup; `''` = none. |
| `legend`         | no       | Colour key shown in the sidebar while the layer is on. Discrete: `{ title?, stops: [{ color, label }] }`. Continuous: `{ title?, gradient: [hex, …], min?, max? }` (renders a gradient bar with end labels). |

\* provide one of `data` or `loadData`.

### Default renderer

If you don't supply `mapLayers`, the runtime adds three MapLibre layers from
your source — a `fill` (polygons), a `line` (lines + polygon outlines) and a
`circle` (points) — all in `color`. Tune them with `render`:

```js
render: { circleRadius: 9, lineWidth: 3, fillOpacity: 0.15, pointColor: '#…' }
```

### Data loading & derived layers

`loadData` receives a context:

```js
loadData: async ({ bbox, boundary, getLayerData }) => {
  // bbox: [w, s, e, n] of the region
  // boundary: the region polygon FeatureCollection
  // getLayerData(id): another layer's data — only ids in `dependsOn`
  //                   are guaranteed to be loaded already
  const res = await fetch('https://example.se/api/...');
  return await res.json();
}
```

`population-density.js` is a worked example of `loadData` fetching a bundled
dataset from `public/data/` and reshaping it into GeoJSON.

`vulnerability.js` is a worked example of a derived layer: it declares
`dependsOn: ['logistics']` and builds its features from the logistics corridors.

### Rendering notes

- Plugin layers mount **above** the region mask and boundary.
- **Draw order is user-controlled.** The sidebar is a drag-to-reorder list
  (top of the list draws on top); the order is persisted per browser
  (`localStorage`). `order` only sets the *default* position for a plugin —
  ascending = lower in the stack. `dependsOn` still fixes *data load* order
  regardless of draw order.
- Popups fire on click for every layer the plugin adds; `mouseenter`/`leave`
  set the pointer cursor automatically.
- Toggling a layer in the sidebar calls the mounted handle's `setVisible()`; it
  does not reload data. Reordering calls `map.moveLayer()`; it does not reload
  data either.
