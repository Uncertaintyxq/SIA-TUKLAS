/**
 * Demo routes — mounted at /api/demo, with one endpoint that resets the demo data.
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { seedDemo } from '../seed.js';
import { requireAuth } from '../auth/middleware.js';
import { env } from '../env.js';
import { clearUploads } from '../lib/files.js';

export const demoRouter = Router();

// "Reset demo data" — only exists when DEMO_MODE=true. Seeded IDs are fixed, so demo
// sessions stay valid; a session for a since-deleted sign-up gets 401 on its next request.
demoRouter.post('/reset', requireAuth, async (_req, res) => {
  if (!env.DEMO_MODE) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await seedDemo(prisma);
  clearUploads();
  res.status(204).end();
});
