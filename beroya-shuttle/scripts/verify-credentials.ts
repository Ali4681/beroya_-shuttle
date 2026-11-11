import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

export const VERIFY_PASSWORD =
  process.env.SEED_DEMO_PASSWORD ??
  process.env.SEED_ADMIN_PASSWORD ??
  'BeroyaAdmin1';
export const SEED_ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL ?? 'admin@beroya.local';
export const SEED_ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? '+963900000000';

let prisma: PrismaClient | undefined;

function db(): PrismaClient {
  if (!prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is required');
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }
  return prisma;
}

export function creds(fullName: string, phone: string, email: string) {
  return {
    full_name: fullName,
    phone,
    email,
    password: VERIFY_PASSWORD,
  };
}

export async function emailForPhone(phone: string): Promise<string> {
  if (phone === SEED_ADMIN_PHONE) {
    return SEED_ADMIN_EMAIL;
  }
  const user = await db().shuttleUser.findFirst({
    where: { phone, archivedAt: null },
    select: { email: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!user?.email) {
    throw new Error(`no email for phone ${phone}`);
  }
  return user.email;
}
