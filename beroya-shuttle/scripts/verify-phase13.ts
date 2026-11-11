import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';
import { randomUUID } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const BASE =
  process.env.PHASE13_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
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

function prismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new CheckError('DATABASE_URL is required');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

async function request(
  method: string,
  path: string,
  options: { token?: string; body?: Json } = {},
): Promise<{ status: number; json: Json; ms: number }> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body) {
    headers['content-type'] = 'application/json';
  }
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }
  const started = Date.now();
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text ? (JSON.parse(text) as Json) : {},
    ms: Date.now() - started,
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
    throw new CheckError(`Expected a list, got ${JSON.stringify(json)}`);
  }
  return data as Json[];
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

function assertLt(label: string, actual: number, max: number): void {
  if (actual >= max) {
    throw new CheckError(`${label}: ${actual}ms >= ${max}ms`);
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

function todayInDamascus(): Date {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Damascus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${key}T00:00:00.000Z`);
}

async function activateInstitution(
  beroyaToken: string,
  institutionId: string,
  endsInDays: number,
): Promise<void> {
  const starts = new Date();
  const ends = new Date(starts.getTime() + endsInDays * 24 * 60 * 60 * 1000);
  const subscription = await request(
    'POST',
    `/admin/institutions/${institutionId}/subscriptions`,
    {
      token: beroyaToken,
      body: {
        billing_period: 'MONTHLY',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        agreed_amount: 200,
      },
    },
  );
  assertStatus('subscription', subscription.status, 201, subscription.json);
  assertStatus(
    'activate',
    (
      await request(
        'POST',
        `/admin/institutions/${institutionId}/subscriptions/${dataOf(subscription.json).id}/activate`,
        { token: beroyaToken },
      )
    ).status,
    201,
    {},
  );
}

async function createInstitution(
  beroyaToken: string,
  body: Json,
): Promise<Json> {
  const created = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body,
  });
  assertStatus(`create ${String(body.name)}`, created.status, 201, created.json);
  return dataOf(created.json);
}

async function seedLoad(
  prisma: PrismaClient,
  args: {
    institutionId: string;
    branchId: string;
    adminUserId: string;
    stamp: string;
  },
): Promise<{ routeId: string; studentCount: number; routeCount: number }> {
  const parent = await prisma.shuttleUser.create({
    data: {
      fullName: 'Bulk Guardian',
      phone: `+9639810${args.stamp}`,
      role: 'PARENT',
      institutionId: args.institutionId,
      branchId: args.branchId,
    },
  });

  const now = new Date();
  const studentRows = Array.from({ length: 2000 }, (_, index) => ({
    id: randomUUID(),
    institutionId: args.institutionId,
    branchId: args.branchId,
    fullName: `Bulk Student ${String(index + 1).padStart(4, '0')}`,
    guardianUserId: parent.id,
    grade: String(1 + (index % 12)),
    createdAt: now,
    updatedAt: now,
  }));
  for (let offset = 0; offset < studentRows.length; offset += 500) {
    await prisma.schoolStudent.createMany({
      data: studentRows.slice(offset, offset + 500),
    });
  }

  const routeRows = Array.from({ length: 40 }, (_, index) => ({
    id: randomUUID(),
    institutionId: args.institutionId,
    branchId: args.branchId,
    name: `Phase13 Bulk Route ${String(index + 1).padStart(2, '0')}`,
    originLat: 33.51,
    originLng: 36.27,
    createdAt: now,
    updatedAt: now,
  }));
  await prisma.shuttleRoute.createMany({ data: routeRows });

  const ahmadParent = await prisma.shuttleUser.create({
    data: {
      fullName: 'Ahmed Guardian',
      phone: `+9639811${args.stamp}`,
      role: 'PARENT',
      institutionId: args.institutionId,
      branchId: args.branchId,
    },
  });
  await prisma.schoolStudent.create({
    data: {
      institutionId: args.institutionId,
      branchId: args.branchId,
      fullName: 'Ahmad Phase13',
      guardianUserId: ahmadParent.id,
      grade: '5',
    },
  });
  const ahmadRoute = await prisma.shuttleRoute.create({
    data: {
      institutionId: args.institutionId,
      branchId: args.branchId,
      name: 'Ahmad Line',
      originLat: 33.505,
      originLng: 36.271,
    },
  });
  const ahmadDriverUser = await prisma.shuttleUser.create({
    data: {
      fullName: 'Ahmad Driver',
      phone: `+9639812${args.stamp}`,
      role: 'DRIVER',
      institutionId: args.institutionId,
      branchId: args.branchId,
    },
  });
  await prisma.driverProfile.create({
    data: {
      userId: ahmadDriverUser.id,
      institutionId: args.institutionId,
      ownerType: 'INSTITUTION',
    },
  });
  await prisma.shuttleVehicle.create({
    data: {
      institutionId: args.institutionId,
      ownerType: 'INSTITUTION',
      plateNumber: `AHM-${args.stamp}`,
      capacity: 30,
    },
  });

  const today = todayInDamascus();
  const tripSpecs: Array<{
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
    delayMinutes: number;
    delayDetectedAt: Date | null;
  }> = [
    ...Array.from({ length: 5 }, () => ({
      status: 'SCHEDULED' as const,
      delayMinutes: 0,
      delayDetectedAt: null,
    })),
    { status: 'IN_PROGRESS', delayMinutes: 12, delayDetectedAt: new Date() },
    { status: 'IN_PROGRESS', delayMinutes: 0, delayDetectedAt: null },
    { status: 'IN_PROGRESS', delayMinutes: 0, delayDetectedAt: null },
    { status: 'COMPLETED', delayMinutes: 0, delayDetectedAt: null },
    { status: 'COMPLETED', delayMinutes: 0, delayDetectedAt: null },
  ];

  const trips = [];
  for (let index = 0; index < tripSpecs.length; index += 1) {
    const spec = tripSpecs[index];
    trips.push(
      await prisma.shuttleTrip.create({
        data: {
          institutionId: args.institutionId,
          branchId: args.branchId,
          routeId: routeRows[index].id,
          direction: 'OUTBOUND',
          status: spec.status,
          serviceDate: today,
          scheduledDepartureTime: '07:00',
          originLat: 33.51,
          originLng: 36.27,
          delayThresholdMinutes: 10,
          delayMinutes: spec.delayMinutes,
          delayDetectedAt: spec.delayDetectedAt,
          startedAt: spec.status === 'SCHEDULED' ? null : new Date(),
          completedAt: spec.status === 'COMPLETED' ? new Date() : null,
        },
      }),
    );
  }

  await prisma.tripIncident.create({
    data: {
      tripId: trips[5].id,
      type: 'BREAKDOWN',
      reportedByUserId: args.adminUserId,
      description: 'Phase13 open incident',
    },
  });

  return {
    routeId: ahmadRoute.id,
    studentCount: 2001,
    routeCount: 41,
  };
}

async function main(): Promise<void> {
  const prisma = prismaClient();
  const beroyaToken = await login(ADMIN_PHONE);
  const adminPhone = `+9639850${STAMP}`;
  const otherPhone = `+9639851${STAMP}`;

  const hybrid = await createInstitution(beroyaToken, {
    name: `Ahmad Phase13 School ${STAMP}`,
    type: 'SCHOOL',
    operation_model: 'HYBRID',
    admin: { full_name: 'Phase13 Admin', phone: adminPhone, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  const operated = await createInstitution(beroyaToken, {
    name: `Phase13 Operated ${STAMP}`,
    type: 'SCHOOL',
    operation_model: 'INSTITUTION_OPERATED',
    admin: { full_name: 'Operated Admin', phone: otherPhone, email: `ol2-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });

  const institutionId = String(hybrid.id ?? '');
  const operatedId = String(operated.id ?? '');
  const branchId = String(
    (hybrid.branches as Json[] | undefined)?.[0]?.id ?? '',
  );
  if (!institutionId || !branchId) {
    throw new CheckError('hybrid institution must include a default branch');
  }
  const adminUser = await prisma.shuttleUser.findFirst({
    where: { phone: adminPhone, institutionId },
  });
  const adminUserId = adminUser?.id ?? '';
  if (!adminUserId) {
    throw new CheckError('hybrid institution admin user not found');
  }

  await activateInstitution(beroyaToken, institutionId, 10);
  await activateInstitution(beroyaToken, operatedId, 40);

  const token = await login(adminPhone);
  const seeded = await seedLoad(prisma, {
    institutionId,
    branchId,
    adminUserId,
    stamp: STAMP,
  });

  const summary = await request('GET', '/institution/dashboard/summary', {
    token,
  });
  assertStatus('institution summary', summary.status, 200, summary.json);
  assertLt('institution summary latency', summary.ms, 200);
  const summaryData = dataOf(summary.json);
  for (const field of [
    'today_trips',
    'scheduled',
    'in_progress',
    'completed',
    'delayed',
    'open_incidents',
  ]) {
    if (typeof summaryData[field] !== 'number') {
      throw new CheckError(`summary missing ${field}`);
    }
  }
  if (summaryData.today_trips !== 10) {
    throw new CheckError(`today_trips expected 10, got ${summaryData.today_trips}`);
  }
  if (summaryData.scheduled !== 5 || summaryData.in_progress !== 3) {
    throw new CheckError(
      `status buckets scheduled=${summaryData.scheduled} in_progress=${summaryData.in_progress}`,
    );
  }
  if (summaryData.completed !== 2 || summaryData.delayed !== 1) {
    throw new CheckError(
      `completed=${summaryData.completed} delayed=${summaryData.delayed}`,
    );
  }
  if (summaryData.open_incidents !== 1) {
    throw new CheckError(`open_incidents=${summaryData.open_incidents}`);
  }

  const byBranch = await request(
    'GET',
    `/institution/dashboard/summary?branch_id=${branchId}`,
    { token },
  );
  assertStatus('summary branch filter', byBranch.status, 200, byBranch.json);
  if (dataOf(byBranch.json).today_trips !== 10) {
    throw new CheckError('branch-filtered summary should match today_trips');
  }

  for (const path of [
    '/institution/dashboard/attention',
    '/institution/dashboard/live-trips',
    '/institution/dashboard/live-map',
  ]) {
    const existing = await request('GET', path, { token });
    assertStatus(path, existing.status, 200, existing.json);
  }

  const search = await request('GET', '/institution/search?q=ahm&limit=10', {
    token,
  });
  assertStatus('institution search', search.status, 200, search.json);
  assertLt('institution search latency', search.ms, 300);
  const groups = dataOf(search.json);
  const expectedGroups = ['students', 'parents', 'routes', 'drivers', 'vehicles'];
  for (const group of expectedGroups) {
    const rows = groups[group];
    if (!Array.isArray(rows) || rows.length < 1) {
      throw new CheckError(`search ${group} empty: ${JSON.stringify(groups)}`);
    }
  }
  const studentHit = (groups.students as Json[]).some((row) =>
    String(row.full_name ?? '').toLowerCase().includes('ahm'),
  );
  const routeHit = (groups.routes as Json[]).some(
    (row) => String(row.name ?? '') === 'Ahmad Line',
  );
  const plateHit = (groups.vehicles as Json[]).some((row) =>
    String(row.plate_number ?? '').startsWith('AHM-'),
  );
  if (!studentHit || !routeHit || !plateHit) {
    throw new CheckError(`search hits missing: ${JSON.stringify(groups)}`);
  }

  const patched = await request('PATCH', `/institution/routes/${seeded.routeId}`, {
    token,
    body: { origin_label: 'Ahmad Depot Updated' },
  });
  assertStatus('patch route', patched.status, 200, patched.json);

  const audit = await request(
    'GET',
    '/institution/audit-logs?action=ROUTE_UPDATED&entity_type=ShuttleRoute&limit=20',
    { token },
  );
  assertStatus('institution audit list', audit.status, 200, audit.json);
  const auditRows = rowsOf(audit.json);
  const routeEdit = auditRows.find(
    (row) =>
      row.action === 'ROUTE_UPDATED' &&
      row.entity_id === seeded.routeId &&
      row.before &&
      row.after,
  );
  if (!routeEdit) {
    throw new CheckError(`ROUTE_UPDATED before/after missing: ${JSON.stringify(audit.json)}`);
  }
  const before = routeEdit.before as Json;
  const after = routeEdit.after as Json;
  if (after.origin_label !== 'Ahmad Depot Updated') {
    throw new CheckError(`audit after.origin_label=${after.origin_label}`);
  }
  if (before.origin_label === after.origin_label) {
    throw new CheckError('audit before/after origin_label should differ');
  }

  const auditOne = await request(
    'GET',
    `/institution/audit-logs/${String(routeEdit.id)}`,
    { token },
  );
  assertStatus('institution audit get', auditOne.status, 200, auditOne.json);
  if (dataOf(auditOne.json).id !== routeEdit.id) {
    throw new CheckError('audit get id mismatch');
  }

  const adminSummary = await request('GET', '/admin/dashboard/summary', {
    token: beroyaToken,
  });
  assertStatus('admin summary', adminSummary.status, 200, adminSummary.json);
  const adminSummaryData = dataOf(adminSummary.json);
  if (typeof adminSummaryData.institutions_total !== 'number') {
    throw new CheckError('admin summary institutions_total');
  }

  const distribution = await request(
    'GET',
    '/admin/dashboard/institutions-distribution',
    { token: beroyaToken },
  );
  assertStatus('distribution', distribution.status, 200, distribution.json);
  const dist = dataOf(distribution.json);
  if (!Array.isArray(dist.by_operation_model)) {
    throw new CheckError('distribution.by_operation_model');
  }

  const recent = await request(
    'GET',
    '/admin/dashboard/recent-institutions?limit=5',
    { token: beroyaToken },
  );
  assertStatus('recent institutions', recent.status, 200, recent.json);
  if (!rowsOf(recent.json).some((row) => row.id === institutionId)) {
    throw new CheckError('recent institutions should include the new hybrid school');
  }

  const expiring = await request(
    'GET',
    '/admin/dashboard/expiring-subscriptions?days=30',
    { token: beroyaToken },
  );
  assertStatus('expiring subscriptions', expiring.status, 200, expiring.json);
  if (!rowsOf(expiring.json).some((row) => row.institution_id === institutionId)) {
    throw new CheckError('10-day subscription should expire within 30 days');
  }

  const operations = await request('GET', '/admin/dashboard/operations', {
    token: beroyaToken,
  });
  assertStatus('operations', operations.status, 200, operations.json);
  const ops = rowsOf(operations.json);
  if (ops.some((row) => row.operation_model === 'INSTITUTION_OPERATED')) {
    throw new CheckError('operations leaked INSTITUTION_OPERATED');
  }
  if (ops.some((row) => row.id === operatedId)) {
    throw new CheckError('operated school must not appear in operations');
  }
  const hybridOps = ops.find((row) => row.id === institutionId);
  if (!hybridOps || hybridOps.operation_model !== 'HYBRID') {
    throw new CheckError('hybrid school missing from operations');
  }
  if (hybridOps.today_trips !== 10 || hybridOps.open_incidents !== 1) {
    throw new CheckError(`operations KPIs ${JSON.stringify(hybridOps)}`);
  }

  const adminSearch = await request('GET', '/admin/search?q=ahm&limit=10', {
    token: beroyaToken,
  });
  assertStatus('admin search', adminSearch.status, 200, adminSearch.json);
  const adminGroups = dataOf(adminSearch.json);
  if (!Array.isArray(adminGroups.institutions) || adminGroups.institutions.length < 1) {
    throw new CheckError('admin search institutions');
  }
  if (!Array.isArray(adminGroups.drivers) || adminGroups.drivers.length < 1) {
    throw new CheckError('admin search drivers');
  }
  if (!Array.isArray(adminGroups.vehicles) || adminGroups.vehicles.length < 1) {
    throw new CheckError('admin search vehicles');
  }

  const adminAudit = await request(
    'GET',
    `/admin/audit-logs?institution_id=${institutionId}&action=ROUTE_UPDATED`,
    { token: beroyaToken },
  );
  assertStatus('admin audit', adminAudit.status, 200, adminAudit.json);
  if (!rowsOf(adminAudit.json).some((row) => row.entity_id === seeded.routeId)) {
    throw new CheckError('admin audit missing route edit');
  }

  const forbidden = await request('GET', '/admin/dashboard/summary', { token });
  if (forbidden.status !== 403) {
    throw new CheckError(`institution admin must not read admin dashboard (${forbidden.status})`);
  }

  await prisma.$disconnect();
  console.log(
    `Phase 13 verified — summary ${summary.ms}ms, search ${search.ms}ms, ${seeded.routeCount} routes, ${seeded.studentCount} students`,
  );
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Phase 13 verify failed: ${message}`);
  process.exitCode = 1;
});
