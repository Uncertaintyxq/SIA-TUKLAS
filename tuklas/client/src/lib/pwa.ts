/**
 * Installing Tuklas as an app and push notifications on this device: registers the service worker
 * (client/public/sw.js), keeps the browser's install prompt for the Install button, and turns this
 * device's push subscription on or off. The server side is /api/account/push.
 */
import { useSyncExternalStore } from 'react';

/** Chrome and Edge offer installing through this event; Safari has no prompt (Share → Add to Home Screen). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e as InstallPromptEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    changed();
  });
  window.addEventListener('load', () => {
    // The build lives under /build/ on a server and / in development; the worker needs to know which
    navigator.serviceWorker.register(`/sw.js?base=${encodeURIComponent(import.meta.env.BASE_URL)}`, { scope: '/' }).catch(() => {
      // No worker (an old browser, or a private window that blocks it): the app works the same online
    });
  });
}

/** Whether the browser offered installing, and a function that shows its prompt. */
export function useInstallPrompt() {
  const available = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => installPrompt !== null,
  );
  const install = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null;
    changed();
    return outcome === 'accepted';
  };
  return { available, install };
}

export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches;
export const isAppleMobile = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** This device's current push subscription, if notifications are on. */
export async function currentSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration ? registration.pushManager.getSubscription() : null;
}

/** Asks permission and subscribes this device; the result goes to the server. */
export async function subscribePush(publicKey: string) {
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('Notifications are blocked for Tuklas in this browser. Allow them in the site settings, then try again.');
  }
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
}

function base64UrlToBytes(value: string) {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
