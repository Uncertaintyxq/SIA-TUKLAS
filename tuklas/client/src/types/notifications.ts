/** The bell (/api/notifications). */

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
