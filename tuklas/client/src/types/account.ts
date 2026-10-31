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
