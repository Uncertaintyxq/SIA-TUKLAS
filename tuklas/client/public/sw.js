/*
 * Tuklas's service worker, served at /sw.js (SpaController::serviceWorker) so it looks after every page.
 * - Pages: always from the network; when that fails, the offline page.
 * - The app's built files (/build/assets/…, named by their content): kept after the first visit.
 * - The API is never stored: personal data stays out of the phone's storage.
 * - Push notifications (Account and security → Notifications): shown, and opened on tap.
 * The page registers it as /sw.js?base=<where the build lives>: /build/ on a server, / in development.
 */

const BASE = new URL(self.location.href).searchParams.get('base') || '/';
const SHELL = 'tuklas-shell-v1';
const ASSETS = 'tuklas-assets-v1';
const OFFLINE = `${BASE}offline.html`;
const ICON = `${BASE}icons/icon-192.png`;
const KEEP_ASSETS = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll([OFFLINE, ICON])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tuklas-') && k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/^\/(api|sanctum|app)\//.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (url.pathname.startsWith(`${BASE}assets/`)) {
    event.respondWith(cachedFirst(request));
  }
});

/** Built files never change under the same name, so a stored copy is always right. */
async function cachedFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    // Each release adds new file names; drop the oldest so storage doesn't grow forever
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - KEEP_ASSETS)).map((k) => cache.delete(k)));
  }
  return response;
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Tuklas', {
      body: data.body || 'You have a new update.',
      icon: ICON,
      badge: ICON,
      data: { url: data.url || '/feed' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/feed', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.navigate(target).then((w) => (w || open).focus());
      return self.clients.openWindow(target);
    }),
  );
});
