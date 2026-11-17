import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SimulationWorkspace from '../components/SimulationWorkspace.jsx';
import { defineLayer } from '../layers/defineLayer.js';
import { getGeometryUrl, getSimulationContext } from '../api/client.js';
import { propsTableHtml } from '../lib/escape.js';
import { catColor } from './categories.js';

const EXTRA = ['#0d9488', '#f97316', '#1e4e6e', '#eab308', '#8b5cf6', '#e7000b', '#0ea5e9'];

/** Each selected dataset with geometry becomes a map layer plugin. */
function datasetPlugins(context) {
  const used = new Set();
  return (context?.map_layers ?? []).map((l, i) => {
    let color = catColor(l.category);
    if (used.has(color)) color = EXTRA.find((c) => !used.has(c)) ?? EXTRA[i % EXTRA.length];
    used.add(color);
    return defineLayer({
      id: `ds-${l.dataset_id}`,
      label: l.title,
      description: `Selected dataset · role: ${l.role}`,
      color,
      category: 'Selected datasets',
      order: 500 + i,
      defaultVisible: true,
      loadData: () => getGeometryUrl(`${l.geometry_url}?simplify=0.0002`),
      renderPopup: (feature) => propsTableHtml(l.title, feature.properties),
    });
  });
}

/** Window 4. Without `?selection=` it runs on the synthetic baseline, as before. */
export default function SimulationPage() {
  const [params] = useSearchParams();
  const selectionId = params.get('selection');
  const [context, setContext] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectionId) return undefined;
    let alive = true;
    setContext(null);
    setError(null);
    getSimulationContext(selectionId)
      .then((c) => alive && setContext(c))
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [selectionId]);

  const plugins = useMemo(() => datasetPlugins(context), [context]);

  if (selectionId && error) {
    return (
      <div className="page">
        <div className="empty center-msg">
          <p>
            {error.status === 404
              ? 'This selection no longer exists or has expired.'
              : `The selected datasets could not be prepared for simulation: ${error.message}`}
          </p>
          <Link className="btn btn-primary" to="/datalake">
            Back to the data lake
          </Link>
        </div>
      </div>
    );
  }
  if (selectionId && !context) {
    return (
      <div className="page-loading">
        <span className="spinner" /> Building the simulation network from your datasets…
      </div>
    );
  }
  return (
    <SimulationWorkspace
      key={selectionId ?? 'baseline'}
      selectionId={selectionId}
      context={context}
      datasetPlugins={plugins}
    />
  );
}
