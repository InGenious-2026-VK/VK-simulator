import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from https://<user>.github.io/<repo>/, so the
// build needs `base` set to "/<repo>/". The deploy workflow passes it as
// VITE_BASE; local dev / a user-site deploy fall back to "/".
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    // The Python simulation backend (see ../backend). Start it with
    // `uvicorn app.main:app --port 8000` before `npm run dev`.
    proxy: {
      // 127.0.0.1, not localhost: on Windows `localhost` can resolve to ::1
      // while uvicorn binds IPv4 only, which shows up as a 502 from the proxy.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
