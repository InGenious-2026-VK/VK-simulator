import { useEffect, useRef, useState } from 'react';
import { Button, Select } from './ui.jsx';
import {
  IconChevronsDown,
  IconChevronsUp,
  IconPlay,
  IconPause,
  IconStepBack,
  IconStepFwd,
  IconCalendar,
} from './icons.jsx';
import { TIMELINE_EVENTS, TIMELINE_TICKS } from '../data/workspaceMock.js';

const SPEEDS = ['1×', '2×', '4×'];

export default function TimelineBar({ collapsed, onCollapse, result }) {
  const total = result ? result.duration_days : 730;
  const [day, setDay] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('2×');
  const trackRef = useRef(null);

  useEffect(() => {
    setDay(1);
    setPlaying(false);
  }, [result]);

  useEffect(() => {
    if (!playing) return undefined;
    const mult = speed === '4×' ? 4 : speed === '2×' ? 2 : 1;
    const stepDays = result ? 1 : 7;
    const id = setInterval(() => {
      setDay((d) => {
        if (d >= total) {
          setPlaying(false);
          return total;
        }
        return Math.min(total, d + stepDays);
      });
    }, 400 / mult);
    return () => clearInterval(id);
  }, [playing, speed, total, result]);

  const pct = ((day - 1) / Math.max(1, total - 1)) * 100;

  const seek = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setDay(Math.max(1, Math.round(1 + p * (total - 1))));
  };

  const clock = () => {
    if (result) {
      const tp = result.timeline[Math.min(result.timeline.length - 1, day - 1)];
      return (
        <div className="tl-clock">
          <span className="mono">day {day}</span>{' '}
          <em>
            · of {total} · {tp ? `${tp.people_affected.toLocaleString('sv-SE')} affected` : ''}
          </em>
        </div>
      );
    }
    const d = new Date(2026, 0, 1);
    d.setDate(d.getDate() + (day - 1));
    const week = Math.floor((day - 1) / 7) + 1;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    return (
      <div className="tl-clock">
        <span className="mono">{iso}</span>{' '}
        <em>· week {week} · baseline calendar</em>
      </div>
    );
  };

  return (
    <footer className={`timeline${collapsed ? ' collapsed' : ''}`}>
      <div className="tl-strip">
        <button className="btn btn-ghost btn-icon" onClick={onCollapse} title="Collapse">
          {collapsed ? <IconChevronsUp size={14} /> : <IconChevronsDown size={14} />}
        </button>
        <div className="tl-transport">
          <button
            className="btn btn-ghost btn-icon"
            title="Step back"
            onClick={() => setDay((d) => Math.max(1, d - (result ? 1 : 7)))}
          >
            <IconStepBack size={15} />
          </button>
          <button className="play" title={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>
            {playing ? <IconPause size={13} /> : <IconPlay size={13} />}
          </button>
          <button
            className="btn btn-ghost btn-icon"
            title="Step forward"
            onClick={() => setDay((d) => Math.min(total, d + (result ? 1 : 7)))}
          >
            <IconStepFwd size={15} />
          </button>
        </div>
        {clock()}
        <div className="spacer" />
        <Select
          className="run-meta"
          style={{ height: 28 }}
          label="Step"
          value={result ? 'daily' : 'weekly'}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
          ]}
          onChange={() => {}}
        />
        <Select
          style={{ height: 28 }}
          label="Speed"
          value={speed}
          options={SPEEDS.map((s) => ({ value: s, label: s }))}
          onChange={setSpeed}
        />
        <Button variant="outline" size="sm" className="run-meta">
          <IconCalendar size={13} />
          {result ? `${total}-day run` : 'Jan 2026 – Dec 2027'}
        </Button>
      </div>
      <div className="tl-body">
        <div
          className="track"
          ref={trackRef}
          onPointerDown={(e) => {
            seek(e.clientX);
            const mv = (ev) => seek(ev.clientX);
            const up = () => {
              window.removeEventListener('pointermove', mv);
              window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', mv);
            window.addEventListener('pointerup', up);
          }}
        >
          <div className="events">
            {!result &&
              TIMELINE_EVENTS.map(([p, c, label]) => (
                <div className="ev" key={label} style={{ left: `${p}%` }}>
                  <i style={{ background: c }} />
                  <span>{label}</span>
                </div>
              ))}
          </div>
          <div className="rail-bg" />
          <div className="rail-fill" style={{ width: `${pct}%` }} />
          <div className="playhead" style={{ left: `${pct}%` }} />
          <div className="ticks">
            {(result
              ? Array.from({ length: 6 }, (_, i) => `d${Math.round((i / 5) * total) || 1}`)
              : TIMELINE_TICKS
            ).map((t, i) => (
              <div className="tick" key={i}>
                <i />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
