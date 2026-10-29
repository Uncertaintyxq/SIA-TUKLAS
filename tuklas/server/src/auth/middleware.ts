/**
 * Auth middleware — loads the signed-in user from the session cookie and guards routes by login, role and verification.
 */
import type { RequestHandler } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { SESSION_COOKIE, readSession } from './session.js';
import type { Role } from '../schemas/auth.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `optionalAuth` / `requireAuth`, loaded fresh from the DB on every request. */
    user?: User;
  }
}

/** Attaches the signed-in user when there is one; never rejects. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const id = readSession(req.cookies?.[SESSION_COOKIE]);
  if (id !== null) {
    req.user = (await prisma.user.findUnique({ where: { id } })) ?? undefined;
  }
  next();
};

/** Rejects with 401 unless a valid session points at an existing user. Role comes from the DB, not the token. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  await optionalAuth(req, res, () => undefined);
  if (!req.user) {
    res.status(401).json({ error: 'Please log in to continue.' });
    return;
  }
  next();
};

/** Rejects with 403 unless the signed-in user has one of the allowed roles. */
export const requireRole = (...allowed: Role[]): RequestHandler => (req, res, next) => {
  if (!req.user || !allowed.includes(req.user.role)) {
    res.status(403).json({ error: 'You don’t have access to this.' });
    return;
  }
  next();
};

/** Educators act as advisers only after an admin verifies them. Use after requireRole. */
export const requireVerified: RequestHandler = (req, res, next) => {
  if (req.user?.role === 'educator' && !req.user.verified) {
    res.status(403).json({ error: 'An admin needs to verify your educator account first.' });
    return;
  }
  next();
};
