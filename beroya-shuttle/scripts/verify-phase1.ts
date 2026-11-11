import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';
import { hashPassword } from '../src/common/utils/password';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  InstitutionStatus,
  InstitutionType,
  PrismaClient,
  ShuttleRole,
  UserStatus,
} from '../src/generated/prisma/client';

const BASE =
  process.env.PHASE1_VERIFY_BASE ??
  'http://127.0.0.1:3001/api/v1/shuttle';
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? '+963900000000';
const OTP = process.env.OTP_DEV_CODE ?? '000000';
const FIXTURE_PHONE = '+963900000001';
const FIXTURE_NAME = 'Phase1 Suspended Fixture';

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
  const headers: Record<string, string> = {
    accept: 'application/json',
  };
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
    const cause =
      error instanceof Error && 'cause' in error
        ? ` (${String((error as Error & { cause?: unknown }).cause)})`
        : '';
    throw new CheckError(
      `fetch ${method} ${path} failed: ${error instanceof Error ? error.message : error}${cause}`,
    );
  }

  const text = await response.text();
  let json: Json = {};
  if (text) {
    json = JSON.parse(text) as Json;
  }
  return { status: response.status, json };
}

function dataOf(json: Json): Json {
  const data = json.data;
  if (!data || typeof data !== 'object') {
    throw new CheckError(`Expected data object, got ${JSON.stringify(json)}`);
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

async function cleanupFixture(): Promise<void> {
  await prisma.shuttleUser.deleteMany({ where: { phone: FIXTURE_PHONE } });
  await prisma.institution.deleteMany({ where: { name: FIXTURE_NAME } });
}

async function seedSuspendedInstitution(): Promise<void> {
  await cleanupFixture();
  await prisma.institution.create({
    data: {
      name: FIXTURE_NAME,
      type: InstitutionType.SCHOOL,
      status: InstitutionStatus.SUSPENDED,
      members: {
        create: {
          fullName: 'Suspended Institution Admin',
          phone: FIXTURE_PHONE,
          email: 'suspended-fixture@verify.local',
          passwordHash: await hashPassword(VERIFY_PASSWORD),
          role: ShuttleRole.INSTITUTION_ADMIN,
          status: UserStatus.ACTIVE,
        },
      },
    },
  });
}

async function loginAdmin(_includeRequest: boolean): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  // OTP parked — restore /auth/otp/request + /auth/otp/verify with ADMIN_PHONE + OTP.
  // if (includeRequest) {
  //   const requested = await request('POST', '/auth/otp/request', {
  //     body: { phone: ADMIN_PHONE },
  //   });
  //   assertStatus('otp/request', requested.status, 201, requested.json);
  // }
  // const verified = await request('POST', '/auth/otp/verify', {
  //   body: { phone: ADMIN_PHONE, code: OTP },
  // });
  const email = await emailForPhone(ADMIN_PHONE);
  const verified = await request('POST', '/auth/login', {
    body: { email, password: VERIFY_PASSWORD },
  });
  assertStatus('auth/login', verified.status, 201, verified.json);
  const data = dataOf(verified.json);
  const accessToken = String(data.access_token ?? '');
  const refreshToken = String(data.refresh_token ?? '');
  if (!accessToken || !refreshToken) {
    throw new CheckError('auth/login: missing tokens');
  }
  return { accessToken, refreshToken };
}

async function runCycle(): Promise<void> {
  const first = await loginAdmin(true);

  const me = await request('GET', '/auth/me', { token: first.accessToken });
  assertStatus('auth/me', me.status, 200, me.json);
  if (dataOf(me.json).role !== 'BEROYA_ADMIN') {
    throw new CheckError('auth/me: expected BEROYA_ADMIN');
  }

  const admin = await request('GET', '/admin/bootstrap', {
    token: first.accessToken,
  });
  assertStatus('admin/bootstrap', admin.status, 200, admin.json);

  const institution = await request('GET', '/institution/bootstrap', {
    token: first.accessToken,
  });
  assertStatus('institution/bootstrap role', institution.status, 403, institution.json);

  const rotated = await request('POST', '/auth/refresh', {
    body: { refresh_token: first.refreshToken },
  });
  assertStatus('auth/refresh rotation', rotated.status, 201, rotated.json);
  const rotatedData = dataOf(rotated.json);
  const access2 = String(rotatedData.access_token ?? '');
  const refresh2 = String(rotatedData.refresh_token ?? '');
  if (!access2 || !refresh2 || access2 === first.accessToken) {
    throw new CheckError('auth/refresh: tokens were not rotated');
  }

  const meAfterRotate = await request('GET', '/auth/me', { token: access2 });
  assertStatus('auth/me after rotate', meAfterRotate.status, 200, meAfterRotate.json);

  const oldAccess = await request('GET', '/auth/me', {
    token: first.accessToken,
  });
  assertStatus('old access after rotate', oldAccess.status, 401, oldAccess.json);
  assertCode('old access after rotate', oldAccess.json, 'SESSION_REVOKED');

  const logout = await request('POST', '/auth/logout', { token: access2 });
  assertStatus('auth/logout', logout.status, 201, logout.json);

  const afterLogout = await request('GET', '/auth/me', { token: access2 });
  assertStatus('auth/me after logout', afterLogout.status, 401, afterLogout.json);
  assertCode('auth/me after logout', afterLogout.json, 'SESSION_REVOKED');

  console.log('OK  cycle: login → me → refresh rotation → logout');
}

async function runRefreshReuse(): Promise<void> {
  const first = await loginAdmin(false);
  const rotated = await request('POST', '/auth/refresh', {
    body: { refresh_token: first.refreshToken },
  });
  assertStatus('reuse setup refresh', rotated.status, 201, rotated.json);
  const access2 = String(dataOf(rotated.json).access_token ?? '');
  const refresh2 = String(dataOf(rotated.json).refresh_token ?? '');

  const reused = await request('POST', '/auth/refresh', {
    body: { refresh_token: first.refreshToken },
  });
  assertStatus('refresh reuse', reused.status, 401, reused.json);
  assertCode('refresh reuse', reused.json, 'REFRESH_TOKEN_REUSED');

  const revokedAccess = await request('GET', '/auth/me', { token: access2 });
  assertStatus('access after reuse', revokedAccess.status, 401, revokedAccess.json);
  assertCode('access after reuse', revokedAccess.json, 'SESSION_REVOKED');

  const newRefresh = await request('POST', '/auth/refresh', {
    body: { refresh_token: refresh2 },
  });
  assertStatus('new refresh after reuse', newRefresh.status, 401, newRefresh.json);

  console.log('OK  refresh reuse revokes every session');
}

async function runSuspendedInstitution(): Promise<void> {
  await seedSuspendedInstitution();
  try {
    // OTP parked — restore POST /auth/otp/request for this fixture phone.
    // const requested = await request('POST', '/auth/otp/request', {
    //   body: { phone: FIXTURE_PHONE },
    // });
    const requested = await request('POST', '/auth/login', {
      body: {
        email: 'suspended-fixture@verify.local',
        password: VERIFY_PASSWORD,
      },
    });
    assertStatus(
      'suspended institution login',
      requested.status,
      403,
      requested.json,
    );
    assertCode(
      'suspended institution login',
      requested.json,
      'INSTITUTION_SUSPENDED',
    );
    console.log('OK  suspended institution cannot sign in');
  } finally {
    await cleanupFixture();
  }
}

async function main(): Promise<void> {
  const checks = [runCycle, runRefreshReuse, runSuspendedInstitution];
  for (const check of checks) {
    await check();
  }
  console.log('Phase 1 Definition of Done passed');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
