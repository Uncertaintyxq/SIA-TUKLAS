/**
 * Usernames — picks the public handle for a new account.
 */
import { prisma } from '../db.js';

/** A free public handle from an email's local part: "Andrea.V@tuklas.edu" → "andreav", then "andreav2", … */
export async function uniqueUsername(email: string): Promise<string> {
  const base = email.split('@')[0]!.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30) || 'user';
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? base : `${base}${n}`;
    if (!(await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } }))) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}
