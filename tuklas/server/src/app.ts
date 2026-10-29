/**
 * Express app — builds the API server: security headers, body parsing, every /api/* router, and error handling.
 * The error handler turns validation, database and upload errors into plain JSON messages for the client.
 */
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { UploadError } from './lib/files.js';
import { adminRouter } from './routes/admin.js';
import { announcementsRouter } from './routes/announcements.js';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { demoRouter } from './routes/demo.js';
import { adsRouter, eventsRouter } from './routes/events.js';
import { feedRouter, opportunitiesRouter } from './routes/feed.js';
import { groupsRouter } from './routes/groups.js';
import { notificationsRouter } from './routes/notifications.js';
import { publicationsRouter } from './routes/publications.js';
import { peopleRouter, profileRouter, usersRouter } from './routes/users.js';
import { worksRouter } from './routes/works.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  // A publication's full text can run long; everything else stays small.
  app.use('/api/publications', express.json({ limit: '1mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'up' });
    } catch {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/people', peopleRouter);
  app.use('/api/works', worksRouter);
  app.use('/api/publications', publicationsRouter);
  app.use('/api/feed', feedRouter);
  app.use('/api/opportunities', opportunitiesRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/ads', adsRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api/announcements', announcementsRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/demo', demoRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof ZodError) {
      // First message is shown to the user; issues let forms mark each field.
      res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid request', issues: err.issues });
      return;
    }
    if (err instanceof Prisma.PrismaClientInitializationError) {
      console.error('Database unreachable:', err.message.split('\n').at(-1));
      res.status(503).json({ error: 'Tuklas can’t reach its database right now. Please try again shortly.' });
      return;
    }
    if (err instanceof UploadError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err?.type === 'entity.too.large') {
      res.status(413).json({ error: req.is('application/json') ? 'That’s too much text to save at once.' : 'That file is too large. The limit is 20 MB.' });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Request body is not valid JSON' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  };
  app.use(onError);

  return app;
}
