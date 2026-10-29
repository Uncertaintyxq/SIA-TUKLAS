/**
 * Server environment — reads and checks the settings in server/.env at startup.
 * The server exits with a clear message if any required setting is missing or invalid.
 */
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().startsWith('mysql://'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  PORT: z.coerce.number().int().positive().default(4000),
  DEMO_MODE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Where the app is opened, for links in emails */
  APP_URL: z.string().url().default('http://localhost:5173'),
  /** e.g. smtps://user:pass@smtp.example.edu:465 — without it, emails are logged instead of sent */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Tuklas <no-reply@tuklas.edu>'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid server environment — copy server/.env.example to server/.env.\n', z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
