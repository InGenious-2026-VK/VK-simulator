import { useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader.jsx';
import { Button } from '../components/ui.jsx';
import DataOverview from '../visualisation/DataOverview.jsx';

const REASONS = {
  not_chartable: 'not in a chart format',
  removed: 'removed',
  access_revoked: 'no longer shared with you',
};

/**
 * Window 3, between Data Lake and Visualization: the selected datasets as
 * card stacks of charts (src/visualisation/). Same ?selection= as the windows
 * around it, so Back and To Visualization keep the selection.
 */
export default function OverviewPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const selectionId = params.get('selection');
  const [result, setResult] = useState({ data: null, error: null });
  const onLoaded = useCallback((data, error) => setResult({ data, error }), []);

  if (!selectionId) {
    return (
      <div className="page">
        <SiteHeader />
        <div className="empty center-msg">
          <p>No datasets selected.</p>
          <Link className="btn btn-primary" to="/datalake">
            Go to the data lake
          </Link>
        </div>
      </div>
    );
  }

  const skipped = result.data?.skipped ?? [];
  return (
    <div className="page">
      <SiteHeader />
      <div className="viz-head">
        <div className="viz-head-row">
          <Link to={`/datalake?selection=${selectionId}`} className="back-link">
            ← Back to data lake
          </Link>
          <h1>Data overview</h1>
          <div className="spacer" />
          <Button
            variant="primary"
            disabled={Boolean(result.error)}
            onClick={() => navigate(`/visualize?selection=${selectionId}`)}
          >
            To Visualization →
          </Button>
        </div>
      </div>

      <main className="overview-main">
        {result.error && (
          <div className="callout danger">
            {result.error.status === 404 ? 'This selection no longer exists or has expired.' : result.error.message}{' '}
            <Link to="/datalake">Select datasets again</Link>
          </div>
        )}
        {skipped.length > 0 && (
          <div className="callout warn">
            Not shown here (they are still in the selection for the next windows):{' '}
            {skipped.map((s) => `${s.title ?? s.id} (${REASONS[s.reason] ?? s.reason})`).join(', ')}.
          </div>
        )}
        {!result.error && <DataOverview selectionId={selectionId} onLoaded={onLoaded} />}
      </main>
    </div>
  );
}
