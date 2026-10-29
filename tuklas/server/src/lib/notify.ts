/**
 * Notify — writes in-app notifications and pushes them to open tabs.
 * Routes call notify() for named users and notifyAdmins() for the admin team; the actor never notifies themselves.
 */
import { prisma } from '../db.js';
import { pushTo } from '../realtime.js';

/**
 * Notification types, so the client can pick an icon:
 * work_submitted, work_resubmitted, work_under_review, work_revision, work_approved, work_rejected,
 * work_comment, work_removed, educator_signup, educator_verified, educator_rights, event_proposed, event_approved,
 * event_rejected, event_cancelled, ad_requested, ad_approved, ad_rejected, honor_claimed, honor_verified, honor_declined,
 * group_added, group_role, group_deadline, opportunity_application, announcement.
 */
export async function notify(userIds: number | number[], type: string, message: string, link: string, actorId?: number) {
  const ids = [...new Set([userIds].flat())].filter((id) => id !== actorId);
  if (ids.length === 0) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, type, message: message.slice(0, 300), link })),
  });
  // Open tabs refresh their updates (and announcements) right away.
  pushTo(ids, { type: 'notification', kind: type });
}

/** Notifies every admin account, skipping the actor. */
export async function notifyAdmins(type: string, message: string, link: string, actorId?: number) {
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
  await notify(
    admins.map((a) => a.id),
    type,
    message,
    link,
    actorId,
  );
}
