/**
 * Real-time push over one WebSocket per open tab, at /api/ws.
 * The server only pushes (event types in schemas/realtime.ts); everything a user does still goes
 * through the REST API and its checks.
 */
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { prisma } from './db.js';
import { SESSION_COOKIE, readSession } from './auth/session.js';
import type { RealtimeEvent } from './schemas/realtime.js';

// ---------- Connections ----------

const sockets = new Map<number, Set<WebSocket>>();
const alive = new WeakMap<WebSocket, boolean>();

export const isOnline = (userId: number) => (sockets.get(userId)?.size ?? 0) > 0;

export function pushTo(userIds: number | number[], event: RealtimeEvent) {
  const data = JSON.stringify(event);
  for (const id of new Set([userIds].flat())) {
    for (const ws of sockets.get(id) ?? []) if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

function broadcast(event: RealtimeEvent) {
  pushTo([...sockets.keys()], event);
}

function connected(ws: WebSocket, userId: number) {
  const mine = sockets.get(userId) ?? new Set();
  const first = mine.size === 0;
  mine.add(ws);
  sockets.set(userId, mine);
  alive.set(ws, true);
  if (first) broadcast({ type: 'presence', userId, online: true, lastSeenAt: null });

  ws.on('pong', () => alive.set(ws, true));
  // Clients don't send anything we act on; drop whatever arrives.
  ws.on('message', () => undefined);
  ws.on('close', async () => {
    mine.delete(ws);
    if (mine.size > 0) return;
    sockets.delete(userId);
    const lastSeenAt = new Date();
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt } }).catch(() => undefined);
    broadcast({ type: 'presence', userId, online: false, lastSeenAt: lastSeenAt.toISOString() });
  });
}

// ---------- Handshake ----------

function cookieValue(header: string | undefined, name: string) {
  for (const part of (header ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) {
      try {
        return decodeURIComponent(part.slice(at + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function sameHost(origin: string, host: string | undefined) {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function refuse(socket: Duplex, status: string) {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/** Accepts WebSocket upgrades from signed-in users on our own origin. */
export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  server.on('upgrade', async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/api/ws') return refuse(socket, '404 Not Found');
    // Browsers always send Origin on a WebSocket handshake; another site's page can't connect with our cookie.
    const origin = req.headers.origin;
    if (origin && !sameHost(origin, req.headers.host)) return refuse(socket, '403 Forbidden');
    const id = readSession(cookieValue(req.headers.cookie, SESSION_COOKIE));
    const user = id === null ? null : await prisma.user.findUnique({ where: { id }, select: { id: true } }).catch(() => null);
    if (!user) return refuse(socket, '401 Unauthorized');
    wss.handleUpgrade(req, socket, head, (ws) => connected(ws, user.id));
  });

  // Heartbeat: a socket that misses a pong is gone (sleeping laptop, dropped Wi-Fi).
  const timer = setInterval(() => {
    for (const set of sockets.values())
      for (const ws of set) {
        if (!alive.get(ws)) {
          ws.terminate();
          continue;
        }
        alive.set(ws, false);
        ws.ping();
      }
  }, 25_000);
  server.on('close', () => clearInterval(timer));
}
