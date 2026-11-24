import { useRef } from "react";
import { Select } from "./ui.jsx";
import {
  IconChevronsDown,
  IconChevronsUp,
  IconPlay,
  IconPause,
  IconStepBack,
  IconStepFwd,
} from "./icons.jsx";
import { SPEEDS } from "../scenario/usePlayback.js";
import { HOURS_PER_DAY, formatClock } from "../scenario/playback.js";

/**
 * Transport + scrubber for playing a run back hour by hour. The clock lives in
 * the workspace (`playback`), so the map, charts and KPIs follow it.
 */
export default function TimelineBar({
  collapsed,
  onCollapse,
  result,
  playback,
  frame,
}) {
  const trackRef = useRef(null);
  const { hour, end, playing, speed, step } = playback;
  const enabled = Boolean(result && end);
  const pct = enabled ? (hour / end) * 100 : 0;
  const clock = formatClock(hour, end);
  const days = result?.duration_days ?? 0;

  const seekTo = (clientX) => {
    if (!enabled) return;
    const r = trackRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    playback.setPlaying(false);
    playback.seek(Math.round(p * end));
  };

  const s = result?.region_summary;
  const markers = enabled
    ? [
        s.first_shortfall_day && [
          s.first_shortfall_day,
          "#f59e0b",
          `Shortfall · d${s.first_shortfall_day}`,
        ],
        s.first_buffer_failure_day && [
          s.first_buffer_failure_day,
          "#e7000b",
          `Buffers fail · d${s.first_buffer_failure_day}`,
        ],
      ].filter(Boolean)
    : [];
  const tickCount = Math.min(days, 7);

  return (
    <footer className={`timeline${collapsed ? " collapsed" : ""}`}>
      <div className="tl-strip">
        <button
          className="btn btn-ghost btn-icon"
          onClick={onCollapse}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <IconChevronsUp size={14} />
          ) : (
            <IconChevronsDown size={14} />
          )}
        </button>
        <div className="tl-transport">
          <button
            className="btn btn-ghost btn-icon"
            title={step === "daily" ? "Back one day" : "Back one hour"}
            disabled={!enabled}
            onClick={() => playback.stepBy(-1)}
          >
            <IconStepBack size={15} />
          </button>
          <button
            className="play"
            title={
              !enabled
                ? "Run a scenario to play it back"
                : playing
                  ? "Pause"
                  : "Play"
            }
            aria-label={playing ? "Pause" : "Play"}
            disabled={!enabled}
            onClick={playback.togglePlay}
          >
            {playing ? <IconPause size={13} /> : <IconPlay size={13} />}
          </button>
          <button
            className="btn btn-ghost btn-icon"
            title={step === "daily" ? "Forward one day" : "Forward one hour"}
            disabled={!enabled}
            onClick={() => playback.stepBy(1)}
          >
            <IconStepFwd size={15} />
          </button>
        </div>
        {enabled ? (
          <div className="tl-clock" aria-live="off">
            <span className="mono">
              Day {clock.day} · {clock.time}
            </span>{" "}
            <em>
              of {days} days ·{" "}
              {frame
                ? `${frame.region.people_affected.toLocaleString("sv-SE")} without food`
                : ""}
            </em>
          </div>
        ) : (
          <div className="tl-clock">
            <em>
              Run a scenario, then press play to watch it unfold hour by hour.
            </em>
          </div>
        )}
        <div className="spacer" />
        <Select
          style={{ height: 28 }}
          label="Step"
          value={step}
          options={[
            { value: "hourly", label: "Hourly" },
            { value: "daily", label: "Daily" },
          ]}
          onChange={playback.setStep}
        />
        <Select
          style={{ height: 28 }}
          label="Speed"
          value={String(speed)}
          options={SPEEDS.map((v) => ({ value: String(v), label: `${v}×` }))}
          onChange={(v) => playback.setSpeed(Number(v))}
        />
      </div>
      <div className="tl-body">
        <div
          className={`track${enabled ? "" : " disabled"}`}
          ref={trackRef}
          role="slider"
          aria-label="Simulation time"
          aria-valuemin={0}
          aria-valuemax={end}
          aria-valuenow={hour}
          aria-valuetext={clock.label}
          tabIndex={enabled ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") playback.stepBy(1);
            if (e.key === "ArrowLeft") playback.stepBy(-1);
            if (e.key === " ") {
              e.preventDefault();
              playback.togglePlay();
            }
          }}
          onPointerDown={(e) => {
            seekTo(e.clientX);
            const mv = (ev) => seekTo(ev.clientX);
            const up = () => {
              window.removeEventListener("pointermove", mv);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", mv);
            window.addEventListener("pointerup", up);
          }}
        >
          <div className="events">
            {markers.map(([day, c, label]) => {
              const left = (((day - 1) * HOURS_PER_DAY) / end) * 100;
              const edge = left < 8 ? " ev-start" : left > 92 ? " ev-end" : "";
              return (
                <div
                  className={`ev${edge}`}
                  key={label}
                  style={{ left: `${left}%` }}
                >
                  <i style={{ background: c }} />
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
          <div className="rail-bg" />
          <div className="rail-fill" style={{ width: `${pct}%` }} />
          <div className="playhead" style={{ left: `${pct}%` }} />
          <div className="ticks">
            {enabled &&
              Array.from({ length: tickCount + 1 }, (_, i) =>
                Math.round((i / tickCount) * days),
              ).map((d, i) => (
                <div className="tick" key={i}>
                  <i />
                  <span>{d === 0 ? "start" : `d${d}`}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
