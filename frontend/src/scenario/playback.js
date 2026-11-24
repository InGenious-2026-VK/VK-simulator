// Playback of a completed run, hour by hour.
//
// The engine solves one day at a time and reports each day's end state
// (`result.timeline` for the region, `result.town_timeline` per town). The
// player walks a clock in simulated hours, from 0 (the moment the shock hits)
// to duration_days × 24, and interpolates linearly between those daily
// snapshots so that numbers, charts and the map change smoothly.

export const HOURS_PER_DAY = 24;

export function totalHours(result) {
  return result ? result.duration_days * HOURS_PER_DAY : 0;
}

/**
 * "Day 3 · 14:00" for an hour offset (day 1 starts at hour 0). The very end
 * of a run (`end`) reads as the end of its last day, "Day 21 · 24:00".
 */
export function formatClock(hour, end = null) {
  const h = Math.max(0, Math.round(hour));
  if (end && h >= end) {
    const last = Math.max(1, Math.round(end / HOURS_PER_DAY));
    return { day: last, time: '24:00', label: `Day ${last} · 24:00` };
  }
  const day = Math.floor(h / HOURS_PER_DAY) + 1;
  const hh = String(h % HOURS_PER_DAY).padStart(2, '0');
  return { day, time: `${hh}:00`, label: `Day ${day} · ${hh}:00` };
}

function lerp(a, b, f) {
  return a + (b - a) * f;
}

/** Value of a daily series at fractional day `t` (0 = start, k = end of day k). */
function at(series, t, start) {
  if (!series.length) return start;
  const k = Math.floor(t);
  const f = t - k;
  const v0 = k === 0 ? start : series[Math.min(series.length, k) - 1];
  const v1 = series[Math.min(series.length - 1, k)];
  return k >= series.length ? series[series.length - 1] : lerp(v0, v1, f);
}

/**
 * The state of the whole region at `hour`.
 * `network` (optional) supplies each town's starting buffer (local_stock_days).
 */
export function frameAt(result, hour, network = null) {
  if (!result) return null;
  const end = totalHours(result);
  const h = Math.max(0, Math.min(end, hour));
  const t = h / HOURS_PER_DAY;
  const tl = result.timeline;
  const s = result.region_summary;

  const unmet = at(tl.map((p) => p.unmet_tpd), t, tl[0]?.unmet_tpd ?? 0);
  const region = {
    people_affected: Math.round(at(tl.map((p) => p.people_affected), t, 0)),
    buffer_reserve_pct: at(tl.map((p) => p.buffer_reserve_pct), t, 100),
    unmet_tpd: unmet,
    supply_tpd: Math.max(0, s.total_demand_tpd - unmet),
    pct_demand_met: s.total_demand_tpd ? ((s.total_demand_tpd - unmet) / s.total_demand_tpd) * 100 : 100,
  };

  const startBuffer = new Map(
    (network?.nodes ?? []).filter((n) => n.type === 'demand').map((n) => [n.id, n.local_stock_days ?? null])
  );
  const dayIdx = Math.min(result.duration_days - 1, Math.floor(t));
  const towns = new Map();
  for (const series of result.town_timeline ?? []) {
    const b0 = startBuffer.get(series.id) ?? series.buffer_days[0] ?? 0;
    towns.set(series.id, {
      people_affected: Math.round(at(series.people_affected, t, 0)),
      buffer_days: at(series.buffer_days, t, b0),
      severity: series.severity[dayIdx] ?? 'none',
    });
  }

  // Worst town right now
  let worst = null;
  for (const n of result.nodes) {
    const tw = towns.get(n.id);
    if (n.type === 'demand' && tw && tw.people_affected > 0 && (!worst || tw.people_affected > worst.people)) {
      worst = { name: n.name, people: tw.people_affected };
    }
  }

  return { hour: h, end, t, progress: end ? h / end : 0, atEnd: h >= end, region, towns, worst };
}

/**
 * Per-town values for the map at a frame; falls back to the end-of-run node
 * state when the run has no per-town series (older stored runs).
 */
export function townAt(frame, node) {
  const tw = frame?.towns.get(node.id);
  if (!tw) {
    return { people_affected: node.people_affected, severity: node.severity, buffer_days: node.buffer_days_remaining };
  }
  return tw;
}
