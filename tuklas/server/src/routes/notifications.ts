/**
 * Notifications routes — the signed-in user's notifications at /api/notifications.
 * Lists the latest 30 with an unread count, and marks them read.
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { readSchema, type NotificationsResponse } from '../schemas/notifications.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const me = req.user!;
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.notification.count({ where: { userId: me.id, read: false } }),
  ]);
  const body: NotificationsResponse = {
    items: items.map(({ id, type, message, link, read, createdAt }) => ({ id, type, message, link, read, createdAt: createdAt.toISOString() })),
    unread,
  };
  res.json(body);
});

/** Marks the given notifications read, or all of them. */
notificationsRouter.post('/read', async (req, res) => {
  const { ids } = readSchema.parse(req.body ?? {});
  await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false, ...(ids ? { id: { in: ids } } : {}) }, data: { read: true } });
  res.status(204).end();
});
