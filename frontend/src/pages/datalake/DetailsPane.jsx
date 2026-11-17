import { useEffect, useState } from 'react';
import { Badge, Button } from '../../components/ui.jsx';
import { IconDownload, IconX } from '../../components/icons.jsx';
import * as api from '../../api/client.js';
import { CATEGORY_META, VISIBILITY_META, catColor, formatBytes, formatDate } from '../categories.js';

/** Right-side pane: metadata, files, preview, sharing, removal request. */
export default function DetailsPane({ datasetId, onClose, onChanged }) {
  const [ds, setDs] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [editVis, setEditVis] = useState(false);
  const [vis, setVis] = useState('private');
  const [groupId, setGroupId] = useState('');
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    let alive = true;
    setDs(null);
    setPreview(null);
    setError(null);
    setEditVis(false);
    setRemoving(false);
    api
      .getDataset(datasetId)
      .then((d) => {
        if (!alive) return;
        setDs(d);
        setVis(d.visibility);
        setGroupId(d.group?.id ?? '');
        if (d.status === 'ready') {
          api.getPreview(datasetId, { limit: 8 }).then((p) => alive && setPreview(p)).catch(() => {});
        }
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [datasetId, n]);

  useEffect(() => {
    if (editVis && !groups.length) api.listGroups().then((g) => setGroups(g.items)).catch(() => {});
  }, [editVis, groups.length]);

  const refresh = () => setN((x) => x + 1);

  const saveVisibility = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.patchDataset(ds.id, { visibility: vis, group_id: vis === 'group' ? groupId : null });
      setEditVis(false);
      refresh();
      onChanged(`Visibility changed to ${vis}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitRemoval = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.requestRemoval(ds.id, reason);
      setRemoving(false);
      setReason('');
      refresh();
      onChanged('Removal requested. A platform admin will review it.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="lake-detail" aria-label="Dataset details">
      <div className="detail-head">
        <span className="muted small">Details</span>
        <Button icon aria-label="Close details" onClick={onClose}>
          <IconX size={15} />
        </Button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {!ds && !error && <p className="muted">Loading…</p>}
      {ds && (
        <div className="detail-body">
          <div className="ds-thumb sm" style={{ '--cat': catColor(ds.category) }}>
            <span>{CATEGORY_META[ds.category]?.label ?? ds.category}</span>
          </div>
          <h2>{ds.title}</h2>
          <p>{ds.description}</p>
          {ds.status_reason && (
            <div className={`callout ${ds.status === 'invalid' ? 'danger' : 'info'}`}>{ds.status_reason}</div>
          )}
          {ds.removal_request && (
            <div className="callout warn">Removal pending — the dataset stays usable until an admin decides.</div>
          )}

          <dl className="kv">
            <dt>Owner</dt>
            <dd>{ds.owner?.display_name}</dd>
            <dt>Visibility</dt>
            <dd>
              {VISIBILITY_META[ds.visibility].icon} {VISIBILITY_META[ds.visibility].label}
              {ds.group ? ` · ${ds.group.name}` : ''}
            </dd>
            <dt>Status</dt>
            <dd>
              <Badge variant={ds.status === 'ready' ? 'ok' : ds.status === 'invalid' ? 'danger' : 'info'}>{ds.status}</Badge>
            </dd>
            <dt>Version</dt>
            <dd className="mono">v{ds.version}</dd>
            <dt>Sensitivity</dt>
            <dd>{ds.sensitivity}</dd>
            <dt>Licence</dt>
            <dd>{ds.license}</dd>
            <dt>Source</dt>
            <dd>
              {ds.source?.organization}
              {ds.source?.url && (
                <>
                  {' '}
                  · <a href={ds.source.url} target="_blank" rel="noreferrer">link</a>
                </>
              )}
            </dd>
            {ds.temporal && (
              <>
                <dt>Time span</dt>
                <dd>
                  {ds.temporal.start ?? '?'} → {ds.temporal.end ?? '?'} {ds.temporal.resolution ? `(${ds.temporal.resolution})` : ''}
                </dd>
              </>
            )}
            <dt>Simulation role</dt>
            <dd>{ds.simulation?.role ?? '—'}</dd>
            <dt>Records</dt>
            <dd className="mono">{ds.record_count ?? '—'}</dd>
            <dt>Updated</dt>
            <dd>{formatDate(ds.updated_at)}</dd>
            {ds.keywords?.length > 0 && (
              <>
                <dt>Keywords</dt>
                <dd className="tags">
                  {ds.keywords.map((k) => (
                    <span key={k} className="tag">
                      {k}
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>

          <h3 className="detail-h">Files</h3>
          <ul className="file-list">
            {ds.files.map((f) => (
              <li key={f.id}>
                <span className="mono">{f.name}</span>
                <span className="muted small">
                  {f.format} · {formatBytes(f.size_bytes)}
                  {f.record_count != null ? ` · ${f.record_count} rows` : ''}
                </span>
                <Button icon size="sm" aria-label={`Download ${f.name}`} onClick={() => api.downloadFile(ds.id, f).catch((e) => setError(e.message))}>
                  <IconDownload size={13} />
                </Button>
              </li>
            ))}
          </ul>

          {preview && preview.columns.length > 0 && (
            <>
              <h3 className="detail-h">Preview · {preview.file}</h3>
              <div className="preview-scroll">
                <table className="mini-table">
                  <thead>
                    <tr>
                      {preview.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr key={i}>
                        {r.map((v, j) => (
                          <td key={j}>{v === null ? '' : String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {ds.permissions.can_edit && (
            <>
              <h3 className="detail-h">Sharing</h3>
              {editVis ? (
                <div className="edit-vis">
                  <select value={vis} onChange={(e) => setVis(e.target.value)}>
                    <option value="private">🔒 Private</option>
                    <option value="group">👥 Group</option>
                    <option value="public" disabled={ds.sensitivity === 'restricted'}>
                      🌐 Public{ds.sensitivity === 'restricted' ? ' (not allowed: restricted)' : ''}
                    </option>
                  </select>
                  {vis === 'group' && (
                    <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                      <option value="">Choose a group…</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="row-gap">
                    <Button size="sm" variant="primary" disabled={busy || (vis === 'group' && !groupId)} onClick={saveVisibility}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditVis(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditVis(true)}>
                  Change visibility
                </Button>
              )}
            </>
          )}

          {ds.permissions.can_request_removal && (
            <>
              <h3 className="detail-h">Removal</h3>
              {removing ? (
                <div className="edit-vis">
                  <textarea
                    rows={3}
                    placeholder="Why should this dataset be removed? (min. 5 characters)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="row-gap">
                    <Button size="sm" variant="danger" disabled={busy || reason.trim().length < 5} onClick={submitRemoval}>
                      Send request
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRemoving(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="danger-text" onClick={() => setRemoving(true)}>
                  Request removal
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
