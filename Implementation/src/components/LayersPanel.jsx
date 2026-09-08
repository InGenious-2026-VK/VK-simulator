import { useMemo, useState } from 'react';
import {
  IconChevronDown,
  IconChevronsLeft,
  IconLayers,
  IconSearch,
  IconBasemap,
  IconLegend,
  IconSettings2,
  IconCheck,
  IconGrip,
} from './icons.jsx';

const BASEMAPS = [
  { id: 'light', label: 'Light' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'satellite', label: 'Satellite' },
];

function LayerRow({ plugin, on, count, onToggle, dragProps }) {
  return (
    <div
      className={`layer ${on ? 'on' : 'off'}`}
      onClick={onToggle}
      role="checkbox"
      aria-checked={on}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <span className="cb">
        <IconCheck size={10} />
      </span>
      <span className="sw" style={{ background: plugin.color }} />
      <span className="nm" title={plugin.label}>
        {plugin.label}
      </span>
      {count != null && <span className="n mono">{count.toLocaleString('sv-SE')}</span>}
      {dragProps && (
        <span className="grip" title="Drag to reorder" {...dragProps}>
          <IconGrip size={9} />
        </span>
      )}
    </div>
  );
}

function Group({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`group${open ? '' : ' closed'}`}>
      <div className="group-head" onClick={() => setOpen((o) => !o)}>
        <IconChevronDown className="chev" size={12} sw={2.4} />
        <h4>{title}</h4>
        {count != null && <span className="count">{count}</span>}
      </div>
      <div className="group-body">{children}</div>
    </div>
  );
}

/**
 * Left workspace panel: filterable, reorderable, grouped layer list plus the
 * simulation-overlay toggles and the basemap picker.
 */
export default function LayersPanel({
  plugins,
  order,
  active,
  onToggle,
  onMove,
  layerCounts,
  showNetwork,
  showImpact,
  hasResult,
  onToggleNetwork,
  onToggleImpact,
  networkOpacity,
  impactOpacity,
  onNetworkOpacity,
  onImpactOpacity,
  basemap,
  onBasemap,
  collapsed,
  onCollapse,
}) {
  const [query, setQuery] = useState('');
  const [dragId, setDragId] = useState(null);

  const orderedPlugins = useMemo(
    () => order.map((id) => plugins.find((p) => p.id === id)).filter(Boolean),
    [order, plugins]
  );

  const q = query.trim().toLowerCase();
  const match = (p) =>
    !q || p.label.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);

  const groups = useMemo(() => {
    const byCat = new Map();
    for (const p of orderedPlugins) {
      if (!match(p)) continue;
      if (!byCat.has(p.category)) byCat.set(p.category, []);
      byCat.get(p.category).push(p);
    }
    return [...byCat];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedPlugins, q]);

  const dragHandlers = (plugin) => ({
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', plugin.id);
      setDragId(plugin.id);
    },
    onDragEnd: () => setDragId(null),
    onClick: (e) => e.stopPropagation(),
  });

  const rowDrop = (plugin) => ({
    onDragOver: (e) => {
      if (dragId && dragId !== plugin.id) e.preventDefault();
    },
    onDrop: (e) => {
      e.preventDefault();
      const from = order.indexOf(e.dataTransfer.getData('text/plain'));
      const to = order.indexOf(plugin.id);
      if (from !== -1 && to !== -1 && from !== to) onMove(from, to);
      setDragId(null);
    },
  });

  const railView = (
    <div className="rail">
      <button className="rail-btn on" title="Layers" onClick={onCollapse}>
        <IconLayers size={16} />
      </button>
      <div className="divider-h" />
      <button className="rail-btn" title="Search features">
        <IconSearch size={16} />
      </button>
      <button className="rail-btn" title="Basemap">
        <IconBasemap size={16} />
      </button>
      <button className="rail-btn" title="Legend">
        <IconLegend size={16} />
      </button>
    </div>
  );

  return (
    <aside className="panel panel-left">
      {railView}

      <div className="expanded">
        <div className="phead">
          <h3>Layers</h3>
          <div className="spacer" />
          <button className="btn btn-ghost btn-icon" title="Layer settings">
            <IconSettings2 size={14} />
          </button>
          <button className="btn btn-ghost btn-icon" title="Collapse panel" onClick={onCollapse}>
            <IconChevronsLeft size={14} />
          </button>
        </div>

        <div className="searchbox">
          <IconSearch size={14} sw={2} />
          <input
            className="input"
            placeholder="Filter layers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="pbody">
          {!q && (
            <div className="group">
              <div className="group-head" style={{ cursor: 'default' }}>
                <IconChevronDown className="chev" size={12} sw={2.4} />
                <h4>Simulation output</h4>
                <span className="count">2</span>
              </div>
              <div className="group-body">
                <div
                  className={`layer ${showNetwork ? 'on' : 'off'}`}
                  onClick={onToggleNetwork}
                >
                  <span className="cb">
                    <IconCheck size={10} />
                  </span>
                  <span className="sw" style={{ background: 'var(--c3)' }} />
                  <span className="nm">Supply network (flow lines)</span>
                </div>
                {showNetwork && (
                  <div className="layer-opacity">
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={networkOpacity}
                      onChange={(e) => onNetworkOpacity(Number(e.target.value))}
                    />
                    <span className="slider-val mono">{networkOpacity}%</span>
                  </div>
                )}
                <div
                  className={`layer ${showImpact && hasResult ? 'on' : 'off'}`}
                  onClick={() => hasResult && onToggleImpact()}
                  style={{ opacity: hasResult ? 1 : 0.55 }}
                >
                  <span className="cb">
                    <IconCheck size={10} />
                  </span>
                  <span className="sw" style={{ background: 'var(--destructive)' }} />
                  <span className="nm">Impact overlay {hasResult ? '' : '(run first)'}</span>
                </div>
                {showImpact && hasResult && (
                  <div className="layer-opacity">
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={impactOpacity}
                      onChange={(e) => onImpactOpacity(Number(e.target.value))}
                    />
                    <span className="slider-val mono">{impactOpacity}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {groups.map(([cat, list]) => (
            <Group key={cat} title={cat} count={list.length}>
              {list.map((p) => (
                <div
                  key={p.id}
                  className={`layer-item${dragId === p.id ? ' is-dragging' : ''}`}
                  {...rowDrop(p)}
                >
                  <LayerRow
                    plugin={p}
                    on={!!active[p.id]}
                    count={layerCounts?.[p.id]}
                    onToggle={() => onToggle(p.id)}
                    dragProps={dragHandlers(p)}
                  />
                </div>
              ))}
            </Group>
          ))}

          {groups.length === 0 && (
            <p className="notice" style={{ margin: 12 }}>
              No layers match “{query}”.
            </p>
          )}
        </div>

        <div style={{ flex: 'none', borderTop: '1px solid var(--border)' }}>
          <div className="group-head" style={{ cursor: 'default' }}>
            <h4>Basemap</h4>
          </div>
          <div className="basemap-row">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                className={`bm${basemap === b.id ? ' on' : ''}`}
                onClick={() => onBasemap(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
