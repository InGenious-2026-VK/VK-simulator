import { useCallback, useEffect, useState } from 'react';
import { Badge, Button } from '../../components/ui.jsx';
import GroupMembers from '../../components/GroupMembers.jsx';
import Modal from '../../components/Modal.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import * as api from '../../api/client.js';

/** Edit a group's name and description. */
export function GroupEditDialog({ group, onClose, onSaved }) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), description: description.trim() };
      const out = group ? await api.updateGroup(group.id, body) : await api.adminCreateGroup(body);
      onSaved(out);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={group ? `Edit “${group.name}”` : 'New group'} onClose={onClose}>
      <form className="form-stack" onSubmit={save}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={200} autoFocus />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-foot">
          <div className="spacer" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {group ? 'Save' : 'Create group'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Data Lake → "My groups": the groups the user belongs to, and their members. */
export default function MyGroupsView({ onChanged }) {
  const { user, reloadUser } = useAuth();
  const [groups, setGroups] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api
      .listGroups()
      .then((d) => {
        // platform admins see every group here; keep it to their own memberships
        const mine = user.role === 'admin' ? d.items.filter((g) => g.role) : d.items;
        setGroups(mine);
        setSelectedId((id) => (mine.some((g) => g.id === id) ? id : mine[0]?.id ?? null));
      })
      .catch((e) => setError(e.message));
  }, [user.role]);
  useEffect(load, [load]);

  const selected = groups?.find((g) => g.id === selectedId);
  const canManage = selected && (selected.role === 'admin' || user.role === 'admin');

  const changed = (msg) => {
    load();
    reloadUser().catch(() => {});
    onChanged?.(msg);
  };

  return (
    <div className="requests">
      <h2>My groups</h2>
      <p className="muted">
        Datasets shared with a group are visible to all its members. Group admins add and remove members; anyone can
        leave a group.
        {user.role === 'admin' && ' Manage every group from the Admin page.'}
      </p>
      {error && <p className="form-error">{error}</p>}
      {groups && groups.length === 0 && (
        <p className="muted empty">You aren't in any group yet. A group admin or platform admin can add you.</p>
      )}
      {groups && groups.length > 0 && (
        <div className="groups-layout">
          <ul className="group-list">
            {groups.map((g) => (
              <li key={g.id}>
                <button type="button" className={g.id === selectedId ? 'on' : ''} onClick={() => setSelectedId(g.id)}>
                  <strong>{g.name}</strong>
                  <span className="muted small">
                    {g.member_count} member{g.member_count === 1 ? '' : 's'}
                    {g.role === 'admin' && ' · you are admin'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <section className="group-detail">
              <div className="row-gap">
                <h3>{selected.name}</h3>
                <Badge variant={selected.role === 'admin' ? 'info' : ''}>
                  {selected.role === 'admin' ? 'group admin' : 'member'}
                </Badge>
                <div className="spacer" />
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    Edit group
                  </Button>
                )}
              </div>
              {selected.description && <p className="muted">{selected.description}</p>}
              <GroupMembers key={selected.id} group={selected} currentUserId={user.id} canManage={canManage} onChanged={changed} />
            </section>
          )}
        </div>
      )}
      {editing && selected && (
        <GroupEditDialog
          group={selected}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            changed('Group updated.');
          }}
        />
      )}
    </div>
  );
}
