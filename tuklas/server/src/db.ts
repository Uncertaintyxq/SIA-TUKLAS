/**
 * Database client — the one Prisma client the whole server shares for MySQL.
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
