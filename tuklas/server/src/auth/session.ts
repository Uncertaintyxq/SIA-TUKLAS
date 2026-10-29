/**
 * Auth session — signs, reads and clears the JWT session cookie, and shapes a user for the client.
 * Sessions last seven days.
 */
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import type { User } from '@prisma/client';
import { env } from '../env.js';
import { rightsOf } from '../policies/rights.js';
import type { PublicUser } from '../schemas/auth.js';

export const SESSION_COOKIE = 'tuklas_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionPayload {
  sub: string;
}

export function setSession(res: Response, userId: number) {
  const token = jwt.sign({ sub: String(userId) } satisfies SessionPayload, env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Returns the user id from a valid token, or null for a missing, expired or tampered one. */
export function readSession(token: unknown): number | null {
  if (typeof token !== 'string') return null;
  try {
    const { sub } = jwt.verify(token, env.JWT_SECRET) as SessionPayload;
    const id = Number(sub);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role,
    verified: u.verified,
    program: u.program,
    headline: u.headline,
    rights: rightsOf(u),
  };
}
