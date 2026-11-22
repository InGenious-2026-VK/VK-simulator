import { useEffect, useState } from 'react';
import { getSelectionDatasets } from './api.js';
import CardStack from './CardStack.jsx';
import './visualisation.css';
import './overview.css';

/**
 * The data overview: one card stack per selected dataset, in a grid that fits
 * as many columns as the container's width allows (two on a laptop). It fills,
 * and scrolls inside, whatever container the page puts it in.
 *
 * selectionId: a Data Lake selection (POST /api/selections).
 * onLoaded: called with the backend's answer, so the page can show the
 *           skipped datasets or disable its buttons.
 */
export default function DataOverview({ selectionId, onLoaded }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });
    getSelectionDatasets(selectionId).then(
      (data) => {
        if (cancelled) return;
        setState({ status: 'ready', data, error: null });
        onLoaded?.(data, null);
      },
      (error) => {
        if (cancelled) return;
        setState({ status: 'error', data: null, error });
        onLoaded?.(null, error);
      }
    );
    return () => {
      cancelled = true;
    };
    // onLoaded is a callback from the page; a new one must not reload the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionId]);

  const datasets = state.data?.datasets ?? [];
  return (
    <div className="viz-overview">
      {state.status === 'loading' && <p className="viz-message">Loading datasets…</p>}
      {state.status === 'error' && <p className="viz-message viz-error">{state.error.message}</p>}
      {state.status === 'ready' && datasets.length === 0 && (
        <p className="viz-message">None of the selected datasets can be shown as a chart.</p>
      )}
      {datasets.length > 0 && (
        <div className="viz-overview-grid">
          {datasets.map((d) => (
            <CardStack key={d.id} datasetId={d.id} version={d.version} title={d.title} />
          ))}
        </div>
      )}
    </div>
  );
}
