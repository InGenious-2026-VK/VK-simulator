import { defineLayer } from './defineLayer.js';

// Plugin auto-discovery: every `src/layers/plugins/*.js` module whose default
// export is a LayerPlugin is registered. Adding a layer = adding a file.
const modules = import.meta.glob('./plugins/*.js', { eager: true });

function buildRegistry() {
  const list = Object.entries(modules).map(([path, mod]) => {
    if (!mod.default) {
      throw new Error(`Layer plugin at ${path} has no default export`);
    }
    return defineLayer(mod.default);
  });

  const seen = new Set();
  for (const p of list) {
    if (seen.has(p.id)) throw new Error(`Duplicate layer plugin id: "${p.id}"`);
    seen.add(p.id);
  }

  return sortByDependencyThenOrder(list);
}

// Derived layers load (and draw) after the layers they depend on; within the
// same dependency level, `order` then `label` decide the sequence.
function sortByDependencyThenOrder(list) {
  const byId = new Map(list.map((p) => [p.id, p]));
  const ordered = [...list].sort(
    (a, b) => a.order - b.order || a.label.localeCompare(b.label)
  );

  const result = [];
  const done = new Set();
  const visit = (plugin, stack) => {
    if (done.has(plugin.id)) return;
    if (stack.has(plugin.id)) {
      throw new Error(`Circular layer dependency involving "${plugin.id}"`);
    }
    stack.add(plugin.id);
    for (const depId of plugin.dependsOn) {
      const dep = byId.get(depId);
      if (dep) visit(dep, stack);
    }
    stack.delete(plugin.id);
    done.add(plugin.id);
    result.push(plugin);
  };
  ordered.forEach((p) => visit(p, new Set()));
  return result;
}

export const LAYER_PLUGINS = buildRegistry();

/** Groups plugins by `category`, preserving registry order within each group. */
export function groupByCategory(plugins = LAYER_PLUGINS) {
  const groups = new Map();
  for (const plugin of plugins) {
    if (!groups.has(plugin.category)) groups.set(plugin.category, []);
    groups.get(plugin.category).push(plugin);
  }
  return [...groups].map(([category, layers]) => ({ category, layers }));
}

/** Initial `{ [id]: boolean }` visibility state from each plugin's default. */
export function initialVisibility(plugins = LAYER_PLUGINS) {
  return Object.fromEntries(plugins.map((p) => [p.id, !!p.defaultVisible]));
}
