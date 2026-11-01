/**
 * Live updates through Laravel Reverb (laravel-echo) while someone is signed in.
 * Events only say what changed; this provider refetches the matching queries, so every access
 * rule still runs on the server. Each person listens on their private channel (users.{id}); the
 * presence channel "online" says who has Tuklas open, for the chat dots.
 * Reverb is reached on the site's own origin at /app: Vite forwards it to :8080 in development,
 * Nginx in production. Without VITE_REVERB_APP_KEY (or with Reverb down) the app still works;
 * lists just refresh when you reload or act.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import type { RealtimeEvent } from '../types/realtime';
import { api } from '../api/client';

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}
window.Pusher = Pusher;

const KEY = import.meta.env.VITE_REVERB_APP_KEY as string | undefined;

interface Member {
  id: number;
  name: string;
}

/** Who is online. Until the presence channel answers, the API's own "online" values stand. */
interface Presence {
  ready: boolean;
  people: Record<number, { online: boolean; lastSeenAt: string | null }>;
}

const PresenceContext = createContext<Presence>({ ready: false, people: {} });

function connect() {
  const secure = window.location.protocol === 'https:';
  const port = Number(window.location.port) || (secure ? 443 : 80);
  return new Echo({
    broadcaster: 'reverb',
    key: KEY,
    wsHost: window.location.hostname,
    wsPort: port,
    wssPort: port,
    forceTLS: secure,
    enabledTransports: ['ws', 'wss'],
    // Channel access is checked by Laravel with the session cookie and the CSRF header, like any API call
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: (error: Error | null, data: { auth: string; channel_data?: string } | null) => void) => {
        api<{ auth: string; channel_data?: string }>('/broadcasting/auth', { body: { socket_id: socketId, channel_name: channel.name } })
          .then((data) => callback(null, data))
          .catch((error: Error) => callback(error, null));
      },
    }),
  });
}

export function RealtimeProvider({ userId, children }: { userId: number | null; children: ReactNode }) {
  const qc = useQueryClient();
  const [presence, setPresence] = useState<Presence>({ ready: false, people: {} });

  useEffect(() => {
    if (userId === null || !KEY) return;
    const echo = connect();
    let dropped = false;

    const handle = (e: RealtimeEvent) => {
      switch (e.type) {
        case 'message':
        case 'message_deleted':
          qc.invalidateQueries({ queryKey: ['chat'] });
          qc.invalidateQueries({ queryKey: ['group'] });
          break;
        case 'notification':
          qc.invalidateQueries({ queryKey: ['notifications'] });
          if (e.kind === 'announcement') qc.invalidateQueries({ queryKey: ['announcements'] });
          if (e.kind.startsWith('group')) {
            qc.invalidateQueries({ queryKey: ['groups'] });
            qc.invalidateQueries({ queryKey: ['group'] });
          }
          break;
      }
    };

    echo.private(`users.${userId}`).listen('.tuklas', handle);

    const set = (id: number, online: boolean) =>
      setPresence((p) => ({ ...p, people: { ...p.people, [id]: { online, lastSeenAt: online ? null : new Date().toISOString() } } }));
    echo
      .join('online')
      .here((members: Member[]) => setPresence({ ready: true, people: Object.fromEntries(members.map((m) => [m.id, { online: true, lastSeenAt: null }])) }))
      .joining((m: Member) => set(m.id, true))
      .leaving((m: Member) => set(m.id, false));

    // After a dropped connection, catch up on anything missed while offline.
    const connection = echo.connector.pusher.connection;
    connection.bind('state_change', ({ current }: { previous: string; current: string }) => {
      if (current === 'connected' && dropped) {
        dropped = false;
        qc.invalidateQueries({ predicate: (q) => ['chat', 'notifications', 'announcements', 'group', 'groups'].includes(String(q.queryKey[0])) });
      } else if (current === 'unavailable' || current === 'connecting') {
        dropped = true;
      }
    });

    return () => {
      echo.disconnect();
      setPresence({ ready: false, people: {} });
    };
  }, [userId, qc]);

  return <PresenceContext.Provider value={presence}>{children}</PresenceContext.Provider>;
}

/**
 * Live presence for one person. Once the presence channel has answered it decides who is online;
 * before that (or without Reverb) the API's own value is used.
 */
export function usePresence(userId: number, fallback: { online: boolean; lastSeenAt: string | null }) {
  const { ready, people } = useContext(PresenceContext);
  if (!ready) return fallback;
  const live = people[userId];
  return { online: live?.online ?? false, lastSeenAt: live?.lastSeenAt ?? fallback.lastSeenAt };
}
