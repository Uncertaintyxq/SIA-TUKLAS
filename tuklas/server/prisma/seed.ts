import { PrismaClient } from '@prisma/client';
import { seedDemo, DEMO_PASSWORD } from '../src/seed.js';

const prisma = new PrismaClient();

try {
  await seedDemo(prisma);
  const users = await prisma.user.count();
  const works = await prisma.work.count();
  console.log(`Seeded ${users} users and ${works} works. Password for all demo accounts: ${DEMO_PASSWORD}`);
} finally {
  await prisma.$disconnect();
}
