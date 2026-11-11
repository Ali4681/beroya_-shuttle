import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const QUERIES: Array<{ name: string; sql: string }> = [
  {
    name: 'students-list',
    sql: 'EXPLAIN SELECT id FROM "SchoolStudent" WHERE "institutionId" = $1 AND "archivedAt" IS NULL ORDER BY "fullName" LIMIT 20',
  },
  {
    name: 'trips-today',
    sql: 'EXPLAIN SELECT id FROM "ShuttleTrip" WHERE "institutionId" = $1 AND "serviceDate" = CURRENT_DATE ORDER BY "scheduledDepartureTime" LIMIT 20',
  },
  {
    name: 'notifications-log',
    sql: 'EXPLAIN SELECT id FROM "ShuttleNotification" WHERE "institutionId" = $1 ORDER BY "createdAt" DESC LIMIT 20',
  },
  {
    name: 'inbox',
    sql: 'EXPLAIN SELECT id FROM "NotificationRecipient" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 20',
  },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  const sample = '00000000-0000-0000-0000-000000000000';
  for (const query of QUERIES) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
      query.sql,
      sample,
    );
    const plan = rows.map((row) => Object.values(row)[0] ?? '').join('\n');
    const usesIndex =
      plan.includes('Index') ||
      plan.includes('Bitmap') ||
      plan.includes('Limit');
    if (!usesIndex) {
      throw new Error(`${query.name} plan is not index-backed:\n${plan}`);
    }
    console.log(`ok ${query.name}`);
    console.log(plan);
  }
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
