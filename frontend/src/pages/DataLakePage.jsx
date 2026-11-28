import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader.jsx';
import { Badge, Button, Progress } from '../components/ui.jsx';
import { IconGrid, IconLayers, IconPlus, IconSearch, IconX } from '../components/icons.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import * as api from '../api/client.js';
import { CATEGORIES, CATEGORY_META, FORMATS, VISIBILITY_META, catColor, formatBytes, formatDate } from './categories.js';
import UploadDialog from './datalake/UploadDialog.jsx';
import DetailsPane from './datalake/DetailsPane.jsx';
import { AdminQueueView, RemovalRequestsView } from './datalake/RequestsViews.jsx';
import MyGroupsView from './datalake/MyGroupsView.jsx';
import { formatFeedback, formatRatings, SCORES_HELP } from './datalake/scores.js';

const VIEWS = [
  { id: 'all', label: 'All datasets' },
  { id: 'mine', label: 'My datasets' },
  { id: 'groups', label: 'Shared with my groups' },
  { id: 'public', label: 'Public' },
  { id: 'mygroups', label: 'My groups' },
  { id: 'removals', label: 'Removal requests' },
];
const SORTS = [
  { value: '-updated_at', label: 'Last updated' },
  { value: 'title', label: 'Title A–Z' },
  { value: '-size_bytes', label: 'Largest' },
];
const PAGE_SIZE = 24;

function statusBadge(ds) {
  if (ds.removal_request?.status === 'pending') return <Badge variant="warn">removal pending</Badge>;
  if (ds.status === 'processing' || ds.status === 'uploading') return <Badge variant="info">processing…</Badge>;
  if (ds.status === 'invalid') return <Badge variant="danger">invalid</Badge>;
  return null;
}

function VisibilityBadge({ ds }) {
  const v = VISIBILITY_META[ds.visibility];
  return (
    <span className={`vis vis-${ds.visibility}`} title={v.hint}>
      <span aria-hidden="true">{v.icon}</span> {ds.visibility === 'group' && ds.group ? ds.group.name : v.label}
    </span>
  );
}

