import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader.jsx';
import Modal from '../components/Modal.jsx';
import GroupMembers from '../components/GroupMembers.jsx';
import { Badge, Button } from '../components/ui.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import * as api from '../api/client.js';
import { formatBytes, formatDate } from './categories.js';
import RegistrationsView from './datalake/RegistrationsView.jsx';
import { GroupEditDialog } from './datalake/MyGroupsView.jsx';

const TABS = [
  { id: 'users', label: 'Users' },
  { id: 'groups', label: 'Groups' },
  { id: 'registrations', label: 'Registrations' },
];
const GB = 1024 ** 3;

function Err({ error }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}

function statusBadge(u) {
  if (u.disabled) return <Badge variant="danger">disabled</Badge>;
  if (u.status === 'pending') return <Badge variant="warn">pending</Badge>;
  if (u.status === 'rejected') return <Badge variant="danger">rejected</Badge>;
  return <Badge variant="ok">active</Badge>;
}

// ---------------------------------------------------------------- users

function UserDialog({ user, onClose, onSaved }) {
  const editing = Boolean(user);
  const [f, setF] = useState({
    display_name: user?.display_name ?? '',
    email: user?.email ?? '',
    organization: user?.organization ?? '',
    role: user?.role ?? 'user',
    quota_gb: user ? String(Math.round((user.storage?.quota_bytes ?? 0) / GB)) : '10',
    disabled: user?.disabled ?? false,
    password: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      display_name: f.display_name.trim(),
      email: f.email.trim(),
      organization: f.organization.trim() || null,
      role: f.role,
      quota_bytes: Math.round(Number(f.quota_gb) * GB),
    };
    if (f.password) body.password = f.password;
    try {
      if (editing) {
        await api.adminUpdateUser(user.id, { ...body, disabled: f.disabled });
        onSaved(`${body.display_name} updated.`);
      } else {
        const out = await api.adminCreateUser(body);
        onSaved(
          out.initial_password
            ? `${out.display_name} created. Initial password: ${out.initial_password}`
            : `${out.display_name} created.`,
          Boolean(out.initial_password)
        );
      }
    } catch (err) {
      setError(err.status === 422 ? 'Check the form: a valid email and a password of 8–72 characters.' : err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? `Edit ${user.display_name}` : 'New user'} onClose={onClose}>
      <form className="form-stack" onSubmit={save}>
        <label className="field">
          <span>Full name</span>
          <input value={f.display_name} onChange={set('display_name')} required maxLength={200} autoFocus />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={f.email} onChange={set('email')} required />
        </label>
        <label className="field">
          <span>
            Organisation <em className="muted">(optional)</em>
          </span>
          <input value={f.organization} onChange={set('organization')} maxLength={200} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Role</span>
            <select value={f.role} onChange={set('role')}>
              <option value="user">User</option>
              <option value="admin">Platform admin</option>
            </select>
          </label>
          <label className="field">
            <span>Storage quota (GB)</span>
            <input type="number" min="0" step="1" value={f.quota_gb} onChange={set('quota_gb')} required />
          </label>
        </div>
        <label className="field">
          <span>
            {editing ? 'New password' : 'Password'}{' '}
            <em className="muted">{editing ? '(leave empty to keep)' : '(leave empty to generate one)'}</em>
          </span>
          <input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} minLength={8} maxLength={72} />
        </label>
        {editing && (
          <label className="check">
            <input type="checkbox" checked={f.disabled} onChange={set('disabled')} /> Disabled (can't sign in)
          </label>
        )}
        <Err error={error} />
        <div className="modal-foot">
          <div className="spacer" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {editing ? 'Save' : 'Create user'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Add / remove one person's group memberships. */
function UserGroupsDialog({ user, onClose, onChanged }) {
  const [memberships, setMemberships] = useState(user.groups ?? []);
  const [allGroups, setAllGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [groups, users] = await Promise.all([api.listGroups(), api.adminListUsers({ q: user.email })]);
    setAllGroups(groups.items);
    const me = users.items.find((u) => u.id === user.id);
    if (me) setMemberships(me.groups);
  }, [user.id, user.email]);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);

  const run = async (fn, msg) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      onChanged(msg);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const available = allGroups.filter((g) => !memberships.some((m) => m.id === g.id));

  return (
    <Modal title={`Groups · ${user.display_name}`} onClose={onClose}>
      {memberships.length === 0 ? (
        <p className="muted">Not in any group.</p>
      ) : (
        <table className="ds-table plain">
          <tbody>
            {memberships.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.name}</strong>
                </td>
                <td>
                  <select
                    value={m.role}
                    disabled={busy}
                    aria-label={`Role in ${m.name}`}
                    onChange={(e) => run(() => api.setGroupMemberRole(m.id, user.id, e.target.value), 'Role updated.')}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Group admin</option>
                  </select>
                </td>
                <td className="actions">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(() => api.removeGroupMember(m.id, user.id), `Removed from ${m.name}.`)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {user.status === 'active' ? (
        <form
          className="member-add"
          onSubmit={(e) => {
            e.preventDefault();
            const g = allGroups.find((x) => x.id === groupId);
            run(() => api.addGroupMember(groupId, { user_id: user.id, role }), `Added to ${g?.name}.`).then(() =>
              setGroupId('')
            );
          }}
        >
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Group" required>
            <option value="">Add to group…</option>
            {available.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            <option value="member">Member</option>
            <option value="admin">Group admin</option>
          </select>
          <Button variant="primary" type="submit" disabled={busy || !groupId}>
            Add
          </Button>
        </form>
      ) : (
        <p className="muted small">Approve this account before adding it to groups.</p>
      )}
      <Err error={error} />
    </Modal>
  );
}

function DeleteUserDialog({ user, users, onClose, onDeleted }) {
  const [needsTransfer, setNeedsTransfer] = useState(null); // dataset count
  const [heir, setHeir] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.adminDeleteUser(user.id, heir || undefined);
      onDeleted(`${user.display_name} deleted.`);
    } catch (e) {
      if (e.code === 'user_has_datasets') setNeedsTransfer(e.details?.datasets ?? '?');
      else setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Delete ${user.display_name}?`}
      onClose={onClose}
      footer={
        <>
          <div className="spacer" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy || (needsTransfer !== null && !heir)} onClick={remove}>
            Delete user
          </Button>
        </>
      }
    >
      <p>
        This permanently deletes <strong>{user.email}</strong> and removes them from all groups. To keep the account
        but block sign-in, edit it and tick <em>Disabled</em> instead.
      </p>
      {needsTransfer !== null && (
        <div className="callout warn">
          <p>
            {user.display_name} owns {needsTransfer} dataset(s). Choose who takes them over:
          </p>
          <select value={heir} onChange={(e) => setHeir(e.target.value)} aria-label="Transfer datasets to">
            <option value="">Select a user…</option>
            {users
              .filter((u) => u.id !== user.id && u.status === 'active')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name} · {u.email}
                </option>
              ))}
          </select>
        </div>
      )}
      <Err error={error} />
    </Modal>
  );
}

function UsersTab({ notify }) {
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind, user }

  const load = useCallback(() => {
    api
      .adminListUsers({ q: q.trim() || undefined, status: status || undefined })
      .then((d) => setUsers(d.items))
      .catch((e) => setError(e.message));
  }, [q, status]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const done = (msg, sticky) => {
    setDialog(null);
    load();
    notify(msg, sticky);
  };

  return (
    <div className="requests">
      <div className="row-gap">
        <h2>Users</h2>
        <div className="spacer" />
        <input
          className="admin-search"
          type="search"
          placeholder="Search name, email or organisation…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search users"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
        <Button variant="primary" onClick={() => setDialog({ kind: 'edit', user: null })}>
          New user
        </Button>
      </div>
      <Err error={error} />
      {users &&
        (users.length === 0 ? (
          <p className="muted empty">No users match.</p>
        ) : (
          <div className="table-scroll">
            <table className="ds-table plain">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Organisation</th>
                  <th>Role</th>
                  <th>Groups</th>
                  <th>Storage</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.display_name}</strong>
                      {u.id === me.id && <span className="muted"> (you)</span>}
                    </td>
                    <td className="wrap">{u.email}</td>
                    <td className="wrap">{u.organization ?? '—'}</td>
                    <td>{u.role === 'admin' ? <Badge variant="info">admin</Badge> : 'user'}</td>
                    <td className="wrap small">{u.groups.length ? u.groups.map((g) => g.name).join(', ') : '—'}</td>
                    <td className="mono small">
                      {formatBytes(u.storage?.used_bytes ?? 0)} / {formatBytes(u.storage?.quota_bytes ?? 0)}
                    </td>
                    <td>{statusBadge(u)}</td>
                    <td className="actions">
                      <div className="row-gap nowrap">
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'edit', user: u })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'groups', user: u })}>
                          Groups
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={u.id === me.id}
                          title={u.id === me.id ? "You can't delete yourself" : undefined}
                          onClick={() => setDialog({ kind: 'delete', user: u })}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {dialog?.kind === 'edit' && <UserDialog user={dialog.user} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === 'groups' && (
        <UserGroupsDialog
          user={dialog.user}
          onClose={() => {
            setDialog(null);
            load();
          }}
          onChanged={(msg) => notify(msg)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteUserDialog user={dialog.user} users={users ?? []} onClose={() => setDialog(null)} onDeleted={done} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- groups

function GroupsTab({ notify }) {
  const { user: me, reloadUser } = useAuth();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind, group }

  const load = useCallback(() => {
    api
      .listGroups()
      .then((d) => setGroups(d.items))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const changed = (msg) => {
    load();
    reloadUser().catch(() => {});
    if (msg) notify(msg);
  };

  const remove = async (g) => {
    if (
      !window.confirm(
        `Delete the group “${g.name}”? Its ${g.member_count} member(s) are removed from it, and datasets shared with it become private to their owners.`
      )
    )
      return;
    try {
      await api.adminDeleteGroup(g.id);
      changed(`Group “${g.name}” deleted.`);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="requests">
      <div className="row-gap">
        <h2>Groups</h2>
        <div className="spacer" />
        <Button variant="primary" onClick={() => setDialog({ kind: 'edit', group: null })}>
          New group
        </Button>
      </div>
      <p className="muted">
        Members see datasets shared with the group. Group admins can manage the group's members themselves from Data
        Lake → My groups.
      </p>
      <Err error={error} />
      {groups &&
        (groups.length === 0 ? (
          <p className="muted empty">No groups yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="ds-table plain">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Members</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <strong>{g.name}</strong>
                    </td>
                    <td className="wrap muted">{g.description || '—'}</td>
                    <td>{g.member_count}</td>
                    <td className="actions">
                      <div className="row-gap nowrap">
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'members', group: g })}>
                          Members
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'edit', group: g })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => remove(g)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {dialog?.kind === 'edit' && (
        <GroupEditDialog
          group={dialog.group}
          onClose={() => setDialog(null)}
          onSaved={(g) => {
            setDialog(null);
            changed(dialog.group ? 'Group updated.' : `Group “${g.name}” created. Add members next.`);
          }}
        />
      )}
      {dialog?.kind === 'members' && (
        <Modal title={`Members · ${dialog.group.name}`} wide onClose={() => setDialog(null)}>
          <GroupMembers group={dialog.group} currentUserId={me.id} canManage onChanged={changed} />
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- page

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('users');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast || toast.sticky) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  if (user.role !== 'admin') return <Navigate to="/datalake" replace />;
  const notify = (text, sticky = false) => text && setToast({ text, sticky });

  return (
    <div className="page page-app">
      <SiteHeader />
      <div className="lake">
        <aside className="lake-side">
          <nav className="lake-views" aria-label="Admin sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
        </aside>
        <section className="lake-main">
          {tab === 'users' && <UsersTab notify={notify} />}
          {tab === 'groups' && <GroupsTab notify={notify} />}
          {tab === 'registrations' && <RegistrationsView onChanged={notify} />}
        </section>
      </div>
      {toast && (
        <div className="toast toast-ok" role="status">
          {toast.text}
          {toast.sticky && (
            <button type="button" className="toast-close" onClick={() => setToast(null)} aria-label="Dismiss">
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
