import { useEffect, useRef } from 'react';

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
    };

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
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
          n.vx = Math.max(-0.6, Math.min(0.6, n.vx * 0.995));
          n.vy = Math.max(-0.6, Math.min(0.6, n.vy * 0.995));
          if (Math.abs(n.vx) < 0.05) n.vx += (Math.random() - 0.5) * 0.04;
          if (Math.abs(n.vy) < 0.05) n.vy += (Math.random() - 0.5) * 0.04;
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < -20) n.x = width + 20;
          if (n.x > width + 20) n.x = -20;
          if (n.y < -20) n.y = height + 20;
          if (n.y > height + 20) n.y = -20;
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
          if (d < link) {
            ctx.strokeStyle = `rgba(${color}, ${(1 - d / link) * 0.32})`;
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
  }, [color, accent, density]);

  return <canvas ref={canvasRef} className={`network-bg ${className}`} aria-hidden="true" />;
}
