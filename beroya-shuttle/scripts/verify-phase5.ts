import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';

const BASE =
  process.env.PHASE5_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? '+963900000000';
const OTP = process.env.OTP_DEV_CODE ?? '000000';
const STAMP = Date.now().toString().slice(-6);

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

function rowsOf(json: Json): Json[] {
  const data = json.data;
  if (!Array.isArray(data)) {
    throw new CheckError(`Expected data array, got ${JSON.stringify(json)}`);
  }
  return data as Json[];
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
  const adminPhone = `+9639800${STAMP}`;
  const parentPhone = `+9639811${STAMP}`;
  const otherAdminPhone = `+9639822${STAMP}`;
  const uniPhone = `+9639833${STAMP}`;

  const school = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase5 School ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'Phase5 Admin', phone: adminPhone, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('create school', school.status, 201, school.json);
  const branches = dataOf(school.json).branches as Json[] | undefined;
  const branchId = String(branches?.[0]?.id ?? '');
  if (!branchId) {
    throw new CheckError('created institution must include a default branch');
  }

  const token = await login(adminPhone);

  const unusedPoint = await request('POST', '/institution/meeting-points', {
    token,
    body: {
      name: 'Unused Gate',
      latitude: 33.51,
      longitude: 36.29,
      address_label: 'Side gate',
      branch_id: branchId,
    },
  });
  assertStatus('create unused meeting point', unusedPoint.status, 201, unusedPoint.json);
  const unusedPointId = String(dataOf(unusedPoint.json).id ?? '');

  const usedPoint = await request('POST', '/institution/meeting-points', {
    token,
    body: {
      name: 'Main Gate',
      latitude: 33.513,
      longitude: 36.276,
      address_label: 'Front gate',
      branch_id: branchId,
    },
  });
  assertStatus('create used meeting point', usedPoint.status, 201, usedPoint.json);
  const usedPointId = String(dataOf(usedPoint.json).id ?? '');

  const deleted = await request(
    'DELETE',
    `/institution/meeting-points/${unusedPointId}`,
    { token },
  );
  assertStatus('delete unused meeting point', deleted.status, 200, deleted.json);

  const studentOne = await request('POST', '/institution/students', {
    token,
    body: {
      full_name: 'Lina First',
      branch_id: branchId,
      grade: '5',
      section: 'A',
      guardian: { full_name: 'Parent One', phone: parentPhone, email: `ol2-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
      pickup: {
        pickup_type: 'HOME',
        latitude: 33.52,
        longitude: 36.3,
        address_label: 'Home',
      },
    },
  });
  assertStatus('create first student', studentOne.status, 201, studentOne.json);
  const studentOneData = dataOf(studentOne.json);
  const studentOneId = String(studentOneData.id ?? '');
  const guardian = studentOneData.guardian as Json | undefined;
  const guardianId = String(guardian?.id ?? '');
  if (!guardianId || guardian?.phone !== parentPhone) {
    throw new CheckError('first student must create a parent by phone');
  }
  if (studentOneData.phone) {
    throw new CheckError('school student must not be a login user');
  }

  const parentToken = await login(parentPhone);
  const parentMe = await request('GET', '/auth/me', { token: parentToken });
  assertStatus('parent /auth/me after first child', parentMe.status, 200, parentMe.json);
  const parentMeData = dataOf(parentMe.json);
  const firstKids = (parentMeData.students as Json[] | undefined) ?? [];
  if (parentMeData.role !== 'PARENT' || firstKids.length !== 1) {
    throw new CheckError('parent must see the first child immediately');
  }
  if (firstKids[0]?.id !== studentOneId) {
    throw new CheckError('parent /auth/me student id mismatch');
  }
  console.log('OK  parent login sees first child without a link step');

  const studentTwo = await request('POST', '/institution/students', {
    token,
    body: {
      full_name: 'Omar Second',
      branch_id: branchId,
      grade: '3',
      section: 'B',
      guardian: { full_name: 'Parent One', phone: parentPhone, email: `ol3-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
      pickup: {
        pickup_type: 'MEETING_POINT',
        meeting_point_id: usedPointId,
      },
    },
  });
  assertStatus('create second student', studentTwo.status, 201, studentTwo.json);
  const studentTwoData = dataOf(studentTwo.json);
  const studentTwoId = String(studentTwoData.id ?? '');
  const secondGuardian = studentTwoData.guardian as Json | undefined;
  if (String(secondGuardian?.id ?? '') !== guardianId) {
    throw new CheckError('second student must reuse the same parent account');
  }

  const parentMeAgain = await request('GET', '/auth/me', { token: parentToken });
  assertStatus('parent /auth/me after second child', parentMeAgain.status, 200, parentMeAgain.json);
  const kidIds = (
    (dataOf(parentMeAgain.json).students as Json[] | undefined) ?? []
  ).map((row) => row.id);
  if (!kidIds.includes(studentOneId) || !kidIds.includes(studentTwoId)) {
    throw new CheckError('same parent account must list both children');
  }
  console.log('OK  second student reuses the same parent account');

  const withoutRoute = await request(
    'GET',
    '/institution/students?without_route=true',
    { token },
  );
  assertStatus('without_route list', withoutRoute.status, 200, withoutRoute.json);
  const unassigned = rowsOf(withoutRoute.json).map((row) => row.id);
  if (!unassigned.includes(studentOneId) || !unassigned.includes(studentTwoId)) {
    throw new CheckError('without_route=true must include students with no active route');
  }
  console.log('OK  without_route=true returns unassigned students');

  const history = await request(
    'GET',
    `/institution/students/${studentOneId}/boarding-history`,
    { token },
  );
  assertStatus('boarding-history', history.status, 200, history.json);
  const events = rowsOf(history.json);
  const stamps = events.map((row) => Date.parse(String(row.occurred_at ?? '')));
  const sorted = [...stamps].sort((a, b) => b - a);
  if (stamps.some((value) => Number.isNaN(value))) {
    throw new CheckError('boarding-history rows must include occurred_at');
  }
  if (stamps.some((value, index) => value !== sorted[index])) {
    throw new CheckError('boarding-history must be newest first');
  }
  console.log('OK  boarding-history is chronological');

  const inUse = await request(
    'DELETE',
    `/institution/meeting-points/${usedPointId}`,
    { token },
  );
  assertStatus('delete linked meeting point', inUse.status, 409, inUse.json);
  if (errorCode(inUse.json) !== 'MEETING_POINT_IN_USE') {
    throw new CheckError(
      `expected MEETING_POINT_IN_USE, got ${errorCode(inUse.json)}`,
    );
  }
  console.log('OK  meeting-point delete is 409 while linked to active students');

  const missingHome = await request(
    'PATCH',
    `/institution/students/${studentTwoId}/pickup`,
    { token, body: { pickup_type: 'HOME' } },
  );
  assertStatus('home pickup without coords', missingHome.status, 400, missingHome.json);
  if (errorCode(missingHome.json) !== 'PICKUP_HOME_LOCATION_REQUIRED') {
    throw new CheckError(
      `expected PICKUP_HOME_LOCATION_REQUIRED, got ${errorCode(missingHome.json)}`,
    );
  }

  const stats = await request('GET', '/institution/students/stats', { token });
  assertStatus('student stats', stats.status, 200, stats.json);
  const studentStats = dataOf(stats.json);
  if (
    Number(studentStats.total) < 2 ||
    Number(studentStats.without_route) < 2 ||
    Number(studentStats.home_pickup) < 1 ||
    Number(studentStats.meeting_point_pickup) < 1
  ) {
    throw new CheckError(`unexpected student stats ${JSON.stringify(studentStats)}`);
  }

  const parents = await request('GET', '/institution/parents', { token });
  assertStatus('list parents', parents.status, 200, parents.json);
  const parentRow = rowsOf(parents.json).find((row) => row.id === guardianId);
  const parentKids = (parentRow?.students as Json[] | undefined) ?? [];
  if (parentKids.length !== 2) {
    throw new CheckError('parent list must show both linked students');
  }

  const uni = await request('POST', '/institution/university-students', {
    token,
    body: {
      full_name: 'Uni Student',
      phone: uniPhone,
      email: `v1-${STAMP}@verify.local`,
      password: VERIFY_PASSWORD,
      student_number: `U-${STAMP}`,
      faculty: 'Engineering',
      branch_id: branchId,
    },
  });
  assertStatus('create university student', uni.status, 201, uni.json);
  const uniData = dataOf(uni.json);
  if (String((uniData.user as Json | undefined)?.role) !== 'UNIVERSITY_STUDENT') {
    throw new CheckError('university student must own a UNIVERSITY_STUDENT user');
  }
  const uniToken = await login(uniPhone);
  const uniMe = await request('GET', '/auth/me', { token: uniToken });
  assertStatus('university /auth/me', uniMe.status, 200, uniMe.json);
  if (dataOf(uniMe.json).students !== undefined) {
    throw new CheckError('university student /auth/me must not expose school children');
  }

  const other = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase5 Other ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'Other Admin', phone: otherAdminPhone, email: `ol4-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('create other school', other.status, 201, other.json);
  const otherToken = await login(otherAdminPhone);
  const leaked = await request('GET', `/institution/students/${studentOneId}`, {
    token: otherToken,
  });
  assertStatus('cross-tenant student', leaked.status, 404, leaked.json);
  if (errorCode(leaked.json) !== 'STUDENT_NOT_FOUND') {
    throw new CheckError(
      `expected STUDENT_NOT_FOUND, got ${errorCode(leaked.json)}`,
    );
  }
  console.log('OK  tenant isolation');

  const changedPhone = `+9639844${STAMP}`;
  const parentPatch = await request('PATCH', `/institution/parents/${guardianId}`, {
    token,
    body: { phone: changedPhone },
  });
  assertStatus('change parent phone', parentPatch.status, 200, parentPatch.json);
  const staleMe = await request('GET', '/auth/me', { token: parentToken });
  assertStatus('revoked parent session', staleMe.status, 401, staleMe.json);
  const freshParent = await login(changedPhone);
  const freshMe = await request('GET', '/auth/me', { token: freshParent });
  assertStatus('parent login on new phone', freshMe.status, 200, freshMe.json);
  console.log('OK  parent phone change revokes sessions');

  console.log('Phase 5 Definition of Done passed');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
