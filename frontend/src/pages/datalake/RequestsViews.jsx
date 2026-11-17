import { useCallback, useEffect, useState } from 'react';
import { Badge, Button } from '../../components/ui.jsx';
import * as api from '../../api/client.js';
import { formatDate } from '../categories.js';

const STATUS_VARIANT = { pending: 'warn', approved: 'ok', rejected: 'danger', cancelled: '' };

function RequestTable({ items, actions }) {
  if (!items.length) return <p className="muted empty">Nothing here.</p>;
  return (
    <table className="ds-table">
      <thead>
        <tr>
          <th>Dataset</th>
          <th>Requested by</th>
          <th>Reason</th>
          <th>Status</th>
          <th>Requested</th>
          <th>Decision</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {items.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.dataset.title}</strong>
            </td>
            <td>{r.requested_by?.display_name}</td>
            <td className="wrap">{r.reason}</td>
            <td>
              <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
            </td>
            <td>{formatDate(r.created_at)}</td>
            <td className="wrap muted small">
              {r.decided_by ? `${r.decided_by.display_name}: ` : ''}
              {r.decision_note ?? ''}
            </td>
            <td>{actions(r)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The signed-in user's own removal requests. */
export function RemovalRequestsView({ onChanged }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    api
      .listRemovalRequests({ page_size: 100 })
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="requests">
      <h2>Your removal requests</h2>
      <p className="muted">
        You can only request removal of datasets you own. A platform admin approves or rejects each
        request; until then the dataset stays available.
      </p>
      {error && <p className="form-error">{error}</p>}
      {items && (
        <RequestTable
          items={items}
          actions={(r) =>
            r.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await api.cancelRemovalRequest(r.id).catch((e) => setError(e.message));
                  load();
                  onChanged('Removal request cancelled.');
                }}
              >
                Cancel
              </Button>
            )
          }
        />
      )}
    </div>
  );
}

/** Platform admins: approve / reject pending requests. */
export function AdminQueueView({ onChanged }) {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    api
      .adminRemovalQueue(status)
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, [status]);
  useEffect(load, [load]);

  const decide = async (r, decision) => {
    const note = window.prompt(`${decision === 'approve' ? 'Approve' : 'Reject'} removal of “${r.dataset.title}”. Note (optional):`, '');
    if (note === null) return;
    try {
      await api.adminDecide(r.id, decision, note || null);
      load();
      onChanged(`Request ${decision === 'approve' ? 'approved — dataset removed' : 'rejected'}.`);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="requests">
      <div className="row-gap">
        <h2>Removal request queue</h2>
        <div className="spacer" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>
      {error && <p className="form-error">{error}</p>}
      {items && (
        <RequestTable
          items={items}
          actions={(r) =>
            r.status === 'pending' && (
              <div className="row-gap">
                <Button size="sm" variant="danger" onClick={() => decide(r, 'approve')}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(r, 'reject')}>
                  Reject
                </Button>
              </div>
            )
          }
        />
      )}
    </div>
  );
}
