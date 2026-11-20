import { useCallback, useEffect, useState } from 'react';
import { Badge, Button } from '../../components/ui.jsx';
import * as api from '../../api/client.js';
import { formatDate } from '../categories.js';

const STATUS_VARIANT = { pending: 'warn', approved: 'ok', rejected: 'danger' };

/** Platform admins: approve / reject self-registered accounts. */
export default function RegistrationsView({ onChanged }) {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    api
      .adminRegistrations(status)
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, [status]);
  useEffect(load, [load]);

  const decide = async (r, decision) => {
    const verb = decision === 'approve' ? 'Approve' : 'Reject';
    const note = window.prompt(`${verb} the account for ${r.display_name} <${r.email}>. Note (optional):`, '');
    if (note === null) return;
    try {
      await api.adminDecideRegistration(r.id, decision, note || null);
      load();
      onChanged(decision === 'approve' ? `${r.display_name} can now sign in.` : 'Registration rejected.');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="requests">
      <div className="row-gap">
        <h2>Account registrations</h2>
        <div className="spacer" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>
      <p className="muted">
        People who register on the sign-in page can't sign in until you approve them. Approved accounts get the
        normal user role.
      </p>
      {error && <p className="form-error">{error}</p>}
      {items &&
        (items.length === 0 ? (
          <p className="muted empty">Nothing here.</p>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Organisation</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Decision</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.display_name}</strong>
                  </td>
                  <td className="wrap">{r.email}</td>
                  <td className="wrap">{r.organization ?? '—'}</td>
                  <td className="wrap">{r.note ?? ''}</td>
                  <td>
                    <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                  </td>
                  <td>{formatDate(r.created_at)}</td>
                  <td className="wrap muted small">
                    {r.reviewed_by ? `${r.reviewed_by.display_name}: ` : ''}
                    {r.review_note ?? ''}
                  </td>
                  <td>
                    {r.status !== 'approved' && (
                      <div className="row-gap">
                        <Button size="sm" variant="primary" onClick={() => decide(r, 'approve')}>
                          Approve
                        </Button>
                        {r.status === 'pending' && (
                          <Button size="sm" variant="outline" onClick={() => decide(r, 'reject')}>
                            Reject
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </div>
  );
}
