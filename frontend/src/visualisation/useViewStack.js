import { useCallback, useEffect, useRef, useState } from 'react';
import { getVizViews } from './api.js';

const PAGE_SIZE = 10;
// Load the next page while this many loaded cards are still ahead,
// so the bottom of the stack never runs empty.
const PREFETCH_AHEAD = 3;

const INITIAL = { status: 'loading', dataset: null, views: [], total: 0, error: null };

/**
 * The views of one dataset (at the version the selection pinned), loaded page by page as the user moves through them.
 * Returns { status: 'loading' | 'ready' | 'error', dataset, views, total, error,
 *           index, next(), prev() }.
 * `error` can also be set while status is 'ready': a later page failed.
 */
export function useViewStack(datasetId, version) {
  const [data, setData] = useState(INITIAL);
  const [index, setIndex] = useState(0);
  const pending = useRef(false);
  // Bumped when the dataset changes, so answers for the old one are dropped.
  const generation = useRef(0);

  const fetchPage = useCallback(
    (offset) => {
      if (pending.current) return;
      pending.current = true;
      const gen = generation.current;
      getVizViews(datasetId, version, offset, PAGE_SIZE).then(
        (page) => {
          if (gen !== generation.current) return;
          pending.current = false;
          setData((d) => ({
            status: 'ready',
            dataset: page.dataset,
            total: page.total,
            error: null,
            views: [...d.views.slice(0, offset), ...page.views],
          }));
        },
        (error) => {
          if (gen !== generation.current) return;
          pending.current = false;
          setData((d) => ({ ...d, status: d.views.length ? 'ready' : 'error', error }));
        }
      );
    },
    [datasetId, version]
  );

  useEffect(() => {
    generation.current += 1;
    pending.current = false;
    setData(INITIAL);
    setIndex(0);
    fetchPage(0);
  }, [fetchPage]);

  const { status, views, total, error } = data;
  useEffect(() => {
    // After a failed page, wait: retrying on every render would hammer the backend.
    if (status !== 'ready' || error) return;
    if (views.length < total && index >= views.length - PREFETCH_AHEAD) fetchPage(views.length);
  }, [status, error, views.length, total, index, fetchPage]);

  const loaded = views.length;
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, Math.max(loaded - 1, 0))), [loaded]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  return { ...data, index, next, prev };
}
