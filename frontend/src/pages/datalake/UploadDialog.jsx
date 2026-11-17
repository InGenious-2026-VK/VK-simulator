import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui.jsx';
import { IconX } from '../../components/icons.jsx';
import * as api from '../../api/client.js';
import { VISIBILITY_META, formatBytes } from '../categories.js';

const DATA_EXT = ['.csv', '.tsv', '.xlsx', '.json', '.geojson', '.gpkg', '.zip', '.parquet'];
const STEPS = ['Files', 'Validate', 'Sharing'];

function isMetadataFile(f) {
  return /^metadata(\..*)?\.json$/i.test(f.name) || f.name.toLowerCase() === 'metadata.json';
}

/** Three-step upload: files (+ one metadata.json) → validate → sharing. */
export default function UploadDialog({ onClose, onUploaded }) {
  const [step, setStep] = useState(0);
  const [dataFiles, setDataFiles] = useState([]);
  const [metaFile, setMetaFile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [metaErrors, setMetaErrors] = useState([]);
  const [validating, setValidating] = useState(false);
  const [visibility, setVisibility] = useState('private');
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    api
      .listGroups()
      .then((g) => {
        setGroups(g.items);
        if (g.items[0]) setGroupId(g.items[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addFiles = (list) => {
    const files = [...list];
    const metas = files.filter(isMetadataFile);
    const data = files.filter((f) => !isMetadataFile(f));
    if (metas.length) setMetaFile(metas[metas.length - 1]);
    setDataFiles((prev) => {
      const byName = new Map(prev.map((f) => [f.name, f]));
      for (const f of data) byName.set(f.name, f);
      return [...byName.values()];
    });
    setMeta(null);
    setMetaErrors([]);
  };

  const badExt = dataFiles.filter((f) => !DATA_EXT.some((e) => f.name.toLowerCase().endsWith(e)));

  const validate = async () => {
    setValidating(true);
    setError(null);
    try {
      let parsed;
      try {
        parsed = JSON.parse(await metaFile.text());
      } catch (e) {
        setMeta(null);
        setMetaErrors([{ path: '/', message: `not valid JSON: ${e.message}` }]);
        return;
      }
      const res = await api.validateMetadata(parsed);
      setMeta(parsed);
      setMetaErrors(res.errors);
      if (parsed.sensitivity === 'restricted' && visibility === 'public') setVisibility('private');
    } catch (e) {
      setError(e.message);
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (step === 1 && metaFile) validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const mismatch = useMemo(() => {
    if (!meta?.files) return { missing: [], extra: [] };
    const declared = new Set(meta.files.map((f) => f.name));
    const uploaded = new Set(dataFiles.map((f) => f.name));
    return {
      missing: [...declared].filter((n) => !uploaded.has(n)),
      extra: [...uploaded].filter((n) => !declared.has(n)),
    };
  }, [meta, dataFiles]);

  const metaOk = meta && metaErrors.length === 0 && !mismatch.missing.length && !mismatch.extra.length;
  const restricted = meta?.sensitivity === 'restricted';

  const downloadTemplate = async () => {
    const tpl = await api.getMetadataTemplate();
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metadata.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async () => {
    setUploading(true);
    setError(null);
    try {
      const ds = await api.uploadDataset({
        metadataFile: metaFile,
        files: dataFiles,
        visibility,
        groupId: visibility === 'group' ? groupId : null,
      });
      onUploaded(ds);
    } catch (e) {
      const errs = e.details?.errors;
      setError(errs ? `${e.message} ${errs.map((x) => `${x.path}: ${x.message}`).join('; ')}` : e.message);
      setUploading(false);
    }
  };

  const canNext =
    step === 0
      ? dataFiles.length > 0 && metaFile && !badExt.length
      : step === 1
        ? metaOk
        : visibility !== 'group' || groupId;

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal upload-modal" role="dialog" aria-labelledby="up-title">
        <div className="modal-head">
          <h2 id="up-title">New dataset</h2>
          <Button icon aria-label="Close" onClick={onClose}>
            <IconX size={15} />
          </Button>
        </div>
        <ol className="stepper">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
              <span>{i + 1}</span> {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="up-step">
            <label
              className={`dropzone${drag ? ' drag' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              <input type="file" multiple onChange={(e) => addFiles(e.target.files)} />
              <strong>Drop data files and your metadata.json here</strong>
              <span className="muted small">or click to browse · CSV, XLSX, GeoJSON, JSON, GeoPackage, zipped Shapefile, Parquet</span>
            </label>
            <div className="up-files">
              <div className="up-row head">
                <span>Metadata file</span>
                <label className="link-btn">
                  choose…
                  <input
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(e) => e.target.files[0] && setMetaFile(e.target.files[0])}
                  />
                </label>
              </div>
              {metaFile ? (
                <div className="up-row">
                  <span className="mono">📋 {metaFile.name}</span>
                  <span className="muted small">{formatBytes(metaFile.size)}</span>
                  <button type="button" className="link-btn" onClick={() => setMetaFile(null)}>remove</button>
                </div>
              ) : (
                <p className="muted small">
                  Exactly one standard metadata file is required.{' '}
                  <button type="button" className="link-btn" onClick={downloadTemplate}>
                    Download metadata template
                  </button>
                </p>
              )}
              <div className="up-row head">
                <span>Data files ({dataFiles.length})</span>
              </div>
              {dataFiles.map((f) => (
                <div key={f.name} className="up-row">
                  <span className="mono">{f.name}</span>
                  <span className="muted small">{formatBytes(f.size)}</span>
                  <button type="button" className="link-btn" onClick={() => setDataFiles((p) => p.filter((x) => x !== f))}>
                    remove
                  </button>
                </div>
              ))}
              {badExt.length > 0 && (
                <p className="form-error">Unsupported file type: {badExt.map((f) => f.name).join(', ')}</p>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="up-step">
            {validating && <p className="muted">Validating metadata…</p>}
            {meta && (
              <div className="meta-summary">
                <h3>{meta.title}</h3>
                <p className="muted small">
                  {meta.category} · licence {meta.license} · sensitivity <strong>{meta.sensitivity}</strong>
                  {meta.simulation?.role ? ` · simulation role ${meta.simulation.role}` : ''}
                </p>
              </div>
            )}
            {metaErrors.length > 0 && (
              <div className="callout danger">
                <strong>The metadata file has {metaErrors.length} problem{metaErrors.length > 1 ? 's' : ''}:</strong>
                <ul>
                  {metaErrors.map((e, i) => (
                    <li key={i}>
                      <code>{e.path}</code> {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(mismatch.missing.length > 0 || mismatch.extra.length > 0) && (
              <div className="callout warn">
                {mismatch.missing.length > 0 && (
                  <p>Listed in metadata but not uploaded: {mismatch.missing.map((n) => <code key={n}>{n}</code>)}</p>
                )}
                {mismatch.extra.length > 0 && (
                  <p>Uploaded but not listed in metadata: {mismatch.extra.map((n) => <code key={n}>{n}</code>)}</p>
                )}
              </div>
            )}
            {metaOk && <div className="callout ok">Metadata is valid and matches the uploaded files.</div>}
          </div>
        )}

        {step === 2 && (
          <div className="up-step">
            <p className="muted">Who can see and select this dataset?</p>
            <div className="vis-options">
              {Object.entries(VISIBILITY_META).map(([key, v]) => {
                const disabled = key === 'public' && restricted;
                return (
                  <label key={key} className={`vis-option${visibility === key ? ' on' : ''}${disabled ? ' disabled' : ''}`}>
                    <input
                      type="radio"
                      name="vis"
                      value={key}
                      checked={visibility === key}
                      disabled={disabled || (key === 'group' && !groups.length)}
                      onChange={() => setVisibility(key)}
                    />
                    <span className="vis-icon">{v.icon}</span>
                    <span>
                      <strong>{v.label}</strong>
                      <span className="muted small">
                        {disabled ? 'Not allowed: metadata sensitivity is “restricted”.' : key === 'group' && !groups.length ? 'You are not in any group.' : v.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {visibility === 'group' && (
              <label className="field">
                <span>Group</span>
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="modal-foot">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={uploading}>
              Back
            </Button>
          )}
          <div className="spacer" />
          {step < 2 ? (
            <Button variant="primary" disabled={!canNext || validating} onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button variant="primary" disabled={!canNext || uploading} onClick={upload}>
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
