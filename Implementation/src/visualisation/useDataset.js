import { useEffect, useState } from 'react';
import { getVizDataset } from './api.js';

/**
 * Load one dataset from the backend.
 * Returns { status: 'loading' | 'ready' | 'error', dataset, error }.
 */
export function useDataset(id) {
  const [state, setState] = useState({ status: 'loading', dataset: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', dataset: null, error: null });
    getVizDataset(id).then(
      (dataset) => !cancelled && setState({ status: 'ready', dataset, error: null }),
      (error) => !cancelled && setState({ status: 'error', dataset: null, error })
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
