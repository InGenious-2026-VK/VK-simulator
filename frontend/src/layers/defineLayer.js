/**
 * Layer plugin contract for the Östergötland Food Resilience Platform.
 *
 * Each map layer is a self-contained plugin. To add one, drop a file in
 * `src/layers/plugins/<id>.js` whose default export is a LayerPlugin — the
 * registry picks it up automatically (see registry.js). Nothing in the app
 * core needs to change.
 *
 * @typedef {import('geojson').FeatureCollection} FeatureCollection
 *
 * @typedef {Object} LayerLoadContext
 * @property {[number, number, number, number]} bbox  Region bbox [w, s, e, n].
 * @property {FeatureCollection} boundary             Region boundary polygon.
 * @property {(id: string) => FeatureCollection | undefined} getLayerData
 *           Returns another (already-loaded) layer's data. Only layers listed
 *           in `dependsOn` are guaranteed to be available.
 *
 * @typedef {Object} LayerRenderContext
 * @property {LayerPlugin} plugin
 * @property {string} color
 *
 * @typedef {Object} LayerRender  Paint tweaks for the default renderer.
 * @property {number} [circleRadius]
 * @property {string} [pointColor]
 * @property {string} [lineColor]
 * @property {number} [lineWidth]
 * @property {string} [fillColor]
 * @property {number} [fillOpacity]
 *
 * @typedef {Object} LayerPlugin
 * @property {string}  id              Unique, stable, kebab-case.
 * @property {string}  label           Sidebar name.
 * @property {string}  [description]   One line shown under the label.
 * @property {string}  color           Accent colour (hex) — sidebar dot + default paint.
 * @property {string}  [category]      Sidebar group (unused by the current flat
 *           list UI; kept for grouping views). Default "Layers".
 * @property {number}  [order]         Default stack position, ascending = lower
 *           in the map / lower in the sidebar list. Users can override by
 *           dragging (persisted per browser). Default 100.
 * @property {boolean} [defaultVisible] Shown on first load. Default false.
 * @property {string[]} [dependsOn]    Ids of layers this one derives from; they
 *           load first and become available through `getLayerData`.
 * @property {FeatureCollection} [data]  Static GeoJSON.
 * @property {(ctx: LayerLoadContext) => FeatureCollection | Promise<FeatureCollection>} [loadData]
 *           Dynamic or derived GeoJSON. Takes precedence over `data`.
 * @property {LayerRender} [render]    Paint overrides for the default renderer.
 * @property {(ctx: LayerRenderContext) => object[]} [mapLayers]
 *           Full control: return raw MapLibre layer specs. `source`, `id`
 *           namespacing and `visibility` are applied by the runtime.
 * @property {(feature: GeoJSON.Feature, plugin: LayerPlugin) => string} [renderPopup]
 *           HTML for the click popup. Return '' to suppress it.
 * @property {LayerLegend} [legend]  Colour key shown in the sidebar while the
 *           layer is on — for graduated/choropleth layers.
 *
 * @typedef {Object} LayerLegend
 * @property {string} [title]
 * @property {{ color: string, label: string }[]} [stops]  Discrete swatches.
 * @property {string[]} [gradient]  Colours for a continuous bar (low→high).
 * @property {string} [min]  End label under a gradient bar (left).
 * @property {string} [max]  End label under a gradient bar (right).
 */

const REQUIRED = ['id', 'label', 'color'];

/** Normalises a plugin, filling defaults and validating required fields. */
export function defineLayer(plugin) {
  for (const key of REQUIRED) {
    if (!plugin || plugin[key] == null) {
      throw new Error(`Layer plugin is missing required field "${key}"`);
    }
  }
  return {
    category: 'Layers',
    order: 100,
    defaultVisible: false,
    dependsOn: [],
    ...plugin,
  };
}
