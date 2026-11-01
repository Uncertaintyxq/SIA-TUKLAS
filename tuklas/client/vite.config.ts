import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Read the app's own .env (tuklas/.env). Vite exposes only VITE_* variables to the browser, so
  // the Reverb app key and the demo-mode switch come through and no secret does.
  envDir: '..',
  server: {
    port: 5173,
    // Same origin for the Laravel API (php artisan serve), so the session and XSRF cookies work
    // without CORS. /sanctum/csrf-cookie hands out the CSRF token. changeOrigin stays off (the
    // string shorthand turns it on): Laravel must see the browser's host, so emailed links point at
    // :5173 and their signatures check out. /app/ is the Reverb WebSocket (php artisan reverb:start).
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: false },
      '/sanctum': { target: 'http://localhost:8000', changeOrigin: false },
      '^/app/': { target: 'http://localhost:8080', ws: true, changeOrigin: false },
    },
  },
});
