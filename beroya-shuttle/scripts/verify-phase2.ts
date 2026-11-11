import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  InstitutionType,
  OperationModel,
  PrismaClient,
  SubscriptionStatus,
} from '../src/generated/prisma/client';

const BASE =
  process.env.PHASE2_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? '+963900000000';
const OTP = process.env.OTP_DEV_CODE ?? '000000';
const BENCH_PREFIX = 'Phase2 Bench';
const STAMP = Date.now().toString().slice(-8);
const DEMO_NAME = `Phase2 Demo ${STAMP}`;
const DEMO_PHONE = `+9639333${STAMP.slice(-5)}`;
const NEXT_ADMIN_PHONE = `+9639444${STAMP.slice(-5)}`;
const THIRD_ADMIN_PHONE = `+9639555${STAMP.slice(-5)}`;

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

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw new CheckError(
      `fetch ${method} ${path} failed: ${error instanceof Error ? error.message : error}`,
    );
  }

  const text = await response.text();
  return {
    status: response.status,
    json: text ? (JSON.parse(text) as Json) : {},
  };
}

function dataOf(json: Json): Json {
  const data = json.data;
  if (data === undefined) {
    throw new CheckError(`Expected data, got ${JSON.stringify(json)}`);
  }
  return data as Json;
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

function assertCode(label: string, json: Json, expected: string): void {
  const code = errorCode(json);
  if (code !== expected) {
    throw new CheckError(
      `${label}: expected ${expected}, got ${code || JSON.stringify(json)}`,
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

async function cleanupBench(): Promise<void> {
  const benches = await prisma.institution.findMany({
    where: { name: { startsWith: BENCH_PREFIX } },
    select: { id: true },
  });
  if (benches.length === 0) {
    return;
  }
  const ids = benches.map((item) => item.id);
  await prisma.shuttleUser.deleteMany({
    where: { institutionId: { in: ids } },
  });
  await prisma.institution.deleteMany({ where: { id: { in: ids } } });
}

async function seedBenchInstitutions(count: number): Promise<void> {
  await cleanupBench();
  const batchSize = 100;
  for (let offset = 0; offset < count; offset += batchSize) {
    const size = Math.min(batchSize, count - offset);
    const created = await prisma.institution.createManyAndReturn({
      data: Array.from({ length: size }, (_, index) => ({
        name: `${BENCH_PREFIX} ${offset + index + 1}`,
        type:
          (offset + index) % 3 === 0
            ? InstitutionType.SCHOOL
            : (offset + index) % 3 === 1
              ? InstitutionType.UNIVERSITY
              : InstitutionType.COMPANY,
        operationModel:
          (offset + index) % 2 === 0
            ? OperationModel.INSTITUTION_OPERATED
            : OperationModel.BEROYA_OPERATED,
      })),
    });
    await prisma.institutionSettings.createMany({
      data: created.map((item) => ({ institutionId: item.id })),
    });
    await prisma.institutionBranding.createMany({
      data: created.map((item) => ({ institutionId: item.id })),
    });
  }
}

async function main(): Promise<void> {
  const adminToken = await login(ADMIN_PHONE);

  const created = await request('POST', '/admin/institutions', {
    token: adminToken,
    body: {
      name: DEMO_NAME,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      contact_phone: DEMO_PHONE,
      admin: {
        full_name: 'Phase2 Institution Admin',
        phone: DEMO_PHONE,
        email: `v1-${STAMP}@verify.local`,
        password: VERIFY_PASSWORD,
      },
      default_branch: { name: 'Main Campus' },
    },
  });
  assertStatus('create institution', created.status, 201, created.json);
  const institution = dataOf(created.json);
  const institutionId = String(institution.id ?? '');
  if (!institutionId || !institution.settings || !institution.branding) {
    throw new CheckError('create institution: missing bootstrap fields');
  }
  const branches = institution.branches as unknown[];
  if (!Array.isArray(branches) || branches.length !== 1) {
    throw new CheckError('create institution: expected one default branch');
  }
  console.log(`OK  created institution ${institutionId}`);

  const institutionAdminToken = await login(DEMO_PHONE);
  const bootstrap = await request('GET', '/institution/bootstrap', {
    token: institutionAdminToken,
  });
  assertStatus('institution/bootstrap', bootstrap.status, 200, bootstrap.json);
  const boot = dataOf(bootstrap.json);
  if (boot.institution == null || boot.settings == null || boot.branding == null) {
    throw new CheckError('institution/bootstrap: incomplete payload');
  }
  console.log('OK  institution admin can login and bootstrap');

  const startsAt = new Date(Date.now() + 60_000).toISOString();
  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const laterEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const subscription = await request(
    'POST',
    `/admin/institutions/${institutionId}/subscriptions`,
    {
      token: adminToken,
      body: {
        billing_period: 'MONTHLY',
        starts_at: startsAt,
        ends_at: endsAt,
        agreed_amount: 250,
        currency_code: 'USD',
      },
    },
  );
  assertStatus('create subscription', subscription.status, 201, subscription.json);
  const subscriptionId = String(dataOf(subscription.json).id ?? '');

  const activated = await request(
    'POST',
    `/admin/institutions/${institutionId}/subscriptions/${subscriptionId}/activate`,
    { token: adminToken },
  );
  assertStatus('activate subscription', activated.status, 201, activated.json);

  const overlap = await request(
    'POST',
    `/admin/institutions/${institutionId}/subscriptions`,
    {
      token: adminToken,
      body: {
        billing_period: 'MONTHLY',
        starts_at: startsAt,
        ends_at: laterEnd,
        agreed_amount: 300,
      },
    },
  );
  assertStatus('overlap create', overlap.status, 201, overlap.json);
  const overlapId = String(dataOf(overlap.json).id ?? '');
  const overlapActivate = await request(
    'POST',
    `/admin/institutions/${institutionId}/subscriptions/${overlapId}/activate`,
    { token: adminToken },
  );
  assertStatus('overlap activate', overlapActivate.status, 409, overlapActivate.json);
  assertCode('overlap activate', overlapActivate.json, 'SUBSCRIPTION_OVERLAP');

  const extended = await request(
    'POST',
    `/admin/institutions/${institutionId}/subscriptions/${subscriptionId}/extend`,
    { token: adminToken, body: { new_end_date: laterEnd } },
  );
  assertStatus('extend subscription', extended.status, 201, extended.json);

  const cancelled = await request(
    'POST',
    `/admin/institutions/${institutionId}/subscriptions/${overlapId}/cancel`,
    { token: adminToken, body: { reason: 'overlap leftover' } },
  );
  assertStatus('cancel subscription', cancelled.status, 201, cancelled.json);

  await prisma.institutionSubscription.update({
    where: { id: subscriptionId },
    data: { endsAt: new Date(Date.now() - 60_000) },
  });
  const afterExpire = await request(
    'GET',
    `/admin/institutions/${institutionId}/subscriptions`,
    { token: adminToken },
  );
  assertStatus('list after expire', afterExpire.status, 200, afterExpire.json);
  const expiredRows = afterExpire.json.data as Array<Json>;
  const expired = expiredRows.find((row) => row.id === subscriptionId);
  if (!expired || expired.status !== SubscriptionStatus.EXPIRED) {
    throw new CheckError(
      `expected subscription ${subscriptionId} to expire, got ${JSON.stringify(expired)}`,
    );
  }
  console.log('OK  subscription activate / overlap / extend / cancel / expire');

  const branding = await request(
    'PATCH',
    `/admin/institutions/${institutionId}/branding`,
    {
      token: adminToken,
      body: {
        use_institution_identity: true,
        primary_color: '#1F4E79',
        welcome_message: 'Welcome to Phase 2',
      },
    },
  );
  assertStatus('patch branding', branding.status, 200, branding.json);

  const settings = await request(
    'PATCH',
    `/admin/institutions/${institutionId}/settings`,
    {
      token: adminToken,
      body: { timezone: 'Asia/Damascus', default_delay_threshold_minutes: 12 },
    },
  );
  assertStatus('patch settings', settings.status, 200, settings.json);

  const listed = await request(
    'GET',
    `/admin/institutions?search=${encodeURIComponent(DEMO_NAME)}&type=SCHOOL&page=1&limit=20`,
    { token: adminToken },
  );
  assertStatus('list institutions', listed.status, 200, listed.json);
  const meta = listed.json.meta as Json | undefined;
  if (!meta || typeof meta.total !== 'number') {
    throw new CheckError('list institutions: missing meta');
  }

  const auditCount = await prisma.shuttleAuditLog.count({
    where: { institutionId, entityType: 'Institution' },
  });
  if (auditCount < 1) {
    throw new CheckError('missing institution audit rows');
  }
  console.log('OK  branding, settings, filters, and audit');

  const suspended = await request(
    'PATCH',
    `/admin/institutions/${institutionId}/status`,
    {
      token: adminToken,
      body: { status: 'SUSPENDED', reason: 'phase 2 verify' },
    },
  );
  assertStatus('suspend institution', suspended.status, 200, suspended.json);

  const blocked = await request('POST', '/auth/login', {
    body: { email: `v1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  // OTP parked — restore POST /auth/otp/request with DEMO_PHONE.
  // const blocked = await request('POST', '/auth/otp/request', {
  //   body: { phone: DEMO_PHONE },
  // });
  assertStatus('suspended login', blocked.status, 403, blocked.json);
  assertCode('suspended login', blocked.json, 'INSTITUTION_SUSPENDED');

  await request('PATCH', `/admin/institutions/${institutionId}/status`, {
    token: adminToken,
    body: { status: 'ACTIVE' },
  });
  console.log('OK  suspended institution cannot sign in');

  const changed = await request(
    'POST',
    `/admin/institutions/${institutionId}/change-admin`,
    {
      token: adminToken,
      body: {
        full_name: 'Phase2 Next Admin',
        phone: NEXT_ADMIN_PHONE,
        email: `v2-${STAMP}@verify.local`,
        password: VERIFY_PASSWORD,
      },
    },
  );
  assertStatus('change-admin', changed.status, 201, changed.json);
  const newPrimary = dataOf(changed.json).primary_admin as Json;
  if (newPrimary.phone !== NEXT_ADMIN_PHONE) {
    throw new CheckError('change-admin: primary admin phone was not replaced');
  }

  const oldAdminBlocked = await request('POST', '/auth/login', {
    body: { email: `v1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  // OTP parked — restore POST /auth/otp/verify with DEMO_PHONE + OTP.
  // const oldAdminBlocked = await request('POST', '/auth/otp/verify', {
  //   body: { phone: DEMO_PHONE, code: OTP },
  // });
  assertStatus('old admin login', oldAdminBlocked.status, 403, oldAdminBlocked.json);
  assertCode('old admin login', oldAdminBlocked.json, 'USER_SUSPENDED');

  const nextAdminToken = await login(NEXT_ADMIN_PHONE);
  const nextBootstrap = await request('GET', '/institution/bootstrap', {
    token: nextAdminToken,
  });
  assertStatus('new admin bootstrap', nextBootstrap.status, 200, nextBootstrap.json);

  const kept = await request(
    'POST',
    `/admin/institutions/${institutionId}/change-admin`,
    {
      token: adminToken,
      body: {
        full_name: 'Phase2 Third Admin',
        phone: THIRD_ADMIN_PHONE,
        email: `v3-${STAMP}@verify.local`,
        password: VERIFY_PASSWORD,
        keep_old_as_operator: true,
      },
    },
  );
  assertStatus('change-admin keep operator', kept.status, 201, kept.json);
  const keptUser = await prisma.shuttleUser.findFirst({
    where: { phone: NEXT_ADMIN_PHONE, institutionId },
  });
  if (!keptUser || keptUser.status !== 'ACTIVE') {
    throw new CheckError('change-admin: previous admin should stay ACTIVE');
  }
  const adminAudit = await prisma.shuttleAuditLog.count({
    where: { institutionId, action: 'INSTITUTION_ADMIN_CHANGED' },
  });
  if (adminAudit < 2) {
    throw new CheckError('change-admin: missing audit rows');
  }
  console.log('OK  change-admin suspends old admin or keeps them as operator');

  await seedBenchInstitutions(500);
  const started = Date.now();
  const bench = await request(
    'GET',
    '/admin/institutions?type=SCHOOL&operation_model=INSTITUTION_OPERATED&page=1&limit=20',
    { token: adminToken },
  );
  const elapsed = Date.now() - started;
  assertStatus('bench list', bench.status, 200, bench.json);
  const benchMeta = bench.json.meta as Json;
  if (typeof benchMeta.total !== 'number' || benchMeta.total < 20) {
    throw new CheckError('bench list: expected a large filtered total');
  }
  if (elapsed > 2000) {
    throw new CheckError(`bench list took ${elapsed}ms (limit 2000ms)`);
  }
  await cleanupBench();
  console.log(`OK  filtered pagination over 500 institutions in ${elapsed}ms`);

  console.log(`Phase 2 Definition of Done passed (demo institution: ${DEMO_NAME})`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
