import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same origin for the Laravel API (php artisan serve), so the session and XSRF cookies work
    // without CORS. /sanctum/csrf-cookie hands out the CSRF token. Live updates move to Reverb in
    // feat/client-realtime.
    proxy: {
      '/api': 'http://localhost:8000',
      '/sanctum': 'http://localhost:8000',
    },
  },
});
