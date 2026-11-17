import BubbleMapView from './BubbleMapView.jsx';
import LineChartView from './LineChartView.jsx';
import PieChartView from './PieChartView.jsx';

// Chart type -> component. The backend (backend/app/viz/contract.py)
// guarantees the columns each type needs. Every component takes { rows, unit }.
export const CHARTS = {
  line: LineChartView,
  pie: PieChartView,
  'bubble-map': BubbleMapView,
};

/** Chart types drawn on a WebGL map: a browser allows only ~16 of them at once. */
export const MAP_TYPES = new Set(['bubble-map']);
