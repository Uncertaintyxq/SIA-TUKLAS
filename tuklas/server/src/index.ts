/**
 * Server entry — starts the Tuklas API on the configured port and attaches real-time updates.
 */
import { env } from './env.js';
import { createApp } from './app.js';
import { attachRealtime } from './realtime.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`Tuklas API on http://localhost:${env.PORT}${env.DEMO_MODE ? ' (demo mode)' : ''}`);
});
attachRealtime(server);
