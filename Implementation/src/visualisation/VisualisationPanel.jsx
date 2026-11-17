import { CHARTS } from './charts.js';
import { useDataset } from './useDataset.js';
import './visualisation.css';

/**
 * The visualisation window. This is the one component the host UI renders;
 * it fills whatever container it is placed in.
 *
 * datasetId: id of a dataset in the data lake manifest.
 */
export default function VisualisationPanel({ datasetId }) {
  const { status, dataset, error } = useDataset(datasetId);

  if (status === 'loading') return <Frame><p className="viz-message">Loading…</p></Frame>;
  if (status === 'error') return <Frame><p className="viz-message viz-error">{error.message}</p></Frame>;

  const View = CHARTS[dataset.type];
  return (
    <Frame dataset={dataset}>
      {View ? (
        <View rows={dataset.rows} unit={dataset.unit} />
      ) : (
        <p className="viz-message viz-error">No chart for type "{dataset.type}" yet.</p>
      )}
    </Frame>
  );
}

function Frame({ dataset, children }) {
  return (
    <section className="viz-panel">
      {dataset && (
        <header className="viz-header">
          <h2>{dataset.title}</h2>
          {dataset.subtitle && <p>{dataset.subtitle}</p>}
        </header>
      )}
      <div className="viz-body">{children}</div>
      {dataset?.source && <footer className="viz-footer">Source: {dataset.source}</footer>}
    </section>
  );
}
