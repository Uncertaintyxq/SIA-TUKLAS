/**
 * Live updates: one WebSocket per tab to /api/ws while someone is signed in.
 * Events only say what changed; this provider refetches the matching queries, so every
 * access rule still runs on the server. It also tracks who is online for chat.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeEvent } from '@server/schemas/realtime';

type Presence = Record<number, { online: boolean; lastSeenAt: string | null }>;

const PresenceContext = createContext<Presence>({});

export function RealtimeProvider({ userId, children }: { userId: number | null; children: ReactNode }) {
  const qc = useQueryClient();
  const [presence, setPresence] = useState<Presence>({});

  useEffect(() => {
    if (userId === null) return;
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let attempts = 0;
    let stopped = false;

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
          if (e.kind.startsWith('group')) qc.invalidateQueries({ queryKey: ['groups'] });
          break;
        case 'presence':
          setPresence((p) => ({ ...p, [e.userId]: { online: e.online, lastSeenAt: e.lastSeenAt } }));
          break;
      }
    };

    const connect = () => {
      socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/ws`);
      socket.onopen = () => {
        // After a dropped connection, catch up on anything missed while offline.
        if (attempts > 0) qc.invalidateQueries({ predicate: (q) => ['chat', 'notifications', 'announcements'].includes(String(q.queryKey[0])) });
        attempts = 0;
      };
      socket.onmessage = (m) => {
        try {
          handle(JSON.parse(String(m.data)) as RealtimeEvent);
        } catch {
          /* ignore anything that isn't one of our events */
        }
      };
      socket.onclose = () => {
        if (stopped) return;
        attempts += 1;
        retry = window.setTimeout(connect, Math.min(30_000, 1_000 * 2 ** attempts));
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      socket?.close();
    };
  }, [userId, qc]);

  return <PresenceContext.Provider value={presence}>{children}</PresenceContext.Provider>;
}

/** Live presence for one person, falling back to what the API said when the list loaded. */
export function usePresence(userId: number, fallback: { online: boolean; lastSeenAt: string | null }) {
  return useContext(PresenceContext)[userId] ?? fallback;
}
