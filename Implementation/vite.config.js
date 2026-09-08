import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