function FilterChip({ label, options, values, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  const active = values.length > 0;
  return (
    <div className="chip-wrap" ref={ref}>
      <button type="button" className={`chip${active ? ' on' : ''}`} onClick={() => setOpen((o) => !o)}>
        {label}
        {active ? ` · ${values.length}` : ''} ▾
      </button>
      {open && (
        <div className="menu chip-menu">
          {options.map((o) => (
            <label key={o.value} className="check-row">
              <input
                type="checkbox"
                checked={values.includes(o.value)}
                onChange={() =>
                  onChange(values.includes(o.value) ? values.filter((v) => v !== o.value) : [...values, o.value])
                }
              />
              {o.color && <i className="dot" style={{ background: o.color }} />}
              {o.label}
            </label>
          ))}
          {active && (
            <button type="button" className="link-btn" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DataLakePage() {
  const { user, reloadUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [view, setView] = useState('all');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [category, setCategory] = useState([]);
  const [format, setFormat] = useState([]);
  const [visibility, setVisibility] = useState([]);
  const [sort, setSort] = useState('-updated_at');
  const [layout, setLayout] = useState('grid');
  const [page, setPage] = useState(1);

  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => new Map());
  const lastClicked = useRef(null);
  const [detailId, setDetailId] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setPage(1), [view, debouncedQ, category, format, visibility, sort]);

  // Coming back from Visualization keeps the selection.
  useEffect(() => {
    const sid = params.get('selection');
    if (!sid) return;
    api
      .getSelection(sid)
      .then((sel) => setSelected(new Map(sel.datasets.map((d) => [d.id, { ...d, status: 'ready' }]))))
      .catch(() => {});
  }, [params]);

  const isListView = !['removals', 'admin', 'mygroups'].includes(view);

  useEffect(() => {
    if (!isListView) return undefined;
    let alive = true;
    setLoading(true);
    api
      .listDatasets({
        scope: view,
        q: debouncedQ,
        category,
        format,
        visibility,
        sort,
        page,
        page_size: PAGE_SIZE,
      })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [isListView, view, debouncedQ, category, format, visibility, sort, page, reloadKey]);

  // Poll while something is still being ingested.
  const processing = data.items.some((d) => d.status === 'processing' || d.status === 'uploading');
  useEffect(() => {
    if (!processing) return undefined;
    const t = setTimeout(reload, 1500);
    return () => clearTimeout(t);
  }, [processing, data, reload]);

  // Keep selected entries' status fresh (e.g. processing → ready).
  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const d of data.items) {
        if (next.has(d.id) && next.get(d.id).status !== d.status) {
          next.set(d.id, d);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [data]);

  const toggleSelect = (ds, index, shift) => {
    if (ds.status !== 'ready') return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (shift && lastClicked.current != null) {
        const [a, b] = [lastClicked.current, index].sort((x, y) => x - y);
        const turnOn = !prev.has(ds.id);
        for (const d of data.items.slice(a, b + 1)) {
          if (d.status !== 'ready') continue;
          if (turnOn) next.set(d.id, d);
          else next.delete(d.id);
        }
      } else if (next.has(ds.id)) next.delete(ds.id);
      else next.set(ds.id, ds);
      return next;
    });
    lastClicked.current = index;
  };

  const toVisualization = async () => {
    setBusy(true);
    try {
      const sel = await api.createSelection([...selected.keys()]);
      navigate(`/visualize?selection=${sel.id}`);
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
      setBusy(false);
    }
  };

  const onUploaded = (ds) => {
    setUploadOpen(false);
    setToast({ kind: 'ok', text: `“${ds.title}” uploaded — processing…` });
    setView((v) => (v === 'all' || v === 'mine' ? v : 'mine'));
    reload();
    reloadUser().catch(() => {});
  };

  const onDatasetChanged = (msg) => {
    if (msg) setToast({ kind: 'ok', text: msg });
    reload();
  };

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const views = useMemo(
    () =>
      user.role === 'admin'
        ? [...VIEWS, { id: 'admin', label: 'Admin · removal queue' }]
        : VIEWS,
    [user.role]
  );
  const storage = user.storage ?? { used_bytes: 0, quota_bytes: 1 };
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="page page-app">
      <SiteHeader>
        <div className="search">
          <IconSearch size={15} />
          <input
            type="search"
            placeholder="Search datasets by title, description or keyword…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search datasets"
          />
        </div>
      </SiteHeader>

      <div className="lake">
        <aside className="lake-side">
          <Button variant="primary" className="new-btn" onClick={() => setUploadOpen(true)}>
            <IconPlus size={15} /> New dataset
          </Button>
          <nav className="lake-views" aria-label="Data lake views">
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                className={view === v.id ? 'on' : ''}
                onClick={() => {
                  setView(v.id);
                  setDetailId(null);
                }}
              >
                {v.label}
              </button>
            ))}
          </nav>
          <div className="quota">
            <span className="muted small">Storage used</span>
            <Progress value={(100 * storage.used_bytes) / storage.quota_bytes} thin />
            <span className="small mono">
              {formatBytes(storage.used_bytes)} / {formatBytes(storage.quota_bytes)}
            </span>
          </div>
        </aside>

        <section className="lake-main">
          {isListView ? (
            <>
              <div className="lake-toolbar">
                <FilterChip
                  label="Category"
                  values={category}
                  onChange={setCategory}
                  options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label, color: catColor(c) }))}
                />
                <FilterChip
                  label="Format"
                  values={format}
                  onChange={setFormat}
                  options={FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))}
                />
                <FilterChip
                  label="Visibility"
                  values={visibility}
                  onChange={setVisibility}
                  options={Object.entries(VISIBILITY_META).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))}
                />
                <label className="sort">
                  <span className="muted small">Sort</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value)}>
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="spacer" />
                <span className="muted small">
                  {loading ? 'Loading…' : `${data.total} dataset${data.total === 1 ? '' : 's'}`}
                </span>
                <div className="seg" role="group" aria-label="Layout">
                  <button type="button" className={layout === 'grid' ? 'on' : ''} onClick={() => setLayout('grid')} aria-label="Grid">
                    <IconGrid size={14} />
                  </button>
                  <button type="button" className={layout === 'list' ? 'on' : ''} onClick={() => setLayout('list')} aria-label="List">
                    <IconLayers size={14} />
                  </button>
                </div>
              </div>

              {error && <p className="form-error">Could not load datasets: {error}</p>}
              {!loading && !error && data.items.length === 0 && (
                <div className="empty">
                  <p>No datasets here yet.</p>
                  <Button variant="outline" onClick={() => setUploadOpen(true)}>
                    <IconPlus size={14} /> Upload a dataset
                  </Button>
                </div>
              )}

              {layout === 'grid' ? (
                <div className="ds-grid">
                  {data.items.map((ds, i) => (
                    <article
                      key={ds.id}
                      className={`ds-card${selected.has(ds.id) ? ' selected' : ''}${detailId === ds.id ? ' active' : ''}`}
                      onClick={() => setDetailId(ds.id)}
                    >
                      <label className="ds-check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(ds.id)}
                          disabled={ds.status !== 'ready'}
                          onChange={(e) => toggleSelect(ds, i, e.nativeEvent.shiftKey)}
                          aria-label={`Select ${ds.title}`}
                        />
                      </label>
                      <div className="ds-thumb" style={{ '--cat': catColor(ds.category) }}>
                        <span>{CATEGORY_META[ds.category]?.label ?? ds.category}</span>
                      </div>
                      <h3 title={ds.title}>{ds.title}</h3>
                      <p className="muted small">
                        {ds.owner?.display_name} · {formatDate(ds.updated_at)}
                      </p>
                      <div className="ds-foot">
                        <VisibilityBadge ds={ds} />
                        {statusBadge(ds)}
                        <span className="muted small mono">
                          {ds.files.length} file{ds.files.length === 1 ? '' : 's'}
                        </span>
                        {ds.scores && (
                          <span className="muted small mono" title={`${formatRatings(ds.scores.ratings)}. ${SCORES_HELP}`}>
                            ▶ {ds.scores.usage} · {formatFeedback(ds.scores.feedback)}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Title</th>
                      <th>Category</th>
                      <th>Owner</th>
                      <th>Visibility</th>
                      <th>Files</th>
                      <th>Size</th>
                      <th title={SCORES_HELP}>Used</th>
                      <th title={SCORES_HELP}>Feedback</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((ds, i) => (
                      <tr
                        key={ds.id}
                        className={`${selected.has(ds.id) ? 'selected' : ''}${detailId === ds.id ? ' active' : ''}`}
                        onClick={() => setDetailId(ds.id)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(ds.id)}
                            disabled={ds.status !== 'ready'}
                            onChange={(e) => toggleSelect(ds, i, e.nativeEvent.shiftKey)}
                            aria-label={`Select ${ds.title}`}
                          />
                        </td>
                        <td>
                          <strong>{ds.title}</strong> {statusBadge(ds)}
                        </td>
                        <td>
                          <i className="dot" style={{ background: catColor(ds.category) }} />{' '}
                          {CATEGORY_META[ds.category]?.label ?? ds.category}
                        </td>
                        <td>{ds.owner?.display_name}</td>
                        <td>
                          <VisibilityBadge ds={ds} />
                        </td>
                        <td className="mono">{ds.files.map((f) => f.format).join(', ')}</td>
                        <td className="mono">{formatBytes(ds.size_bytes)}</td>
                        <td className="mono">{ds.scores?.usage ?? 0}</td>
                        <td className="mono" title={formatRatings(ds.scores?.ratings)}>
                          {formatFeedback(ds.scores?.feedback)}
                        </td>
                        <td>{formatDate(ds.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {pages > 1 && (
                <div className="pager">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <span className="small mono">
                    {page} / {pages}
                  </span>
                  <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : view === 'removals' ? (
            <RemovalRequestsView onChanged={onDatasetChanged} />
          ) : view === 'mygroups' ? (
            <MyGroupsView onChanged={onDatasetChanged} />
          ) : (
            <AdminQueueView onChanged={onDatasetChanged} />
          )}
        </section>

        {detailId && (
          <DetailsPane
            datasetId={detailId}
            onClose={() => setDetailId(null)}
            onChanged={onDatasetChanged}
          />
        )}
      </div>

      {isListView && (
      <div className={`action-bar${selected.size ? ' has' : ''}`}>
        <span>
          <strong>{selected.size}</strong> selected
        </span>
        {selected.size > 0 && (
          <>
            <div className="sel-chips">
              {[...selected.values()].slice(0, 6).map((d) => (
                <span key={d.id} className="sel-chip">
                  <i className="dot" style={{ background: catColor(d.category) }} />
                  {d.title}
                  <button type="button" aria-label={`Unselect ${d.title}`} onClick={() => setSelected((p) => {
                    const n = new Map(p);
                    n.delete(d.id);
                    return n;
                  })}>
                    <IconX size={11} />
                  </button>
                </span>
              ))}
              {selected.size > 6 && <span className="muted small">+{selected.size - 6} more</span>}
            </div>
            <button type="button" className="link-btn" onClick={() => setSelected(new Map())}>
              Clear
            </button>
          </>
        )}
        <div className="spacer" />
        <Button variant="primary" disabled={!selected.size || busy} onClick={toVisualization}>
          {busy ? 'Preparing…' : 'To Visualization →'}
        </Button>
      </div>
      )}

      {uploadOpen && <UploadDialog onClose={() => setUploadOpen(false)} onUploaded={onUploaded} />}
      {toast && <div className={`toast toast-${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
