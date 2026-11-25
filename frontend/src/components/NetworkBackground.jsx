import { useEffect, useRef } from 'react';

// Line icons (24px grid) drawn inside the larger "actor" nodes.
const ICON_PATHS = [
  // person
  'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5',
  // truck
  'M2.5 7h11v9h-11zM13.5 10h4l3 3v3h-7zM6.5 18.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM17 18.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z',
  // factory
  'M3 20V10l5 3V10l5 3V10l5 3V5h3v15zM7 17h2M12 17h2M17 17h1',
  // cart
  'M3 4h2.5l2.2 10.5h10.6L20.5 8H7M9 19.5a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6zM17 19.5a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z',
  // wheat
  'M12 21V8M12 8c-2-1-3-3-3-5 2 1 3 2.5 3 5zM12 8c2-1 3-3 3-5-2 1-3 2.5-3 5zM12 13c-2.5-.5-4-2.5-4.5-4.5 2.3.3 4 2 4.5 4.5zM12 13c2.5-.5 4-2.5 4.5-4.5-2.3.3-4 2-4.5 4.5z',
  // warehouse
  'M3 10l9-5 9 5v10H3zM7 20v-6h10v6M7 17h10',
];

/**
 * Animated "network" backdrop: drifting nodes joined by lines when they are
 * close, with a gentle pull toward the pointer. Plain canvas 2D, no
 * libraries. Pauses when off screen or the tab is hidden, and draws a single
 * still frame for people who prefer reduced motion.
 */
export default function NetworkBackground({
  color = '0, 97, 172', // brand blue, as "r, g, b"
  accent = '76, 167, 43', // brand green, used for a few nodes
  density = 1,
  icons = 0, // how many large "actor" nodes (person, truck, factory…) to add
  fixed = false, // cover the viewport instead of the parent element
  className = '',
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes = [];
    let raf = 0;
    let visible = true;
    const pointer = { x: -1e4, y: -1e4, active: false };
    const paths = ICON_PATHS.map((d) => new Path2D(d));

    const seed = () => {
      const count = Math.round(Math.min(110, Math.max(28, (width * height) / 16000)) * density);
      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.4 + Math.random() * 1.8,
        accent: i % 9 === 0,
      }));
      const iconCount = Math.round(icons * Math.min(1.4, Math.max(0.5, (width * height) / 1.3e6)));
      for (let i = 0; i < iconCount; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: 18 + Math.random() * 14,
          icon: paths[i % paths.length],
          slow: true,
        });
      }
    };

    const resize = () => {
      const rect = fixed
        ? { width: window.innerWidth, height: window.innerHeight }
        : canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const link = Math.max(110, Math.min(170, window.innerWidth / 9));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const n of nodes) {
        if (!reduce) {
          if (pointer.active) {
            const dx = pointer.x - n.x;
            const dy = pointer.y - n.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 200 * 200 && d2 > 1) {
              n.vx += (dx / Math.sqrt(d2)) * 0.012;
              n.vy += (dy / Math.sqrt(d2)) * 0.012;
            }
          }
          const lim = n.slow ? 0.3 : 0.6;
          n.vx = Math.max(-lim, Math.min(lim, n.vx * 0.995));
          n.vy = Math.max(-lim, Math.min(lim, n.vy * 0.995));
          if (Math.abs(n.vx) < 0.05) n.vx += (Math.random() - 0.5) * 0.04;
          if (Math.abs(n.vy) < 0.05) n.vy += (Math.random() - 0.5) * 0.04;
          n.x += n.vx;
          n.y += n.vy;
          const m = n.r + 20;
          if (n.x < -m) n.x = width + m;
          if (n.x > width + m) n.x = -m;
          if (n.y < -m) n.y = height + m;
          if (n.y > height + m) n.y = -m;
        }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          const reach = a.icon || b.icon ? link * 1.6 : link;
          if (d < reach) {
            ctx.strokeStyle = `rgba(${color}, ${(1 - d / reach) * 0.32})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (pointer.active) {
          const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
          if (d < link * 1.3) {
            ctx.strokeStyle = `rgba(${color}, ${(1 - d / (link * 1.3)) * 0.45})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        if (n.icon) {
          ctx.fillStyle = `rgba(${color}, 0.06)`;
          ctx.strokeStyle = `rgba(${color}, 0.28)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          const s = (n.r * 1.05) / 24;
          ctx.save();
          ctx.translate(n.x - 12 * s, n.y - 12 * s);
          ctx.scale(s, s);
          ctx.lineWidth = 1.6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = `rgba(${color}, 0.34)`;
          ctx.stroke(n.icon);
          ctx.restore();
          ctx.lineWidth = 1;
          continue;
        }
        ctx.fillStyle = `rgba(${n.accent ? accent : color}, ${n.accent ? 0.85 : 0.7})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (reduce) draw();
      else if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    resize();
    start();

    const onResize = () => {
      resize();
      if (reduce) draw();
    };
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = pointer.y >= 0 && pointer.y <= r.height;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    const onVisibility = () => start();
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else cancelAnimationFrame(raf);
    });
    io.observe(canvas);
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [color, accent, density, icons, fixed]);

  return <canvas ref={canvasRef} className={`network-bg${fixed ? ' network-bg-fixed' : ''} ${className}`} aria-hidden="true" />;
}
