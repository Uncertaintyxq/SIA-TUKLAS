/**
 * Mailer — email alerts.
 * With no SMTP_URL (local development) each email is logged to the console instead of sent.
 */
import nodemailer from 'nodemailer';
import { env } from '../env.js';

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;

export function sendMail(to: string[], subject: string, text: string) {
  const recipients = [...new Set(to)].filter(Boolean);
  if (recipients.length === 0) return;
  if (!transport) {
    console.log(`[mail] Not sent (SMTP_URL is not set): “${subject}” to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`);
    return;
  }
  // Recipients go in BCC so nobody sees anyone else's address. Sending never blocks or fails the request.
  transport
    .sendMail({ from: env.MAIL_FROM, to: env.MAIL_FROM, bcc: recipients, subject, text })
    .catch((err: Error) => console.error('Email failed:', err.message));
}
