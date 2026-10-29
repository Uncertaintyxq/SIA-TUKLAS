import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same origin for the API, so the auth cookie works without CORS. ws: true forwards the
    // real-time connection at /api/ws as well.
    proxy: { '/api': { target: 'http://localhost:4000', ws: true } },
  },
});
