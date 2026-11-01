/** Account security and privacy (/api/auth/user/*, /api/account). */

/** One place this account is signed in. */
export interface AccountSession {
  /** A digest of the session, never the session id itself */
  id: string;
  ipAddress: string | null;
  userAgent: string;
  lastActiveAt: string;
  /** The browser making this request */
  current: boolean;
}

/** What an authenticator app needs to add the account. */
export interface TwoFactorKey {
  /** The QR code as SVG markup */
  svg: string;
  /** The otpauth:// address inside the QR code */
  url: string;
  /** The same secret, for typing in by hand */
  secretKey: string;
}

export interface ResetPasswordInput {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface ChangePasswordInput {
  current_password: string;
  password: string;
  password_confirmation: string;
}

/** A 2FA login is finished with a 6-digit code from the app, or one of the recovery codes. */
export type TwoFactorChallengeInput = { code: string } | { recovery_code: string };

/** Which updates also arrive by email (GET/PUT /api/account/notifications). In-app updates always arrive. */
export interface NotificationSettings {
  email: Record<string, boolean>;
  /** Push notifications, on the devices that turned them on */
  push: Record<string, boolean>;
  /** The Monday email: unread updates, this week's deadlines and events, new research in your department */
  digest: boolean;
  /** Email only goes to a confirmed address */
  emailVerified: boolean;
  categories: { key: string; label: string; description: string }[];
}

/** Push notifications on this device (GET /api/account/push) */
export interface PushStatus {
  /** The server has its push keys (on a server, deploy.sh adds them) */
  available: boolean;
  publicKey: string;
  thisDevice: boolean;
  devices: { device: string; since: string }[];
}
