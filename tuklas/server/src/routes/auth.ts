/**
 * Auth routes — sign-in and accounts, mounted at /api/auth.
 * Endpoints: login and signup (rate-limited), logout, and /me for the current session's user.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { loginSchema, signupSchema } from '../schemas/auth.js';
import { clearSession, setSession, toPublicUser } from '../auth/session.js';
import { requireAuth } from '../auth/middleware.js';
import { env } from '../env.js';
import { notifyAdmins } from '../lib/notify.js';
import { uniqueUsername } from '../lib/usernames.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Wait a few minutes and try again.' },
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for unknown email and wrong password, so accounts can't be probed.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'That email and password don’t match an account.' });
    return;
  }
  setSession(res, user.id);
  res.json({ user: toPublicUser(user) });
});

authRouter.post('/signup', loginLimiter, async (req, res) => {
  const input = signupSchema.parse(req.body);
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    res.status(409).json({ error: 'That email already has an account. Try logging in.' });
    return;
  }
  const user = await prisma.user.create({
    data: {
      name: input.name,
      username: await uniqueUsername(input.email),
      email: input.email,
      role: input.role,
      // Educators can't approve work until an admin confirms them.
      verified: input.role !== 'educator',
      program: input.program,
      passwordHash: await bcrypt.hash(input.password, 10),
      profile: { create: {} },
    },
  });
  if (user.role === 'educator') {
    await notifyAdmins('educator_signup', `${user.name} signed up as an educator and is waiting for verification.`, '/admin?tab=educators');
  }
  setSession(res, user.id);
  res.status(201).json({ user: toPublicUser(user) });
});

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user!) });
});
