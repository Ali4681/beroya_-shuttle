import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, RouteStatus } from '../src/generated/prisma/client';

const BASE =
  process.env.PHASE3_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? '+963900000000';
const OTP = process.env.OTP_DEV_CODE ?? '000000';
const STAMP = Date.now().toString().slice(-8);
const NAME = `Phase3 School ${STAMP}`;
const PHONE = `+9639666${STAMP.slice(-5)}`;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

type Json = Record<string, unknown>;

class CheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckError';
  }
}

async function request(
  method: string,
  path: string,
  options: { token?: string; body?: Json } = {},
): Promise<{ status: number; json: Json }> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body) {
    headers['content-type'] = 'application/json';
  }
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text ? (JSON.parse(text) as Json) : {},
  };
}

function dataOf(json: Json): Json {
  if (json.data === undefined) {
    throw new CheckError(`Expected data, got ${JSON.stringify(json)}`);
  }
  return json.data as Json;
}

function errorCode(json: Json): string {
  const error = json.error;
  if (!error || typeof error !== 'object') {
    return '';
  }
  return String((error as Json).code ?? '');
}

function assertStatus(
  label: string,
  actual: number,
  expected: number,
  json: Json,
): void {
  if (actual !== expected) {
    throw new CheckError(
      `${label}: expected HTTP ${expected}, got ${actual} ${JSON.stringify(json)}`,
    );
  }
}

async function login(phone: string): Promise<string> {
  // OTP parked — restore /auth/otp/verify with phone + OTP.
  // const verified = await request('POST', '/auth/otp/verify', {
  //   body: { phone, code: OTP },
  // });
  const email = await emailForPhone(phone);
  const verified = await request('POST', '/auth/login', {
    body: { email, password: VERIFY_PASSWORD },
  });
  assertStatus(`login ${phone}`, verified.status, 201, verified.json);
  const token = String(dataOf(verified.json).access_token ?? '');
  if (!token) {
    throw new CheckError('auth/login: missing access_token');
  }
  return token;
}

async function main(): Promise<void> {
  const beroyaToken = await login(ADMIN_PHONE);
  const created = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: NAME,
      type: 'SCHOOL',
      admin: { full_name: 'Phase3 Admin', phone: PHONE, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('create institution', created.status, 201, created.json);
  const institutionId = String(dataOf(created.json).id ?? '');

  const token = await login(PHONE);

  const profile = await request('PATCH', '/institution/profile', {
    token,
    body: {
      display_name: 'Phase 3 Display',
      address: 'Mazzeh, Damascus',
    },
  });
  assertStatus('patch profile', profile.status, 200, profile.json);

  const badBrand = await request('PATCH', '/institution/branding', {
    token,
    body: { welcome_message: '<script>x</script>', primary_color: 'blue' },
  });
  assertStatus('invalid branding', badBrand.status, 400, badBrand.json);

  const branding = await request('PATCH', '/institution/branding', {
    token,
    body: {
      use_institution_identity: true,
      primary_color: '#123456',
      welcome_message: 'Welcome to campus',
    },
  });
  assertStatus('patch branding', branding.status, 200, branding.json);

  const settings = await request('PATCH', '/institution/settings', {
    token,
    body: {
      timezone: 'Asia/Damascus',
      default_delay_threshold_minutes: 8,
    },
  });
  assertStatus('patch settings', settings.status, 200, settings.json);

  const startsAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const sub = await request(
    'POST',
    `/admin/institutions/${institutionId}/subscriptions`,
    {
      token: beroyaToken,
      body: {
        billing_period: 'MONTHLY',
        starts_at: startsAt,
        ends_at: endsAt,
        agreed_amount: 100,
      },
    },
  );
  assertStatus('create subscription', sub.status, 201, sub.json);
  const sid = String(dataOf(sub.json).id ?? '');
  await request(
    'POST',
    `/admin/institutions/${institutionId}/subscriptions/${sid}/activate`,
    { token: beroyaToken },
  );

  const subscription = await request('GET', '/institution/subscription', {
    token,
  });
  assertStatus('get subscription', subscription.status, 200, subscription.json);
  const days = dataOf(subscription.json).days_remaining;
  if (typeof days !== 'number' || days < 1) {
    throw new CheckError(`expected days_remaining, got ${String(days)}`);
  }
  console.log('OK  profile, branding, settings, subscription');

  const first = await request('POST', '/institution/branches', {
    token,
    body: {
      name: 'Baramkeh',
      address: 'Baramkeh Street',
      latitude: 33.5138,
      longitude: 36.2765,
    },
  });
  assertStatus('create branch 1', first.status, 201, first.json);
  const firstId = String(dataOf(first.json).id ?? '');

  const second = await request('POST', '/institution/branches', {
    token,
    body: {
      name: 'Mezzeh',
      address: 'Mezzeh Highway',
      latitude: 33.5031,
      longitude: 36.2562,
    },
  });
  assertStatus('create branch 2', second.status, 201, second.json);
  const secondId = String(dataOf(second.json).id ?? '');

  const bootstrap = await request('GET', '/institution/bootstrap', { token });
  assertStatus('bootstrap', bootstrap.status, 200, bootstrap.json);
  const branches = dataOf(bootstrap.json).branches as unknown[];
  if (!Array.isArray(branches) || branches.length < 3) {
    throw new CheckError(
      `bootstrap should include Main + 2 new branches, got ${branches.length}`,
    );
  }

  const stats = await request('GET', `/institution/branches/${firstId}/stats`, {
    token,
  });
  assertStatus('branch stats', stats.status, 200, stats.json);
  const counts = dataOf(stats.json).counts as Json;
  if (
    typeof counts.students !== 'number' ||
    typeof counts.routes !== 'number' ||
    typeof counts.trips_today !== 'number'
  ) {
    throw new CheckError('branch stats missing counts');
  }
  console.log('OK  two geo branches appear in bootstrap and stats');

  await prisma.shuttleRoute.create({
    data: {
      institutionId,
      branchId: secondId,
      name: `Phase3 Route ${STAMP}`,
      originLat: 33.5,
      originLng: 36.2,
      status: RouteStatus.ACTIVE,
    },
  });
  const blocked = await request('DELETE', `/institution/branches/${secondId}`, {
    token,
  });
  assertStatus('delete busy branch', blocked.status, 409, blocked.json);
  if (errorCode(blocked.json) !== 'BRANCH_NOT_EMPTY') {
    throw new CheckError(`expected BRANCH_NOT_EMPTY, got ${errorCode(blocked.json)}`);
  }
  await prisma.shuttleRoute.deleteMany({
    where: { institutionId, branchId: secondId },
  });
  const removed = await request('DELETE', `/institution/branches/${secondId}`, {
    token,
  });
  assertStatus('delete empty branch', removed.status, 200, removed.json);
  console.log('OK  BRANCH_NOT_EMPTY then soft-delete');

  const beroyaBlocked = await request('GET', '/institution/profile', {
    token: beroyaToken,
  });
  assertStatus('beroya on institution', beroyaBlocked.status, 403, beroyaBlocked.json);

  console.log('Phase 3 Definition of Done passed');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
