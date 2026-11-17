import { useEffect, useState } from 'react';
import { listVizDatasets } from './api.js';
import CardStack from './CardStack.jsx';
import './visualisation.css';
import './overview.css';

/**
 * The data overview: one card stack per dataset in the lake, in a grid that
 * fits as many columns as the container's width allows (two on a laptop).
 * Like VisualisationPanel it fills, and scrolls inside, whatever container
 * the host UI puts it in.
 */
export default function DataOverview() {
  const [state, setState] = useState({ status: 'loading', datasets: [], error: null });

  useEffect(() => {
    let cancelled = false;
    listVizDatasets().then(
      (datasets) => !cancelled && setState({ status: 'ready', datasets, error: null }),
      (error) => !cancelled && setState({ status: 'error', datasets: [], error })
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="viz-overview">
      {state.status === 'loading' && <p className="viz-message">Loading datasets…</p>}
      {state.status === 'error' && <p className="viz-message viz-error">{state.error.message}</p>}
      {state.status === 'ready' && state.datasets.length === 0 && (
        <p className="viz-message">No datasets imported yet.</p>
      )}
      {state.status === 'ready' && state.datasets.length > 0 && (
        <div className="viz-overview-grid">
          {state.datasets.map((d) => (
            <CardStack key={d.id} datasetId={d.id} />
          ))}
        </div>
      )}
    </div>
  );
}
