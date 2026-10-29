/**
 * Notification schemas — validate the mark-as-read request for notifications.
 * Exports NotificationView and NotificationsResponse for the client bell and list.
 */
import { z } from 'zod';

export const readSchema = z.object({ ids: z.array(z.number().int().positive()).max(200).optional() });

export interface NotificationView {
  id: number;
  type: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationView[];
  unread: number;
}
