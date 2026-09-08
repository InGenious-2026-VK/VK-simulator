import { useEffect, useRef, useState } from 'react';
import MapView from './MapView.jsx';
import { Badge } from './ui.jsx';
import { Sparkline, synthSeries } from './charts.jsx';
import {
  IconHand,
  IconMarquee,
  IconRuler,
  IconIsochrone,
  IconSplit,
  IconExpand,
  IconChevronDown,
  IconX,
  IconSpinner,
} from './icons.jsx';

const NODE_KIND = {
  farm: 'Farm / primary production',
  import: 'Import gateway',
  processing: 'Processing facility',
  storage: 'Storage / distribution centre',
  demand: 'Municipality demand centre',
  energy: 'Energy / water dependency',
};

function Legend() {
  const [mini, setMini] = useState(false);
  return (
    <div className={`map-ui map-legend${mini ? ' mini' : ''}`}>
      <h4 onClick={() => setMini((m) => !m)}>
        <IconChevronDown size={10} sw={3} />
        Legend
      </h4>
      <div className="lg-collapsible">
        <div className="lg-row">
          <i className="lg-swatch" style={{ background: 'var(--c2)' }} />
          Farm / primary production
        </div>
        <div className="lg-row">
          <i className="lg-swatch" style={{ background: 'var(--c1)' }} />
          Processing facility
        </div>
        <div className="lg-row">
          <i className="lg-swatch" style={{ background: 'var(--c3)' }} />
          Distribution centre
        </div>
        <div className="lg-row">
          <i className="lg-swatch" style={{ background: 'var(--c4)' }} />
          Retail / demand
        </div>
        <div
          className="lg-row"
          style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}
        >
          <i className="lg-line" style={{ borderColor: 'var(--c3)' }} />
          Commodity flow
        </div>
        <div className="lg-row">
          <i
            className="lg-line"
            style={{ borderColor: 'var(--destructive)', borderTopStyle: 'dashed' }}
          />
          Disrupted link
        </div>
      </div>
    </div>
  );
}

function NodePopover({ node, onClose, onToggleOutage, onIsolate }) {
  const spark = synthSeries(24, 74, 0.6, true, 9);
  const throughput = Number(node.throughput || 0);
  return (
    <div className="node-pop">
      <div className="np-head">
        <span
          className="lg-swatch"
          style={{ background: node.color || 'var(--c3)', width: 12, height: 12, marginTop: 3 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4>{node.name}</h4>
          <div className="sub">
            {NODE_KIND[node.type] || node.type} · node {node.id}
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}>
          <IconX size={13} sw={2} />
        </button>
      </div>
      <div className="np-body">
        <div className="np-row">
          <span>Type</span>
          <b>{NODE_KIND[node.type] || node.type}</b>
        </div>
        {throughput > 0 && (
          <div className="np-row">
            <span>Throughput</span>
            <b className="mono">{throughput.toLocaleString('sv-SE')} t/wk</b>
          </div>
        )}
        <div className="np-row">
          <span>Status</span>
          <b>{node.offline === 'true' || node.offline === true ? 'Offline (in scenario)' : 'Operating'}</b>
        </div>
        <div style={{ marginTop: 9 }}>
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            Illustrative utilisation trace
          </div>
          <Sparkline data={spark} w={240} h={40} />
        </div>
        <div style={{ marginTop: 8 }}>
          <Badge variant="warn" dot>
            Sample analytics — not from the live run
          </Badge>
        </div>
      </div>
      <div className="np-foot">
        <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={onIsolate}>
          Zoom to node
        </button>
        <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={onToggleOutage}>
          {node.offline === 'true' || node.offline === true ? 'Restore node' : 'Add to shock set'}
        </button>
      </div>
    </div>
  );
}

const TOOLS = [
  ['pan', IconHand, 'Pan'],
  ['select', IconMarquee, 'Select area'],
  ['measure', IconRuler, 'Measure'],
  ['isochrone', IconIsochrone, 'Isochrone'],
];

export default function MapPanel({
  view,
  status,
  hasResult,
  summary,
  onSplitView,
  onFocus,
  simState,
}) {
  const [tool, setTool] = useState('pan');
  const [inspected, setInspected] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    // Close the inspector whenever the scenario is cleared.
    if (!simState.simNetwork) setInspected(null);
  }, [simState.simNetwork]);

  const handleInspect = (props) => setInspected(props);

  return (
    <div className="mapwrap">
      <MapView
        {...simState}
        onInspectNode={handleInspect}
        onMapRef={(m) => (mapRef.current = m)}
      />

      <div className="map-ui map-tools">
        <div className="toolgroup">
          {TOOLS.map(([id, Ico, title]) => (
            <button
              key={id}
              className={`btn${tool === id ? ' on' : ''}`}
              title={title}
              onClick={() => setTool(id)}
            >
              <Ico size={15} />
            </button>
          ))}
        </div>
        <div className="toolgroup">
          <button className="btn" title="Split view" onClick={onSplitView}>
            <IconSplit size={15} />
          </button>
          <button className="btn" title="Focus map" onClick={onFocus}>
            <IconExpand size={15} />
          </button>
        </div>
      </div>

      <div className="map-ui map-status">
        {status === 'loading' && (
          <div className="status-card">
            <IconSpinner size={14} />
            <span>Simulating the region day-by-day…</span>
          </div>
        )}
        {status === 'ready' && summary && (
          <div className="status-card">
            {summary.people_affected > 0 ? (
              <Badge variant="bad" dot>
                {summary.worst_area
                  ? `${summary.worst_area} worst hit`
                  : `${summary.people_affected.toLocaleString('sv-SE')} people affected`}
              </Badge>
            ) : (
              <Badge variant="ok" dot>
                Demand met across the region
              </Badge>
            )}
          </div>
        )}
        {status !== 'loading' && status !== 'ready' && (
          <div className="status-card">
            <span style={{ color: 'var(--muted-foreground)' }}>Baseline 2026 · no shock applied</span>
          </div>
        )}
      </div>

      <Legend />

      <div className="map-ui map-scale">
        <span className="scalebar" />
        <span className="mono">20 km</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span className="mono">SWEREF 99 TM</span>
      </div>

      {inspected && (
        <NodePopover
          node={inspected}
          onClose={() => setInspected(null)}
          onIsolate={() => {
            const m = mapRef.current;
            if (m && inspected.point) {
              // point is screen-space; recover lng/lat
              const ll = m.unproject([inspected.point.x, inspected.point.y]);
              m.flyTo({ center: ll, zoom: Math.max(m.getZoom(), 11) });
            }
          }}
          onToggleOutage={() => {
            simState.onToggleNode?.(inspected.id);
            setInspected(null);
          }}
        />
      )}
    </div>
  );
}
