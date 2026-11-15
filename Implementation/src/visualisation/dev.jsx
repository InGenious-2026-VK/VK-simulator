/* Stand-alone page for developing the visualisation without the host UI.
   Start the backend, run `npm run dev`, then open
   http://localhost:5173/visualisation.html */
import React from 'react';
import ReactDOM from 'react-dom/client';
import VisualisationPanel from './VisualisationPanel.jsx';
import '../index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Stands in for the container the host UI will provide. */}
    <div style={{ height: '100%', padding: 24 }}>
      <div style={{ height: 420, maxWidth: 760, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <VisualisationPanel datasetId="farmland-use" />
      </div>
    </div>
  </React.StrictMode>
);
