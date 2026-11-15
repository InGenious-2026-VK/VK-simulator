/* Stand-alone page for developing the visualisation without the host UI.
   Start the backend, run `npm run dev`, then open
   http://localhost:5173/visualisation.html
   It shows one example per chart type. To look at another dataset, add its id:
   http://localhost:5173/visualisation.html?dataset=farmland-use */
import React from 'react';
import ReactDOM from 'react-dom/client';
import VisualisationPanel from './VisualisationPanel.jsx';
import '../index.css';

const EXAMPLES = ['farmland-use', 'arable-land-use'];
const asked = new URLSearchParams(window.location.search).get('dataset');
const datasetIds = asked ? [asked] : EXAMPLES;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ height: '100%', padding: 24, overflow: 'auto', display: 'grid', gap: 24, alignContent: 'start' }}>
      {datasetIds.map((id) => (
        /* Stands in for the container the host UI will provide. */
        <div key={id} style={{ height: 420, maxWidth: 760, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <VisualisationPanel datasetId={id} />
        </div>
      ))}
    </div>
  </React.StrictMode>
);
