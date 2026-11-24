import { useCallback, useEffect, useState } from 'react';
import { Badge, Button } from './ui.jsx';
import * as api from '../api/client.js';
import { formatDate } from '../pages/categories.js';

/**
 * Members of one group. Group admins and platform admins (`canManage`) can add
 * people by email, change roles and remove members; everyone can leave.
 */
export default function GroupMembers({ group, currentUserId, canManage, onChanged }) {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .listGroupMembers(group.id)
      .then((d) => setMembers(d.items))
      .catch((e) => setError(e.message));
  }, [group.id]);
  useEffect(load, [load]);

  const run = async (fn, msg) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      load();
      onChanged?.(msg);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const ok = await run(
      () => api.addGroupMember(group.id, { email: email.trim(), role }),
      `${email.trim()} added to ${group.name}.`
    );
    if (ok) {
      setEmail('');
      setRole('member');
    }
  };

  const remove = (m) => {
    const self = m.user.id === currentUserId;
    const q = self ? `Leave “${group.name}”?` : `Remove ${m.user.display_name} from “${group.name}”?`;
    if (!window.confirm(q)) return;
    run(
      () => api.removeGroupMember(group.id, m.user.id),
      self ? `You left ${group.name}.` : `${m.user.display_name} removed.`
    );
  };

  return (
    <div className="group-members">
      {canManage && (
        <form className="member-add" onSubmit={add}>
          <input
            type="email"
            placeholder="Add a person by email…"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="Email of the person to add"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            <option value="member">Member</option>
            <option value="admin">Group admin</option>
          </select>
          <Button variant="primary" type="submit" disabled={busy || !email.trim()}>
            Add
          </Button>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {members &&
        (members.length === 0 ? (
          <p className="muted">No members yet.</p>
        ) : (
          <table className="ds-table plain">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const self = m.user.id === currentUserId;
                return (
                  <tr key={m.user.id}>
                    <td>
                      <strong>{m.user.display_name}</strong>
                      {self && <span className="muted"> (you)</span>}
                    </td>
                    <td className="wrap">{m.user.email}</td>
                    <td>
                      {canManage ? (
                        <select
                          value={m.role}
                          disabled={busy}
                          aria-label={`Role of ${m.user.display_name}`}
                          onChange={(e) =>
                            run(
                              () => api.setGroupMemberRole(group.id, m.user.id, e.target.value),
                              `${m.user.display_name} is now ${e.target.value === 'admin' ? 'a group admin' : 'a member'}.`
                            )
                          }
                        >
                          <option value="member">Member</option>
                          <option value="admin">Group admin</option>
                        </select>
                      ) : (
                        <Badge variant={m.role === 'admin' ? 'info' : ''}>{m.role === 'admin' ? 'group admin' : 'member'}</Badge>
                      )}
                    </td>
                    <td>{formatDate(m.added_at)}</td>
                    <td className="actions">
                      {(canManage || self) && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => remove(m)}>
                          {self ? 'Leave' : 'Remove'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
    </div>
  );
}
