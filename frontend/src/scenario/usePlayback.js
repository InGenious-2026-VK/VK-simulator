import { useCallback, useEffect, useRef, useState } from 'react';
import { HOURS_PER_DAY, totalHours } from './playback.js';

export const SPEEDS = [1, 2, 4, 8];
// simulated hours per real second at 1× speed
const RATE = { hourly: 4, daily: 24 };

/**
 * Shared playback clock for a run.
 *
 * - `hour` (React state) changes once per simulated hour: panels, charts and
 *   map colours re-render from it.
 * - `clockRef.current` is the continuous clock, advanced every animation
 *   frame; the map reads it to move goods smoothly along the corridors
 *   without re-rendering the page 60 times a second.
 */
export function usePlayback(result) {
  const end = totalHours(result);
  const [hour, setHour] = useState(end);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [step, setStep] = useState('hourly'); // hourly | daily
  const clockRef = useRef(end);
  const playingRef = useRef(false);
  playingRef.current = playing;

  // A new run: show its end state, paused.
  useEffect(() => {
    clockRef.current = end;
    setHour(end);
    setPlaying(false);
  }, [result, end]);

  const seek = useCallback(
    (h) => {
      const v = Math.max(0, Math.min(end, h));
      clockRef.current = v;
      setHour(Math.floor(v));
    },
    [end]
  );

  useEffect(() => {
    if (!playing || !end) return undefined;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const next = Math.min(end, clockRef.current + dt * RATE[step] * speed);
      clockRef.current = next;
      const whole = Math.floor(next);
      setHour((h) => (h === whole ? h : whole));
      if (next >= end) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, step, end]);

  const togglePlay = useCallback(() => {
    if (!end) return;
    if (!playingRef.current && clockRef.current >= end) seek(0); // replay from the start
    setPlaying((p) => !p);
  }, [end, seek]);

  const stepBy = useCallback(
    (dir) => {
      setPlaying(false);
      const size = step === 'daily' ? HOURS_PER_DAY : 1;
      const base = step === 'daily' ? Math.round(clockRef.current / size) * size : Math.floor(clockRef.current);
      seek(base + dir * size);
    },
    [step, seek]
  );

  return { hour, end, playing, speed, step, clockRef, setSpeed, setStep, seek, togglePlay, stepBy, setPlaying };
}
