import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same origin for the Laravel API (php artisan serve), so the session and XSRF cookies work
    // without CORS. /sanctum/csrf-cookie hands out the CSRF token. Live updates move to Reverb in
    // feat/client-realtime. changeOrigin stays off (the string shorthand turns it on): Laravel must
    // see the browser's host, so emailed links point at :5173 and their signatures check out.
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: false },
      '/sanctum': { target: 'http://localhost:8000', changeOrigin: false },
    },
  },
});
