/* Illustrative parameters and content for workspace panels the current
   Python backend does not yet feed. Every consumer labels these as sample
   data. The "Disruption / shock" model is the one wired to the live engine
   (see App.jsx / ScenarioControls.jsx). */

export const LIVE_MODEL = 'Disruption / shock';

export const SIM_MODELS = {
  'Disruption / shock': [
    ['select', 'Shock type', ['Road link failure', 'Rail closure', 'Facility outage', 'Combined']],
    ['range', 'Severity', '65', '%', 0, 100],
    ['range', 'Duration', '18', ' wk', 1, 52],
    ['select', 'Reroute policy', ['Least cost', 'Shortest time', 'No rerouting']],
  ],
  'Demand shift': [
    ['range', 'Population growth', '+1.4', '%/yr', -2, 5],
    ['select', 'Diet scenario', ['EAT-Lancet shift', 'Current trend', 'High animal protein']],
    ['range', 'Local-sourcing preference', '42', '%', 0, 100],
    ['select', 'Seasonality', ['Observed 2024', 'Smoothed', 'Amplified']],
  ],
  'Climate & yield': [
    ['select', 'Climate pathway', ['SSP2-4.5', 'SSP1-2.6', 'SSP5-8.5']],
    ['range', 'Growing-season rainfall', '-22', '%', -50, 50],
    ['range', 'Heat-stress days', '+11', ' d', 0, 40],
    ['select', 'Irrigation response', ['Constrained', 'Unconstrained']],
  ],
  'Logistics routing': [
    ['select', 'Objective', ['Min cost', 'Min emissions', 'Min lead time']],
    ['range', 'Fleet capacity', '100', '%', 50, 150],
    ['range', 'Max delivery radius', '85', ' km', 10, 200],
    ['select', 'Consolidation', ['Regional DC hubs', 'Direct-to-store']],
  ],
  'Self-sufficiency': [
    ['select', 'Boundary', ['Region only', 'Region + adjacent counties']],
    ['range', 'Import substitution', '30', '%', 0, 100],
    ['select', 'Commodity basket', ['All 6 groups', 'Cereals + dairy', 'Fresh produce']],
    ['range', 'Storage buffer', '14', ' d', 0, 90],
  ],
  'Price & cost': [
    ['range', 'Fuel price', '+18', '%', -40, 120],
    ['range', 'Input cost (fertiliser)', '+9', '%', -40, 120],
    ['select', 'Pass-through', ['Partial (0.6)', 'Full', 'None']],
    ['range', 'Consumer elasticity', '-0.4', '', -2, 0],
  ],
  'Agent behaviour': [
    ['range', 'Agents', '1.8', 'M', 0.1, 5],
    ['select', 'Re-sourcing rule', ['Nearest available', 'Cheapest available', 'Loyal to contract']],
    ['range', 'Hoarding propensity', '12', '%', 0, 100],
    ['select', 'Information delay', ['1 week', 'Instant', '2 weeks']],
  ],
};

export const TIMELINE_EVENTS = [
  [14, '#e7000b', 'Rail closure'],
  [26, '#f97316', 'Harvest'],
  [38, '#eab308', 'Price spike'],
  [62, '#0d9488', 'Recovery'],
];

export const TIMELINE_TICKS = [
  'Jan 26', 'Mar', 'May', 'Jul', 'Sep', 'Nov',
  'Jan 27', 'Mar', 'May', 'Jul', 'Sep', 'Dec 27',
];

export const RECENT_RUNS = [
  ['S-04 Rail closure + dry year', '7f2a', '2 h ago'],
  ['S-03 E4 bridge outage', '5d90', 'yesterday'],
  ['S-02 Local sourcing +30%', '3ba7', '3 d ago'],
];

export const COMMODITY_LEGEND = [
  ['Cereals', '#1e4e6e'],
  ['Dairy', '#0d9488'],
  ['Meat', '#f97316'],
  ['Vegetables', '#eab308'],
  ['Root crops', '#f59e0b'],
  ['Eggs', '#a1a1aa'],
];

export const COMPARE_INDICATORS = [
  ['Self-sufficiency', '41.2%', '58.6%', '+17.4 pp', 1],
  ['Unmet demand', '8.4%', '3.1%', '−5.3 pp', 1],
  ['Delivery lag', '2.3 d', '1.6 d', '−0.7 d', 1],
  ['Resilience index', '0.67', '0.79', '+0.12', 1],
  ['Food-km', '148 km', '96 km', '−52 km', 1],
  ['Consumer cost', '+12.4%', '+15.8%', '+3.4 pp', 0],
  ['CO₂e per t', '74 kg', '61 kg', '−13 kg', 1],
];
