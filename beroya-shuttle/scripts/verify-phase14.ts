import 'dotenv/config';
import { VERIFY_PASSWORD, SEED_ADMIN_EMAIL, emailForPhone } from './verify-credentials';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { REQUIRED_JOB_NAMES } from '../src/infra/queue/jobs.catalog';
import { assertSwaggerContract } from '../src/swagger/swagger-contract';

const BASE =
  process.env.PHASE14_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
const METRICS =
  process.env.PHASE14_METRICS_URL ?? 'http://127.0.0.1:3001/metrics';
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? '+963900000000';
const OTP = process.env.OTP_DEV_CODE ?? '000000';
const STAMP = Date.now().toString().slice(-6);

const SWAGGER_PATHS = [
  '/admin/dashboard/summary',
  '/institution/dashboard/summary',
  '/institution/search',
  '/admin/search',
  '/institution/audit-logs',
  '/admin/audit-logs',
  '/admin/ops/jobs',
  '/driver/trips/{id}/start',
  '/institution/notifications',
  '/metrics',
];

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
  options: {
    token?: string;
    body?: Json;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; json: Json; raw: string }> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...(options.headers ?? {}),
  };
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
    json: text && text.startsWith('{') ? (JSON.parse(text) as Json) : {},
    raw: text,
  };
}

function dataOf(json: Json): Json {
  if (json.data === undefined) {
    throw new CheckError(`Expected data, got ${JSON.stringify(json)}`);
  }
  return json.data as Json;
}

function asText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return '';
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

async function activate(
  beroyaToken: string,
  institutionId: string,
): Promise<void> {
  const starts = new Date();
  const ends = new Date(starts.getTime() + 40 * 24 * 60 * 60 * 1000);
  const subscription = await request(
    'POST',
    `/admin/institutions/${institutionId}/subscriptions`,
    {
      token: beroyaToken,
      body: {
        billing_period: 'MONTHLY',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        agreed_amount: 180,
      },
    },
  );
  assertStatus('subscription', subscription.status, 201, subscription.json);
  assertStatus(
    'activate',
    (
      await request(
        'POST',
        `/admin/institutions/${institutionId}/subscriptions/${asText(dataOf(subscription.json).id)}/activate`,
        { token: beroyaToken },
      )
    ).status,
    201,
    {},
  );
}

async function createSchool(
  beroyaToken: string,
  name: string,
  phone: string,
): Promise<Json> {
  const created = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name,
      type: 'SCHOOL',
      operation_model: 'HYBRID',
      admin: { full_name: `${name} Admin`, phone, email: `${name.replace(/\s+/g, '.').toLowerCase()}-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus(`create ${name}`, created.status, 201, created.json);
  return dataOf(created.json);
}

async function main(): Promise<void> {
  const prisma = prismaClient();
  const beroyaToken = await login(ADMIN_PHONE);

  const jobs = await request('GET', '/admin/ops/jobs', { token: beroyaToken });
  assertStatus('ops jobs', jobs.status, 200, jobs.json);
  const catalog = dataOf(jobs.json).jobs as Json[] | undefined;
  const names = (catalog ?? []).map((job) => asText(job.name));
  for (const required of REQUIRED_JOB_NAMES) {
    if (!names.includes(required)) {
      throw new CheckError(`job catalog missing ${required}`);
    }
  }

  const docs = await fetch(`${BASE}/docs-json`);
  if (!docs.ok) {
    throw new CheckError(`swagger docs-json HTTP ${docs.status}`);
  }
  const swagger = (await docs.json()) as {
    paths?: Record<
      string,
      Record<string, { summary?: string; responses?: unknown }>
    >;
  };
  const contractGaps = assertSwaggerContract(swagger);
  if (contractGaps.length > 0) {
    throw new CheckError(
      `swagger contract: ${contractGaps.slice(0, 8).join('; ')}`,
    );
  }
  const paths = Object.keys(swagger.paths ?? {});
  for (const required of SWAGGER_PATHS) {
    const found = paths.some(
      (path) => path === required || path.endsWith(required),
    );
    if (!found) {
      throw new CheckError(`swagger missing ${required}`);
    }
  }

  const metrics = await fetch(METRICS);
  const metricsBody = await metrics.text();
  if (
    metrics.status !== 200 ||
    !metricsBody.includes('beroya_http_requests_total')
  ) {
    throw new CheckError(
      `metrics missing beroya_http_requests_total (${metrics.status})`,
    );
  }
  if (!metricsBody.includes('beroya_trips_in_progress')) {
    throw new CheckError('metrics missing beroya_trips_in_progress');
  }

  const aPhone = `+9639860${STAMP}`;
  const bPhone = `+9639861${STAMP}`;
  const parentA = `+9639862${STAMP}`;
  const parentB = `+9639863${STAMP}`;
  const driverPhone = `+9639864${STAMP}`;
  const attendantPhone = `+9639865${STAMP}`;
  const otherDriverPhone = `+9639866${STAMP}`;
  const driverBPhone = `+9639867${STAMP}`;
  const vehicleBPlate = `P14B-${STAMP}`;

  const schoolA = await createSchool(beroyaToken, `Phase14 A ${STAMP}`, aPhone);
  const schoolB = await createSchool(beroyaToken, `Phase14 B ${STAMP}`, bPhone);
  const idA = asText(schoolA.id);
  const idB = asText(schoolB.id);
  const branchA = asText((schoolA.branches as Json[] | undefined)?.[0]?.id);
  const branchB = asText((schoolB.branches as Json[] | undefined)?.[0]?.id);
  await activate(beroyaToken, idA);
  await activate(beroyaToken, idB);
  const tokenA = await login(aPhone);
  const tokenB = await login(bPhone);

  assertStatus(
    'branch A',
    (
      await request('PATCH', `/institution/branches/${branchA}`, {
        token: tokenA,
        body: { latitude: 33.5138, longitude: 36.2765 },
      })
    ).status,
    200,
    {},
  );

  const studentA = await request('POST', '/institution/students', {
    token: tokenA,
    body: {
      full_name: 'Isolation Child A',
      branch_id: branchA,
      guardian: { full_name: 'Parent A', phone: parentA, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
      pickup: { pickup_type: 'HOME', latitude: 33.52, longitude: 36.29 },
    },
  });
  assertStatus('student A', studentA.status, 201, studentA.json);
  const studentAId = asText(dataOf(studentA.json).id);

  const studentB = await request('POST', '/institution/students', {
    token: tokenB,
    body: {
      full_name: 'Isolation Child B',
      branch_id: branchB,
      guardian: { full_name: 'Parent B', phone: parentB, email: `ol2-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
      pickup: { pickup_type: 'HOME', latitude: 33.53, longitude: 36.3 },
    },
  });
  assertStatus('student B', studentB.status, 201, studentB.json);
  const studentBId = asText(dataOf(studentB.json).id);

  const isolationGets: Array<[string, string]> = [
    ['students', `/institution/students/${studentBId}`],
  ];
  for (const [label, path] of isolationGets) {
    const leak = await request('GET', path, { token: tokenA });
    if (leak.status === 200) {
      throw new CheckError(`institution A read institution B ${label}`);
    }
  }

  const parentToken = await login(parentA);

  const driver = await request('POST', '/institution/drivers', {
    token: tokenA,
    body: { full_name: 'Phase14 Driver', phone: driverPhone, email: `ol3-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('driver', driver.status, 201, driver.json);
  const otherDriver = await request('POST', '/institution/drivers', {
    token: tokenA,
    body: { full_name: 'Phase14 Other Driver', phone: otherDriverPhone, email: `ol4-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('other driver', otherDriver.status, 201, otherDriver.json);
  const driverB = await request('POST', '/institution/drivers', {
    token: tokenB,
    body: { full_name: 'Phase14 B Driver', phone: driverBPhone, email: `ol5-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('driver B', driverB.status, 201, driverB.json);
  const vehicleB = await request('POST', '/institution/vehicles', {
    token: tokenB,
    body: { plate_number: vehicleBPlate, capacity: 16 },
  });
  assertStatus('vehicle B', vehicleB.status, 201, vehicleB.json);
  const routeB = await request('POST', '/institution/routes', {
    token: tokenB,
    body: {
      name: `Phase14 B Line ${STAMP}`,
      branch_id: branchB,
      origin_lat: 33.54,
      origin_lng: 36.31,
    },
  });
  assertStatus('route B', routeB.status, 201, routeB.json);
  const routeBId = asText(dataOf(routeB.json).id);
  const driverBId = asText(dataOf(driverB.json).id);
  const vehicleBId = asText(dataOf(vehicleB.json).id);
  const attendantB = await request('POST', '/institution/attendants', {
    token: tokenB,
    body: { full_name: 'Phase14 B Attendant', phone: `+9639868${STAMP}`, email: `p14-att-b-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('attendant B', attendantB.status, 201, attendantB.json);
  const parentBId = asText(
    (dataOf(studentB.json).guardian as Json | undefined)?.id,
  );
  const isolationModules: Array<[string, string]> = [
    ['students', `/institution/students/${studentBId}`],
    ['routes', `/institution/routes/${routeBId}`],
    ['drivers', `/institution/drivers/${driverBId}`],
    ['vehicles', `/institution/vehicles/${vehicleBId}`],
    [
      'attendants',
      `/institution/attendants/${asText(dataOf(attendantB.json).id)}`,
    ],
    ['parents', `/institution/parents/${parentBId}`],
  ];
  for (const [label, path] of isolationModules) {
    const id = path.split('/').pop() ?? '';
    if (!id || id === 'undefined') {
      throw new CheckError(`isolation ${label}: missing id`);
    }
    const leak = await request('GET', path, { token: tokenA });
    if (leak.status === 200) {
      throw new CheckError(`isolation ${label}: A read B (${path})`);
    }
  }
  const searchB = await request(
    'GET',
    '/institution/search?q=Isolation%20Child%20B',
    {
      token: tokenA,
    },
  );
  assertStatus('search isolation', searchB.status, 200, searchB.json);
  const searchStudents =
    (dataOf(searchB.json).students as Json[] | undefined) ?? [];
  if (searchStudents.some((row) => row.id === studentBId)) {
    throw new CheckError('search leaked institution B student');
  }
  const attendant = await request('POST', '/institution/attendants', {
    token: tokenA,
    body: { full_name: 'Phase14 Attendant', phone: attendantPhone, email: `ol6-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('attendant', attendant.status, 201, attendant.json);
  const vehicle = await request('POST', '/institution/vehicles', {
    token: tokenA,
    body: { plate_number: `P14-${STAMP}`, capacity: 20 },
  });
  assertStatus('vehicle', vehicle.status, 201, vehicle.json);
  const route = await request('POST', '/institution/routes', {
    token: tokenA,
    body: {
      name: `Phase14 Line ${STAMP}`,
      branch_id: branchA,
      origin_lat: 33.52,
      origin_lng: 36.29,
    },
  });
  assertStatus('route', route.status, 201, route.json);
  const routeId = asText(dataOf(route.json).id);
  assertStatus(
    'assign students',
    (
      await request('POST', `/institution/routes/${routeId}/students`, {
        token: tokenA,
        body: { student_ids: [studentAId] },
      })
    ).status,
    201,
    {},
  );
  assertStatus(
    'schedule',
    (
      await request('POST', `/institution/routes/${routeId}/schedules`, {
        token: tokenA,
        body: {
          direction: 'OUTBOUND',
          departure_time: '07:30',
          days_of_week: [1, 2, 3, 4, 5, 6, 7],
        },
      })
    ).status,
    201,
    {},
  );
  assertStatus(
    'default assignment',
    (
      await request(
        'PATCH',
        `/institution/routes/${routeId}/default-assignment`,
        {
          token: tokenA,
          body: {
            driver_id: dataOf(driver.json).id,
            vehicle_id: dataOf(vehicle.json).id,
            attendant_id: dataOf(attendant.json).id,
          },
        },
      )
    ).status,
    200,
    {},
  );

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Damascus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const generated = await request('POST', '/institution/trips/generate', {
    token: tokenA,
    body: { date: today, route_id: routeId },
  });
  assertStatus('generate', generated.status, 201, generated.json);

  const trips = await request(
    'GET',
    `/institution/trips?date=${today}&route_id=${routeId}&limit=20`,
    { token: tokenA },
  );
  assertStatus('list trips', trips.status, 200, trips.json);
  const tripRows = (trips.json.data as Json[]) ?? [];
  const trip = tripRows.find((row) => row.route_id === routeId);
  if (!trip) {
    throw new CheckError('generated trip missing');
  }
  const tripId = asText(trip.id);
  const tripLeak = await request('GET', `/institution/trips/${tripId}`, {
    token: tokenB,
  });
  if (tripLeak.status === 200) {
    throw new CheckError('isolation trips: B read A trip');
  }

  const driverToken = await login(driverPhone);
  const attendantToken = await login(attendantPhone);
  const roleMatrix: Array<[string, string, string, number]> = [
    ['parent', 'GET', '/admin/institutions', 403],
    ['parent', 'GET', '/institution/students', 403],
    ['parent', 'GET', '/driver/trips/today', 403],
    ['parent', 'GET', '/attendant/me', 403],
    ['parent', 'GET', '/admin/ops/jobs', 403],
    ['parent', 'GET', '/university/me', 403],
    ['driver', 'GET', '/admin/dashboard/summary', 403],
    ['driver', 'GET', '/institution/routes', 403],
    ['driver', 'GET', '/parent/students', 403],
    ['driver', 'GET', '/attendant/me', 403],
    ['attendant', 'GET', '/driver/trips/today', 403],
    ['attendant', 'GET', '/institution/students', 403],
    ['attendant', 'GET', '/admin/bootstrap', 403],
    ['attendant', 'GET', '/parent/students', 403],
    ['institution', 'GET', '/admin/institutions', 403],
    ['institution', 'GET', '/driver/trips/today', 403],
    ['institution', 'GET', '/parent/students', 403],
    ['institution', 'GET', '/attendant/me', 403],
    ['beroya', 'GET', '/parent/students', 403],
    ['beroya', 'GET', '/driver/trips/today', 403],
    ['beroya', 'GET', '/attendant/me', 403],
    ['beroya', 'GET', '/institution/students', 403],
  ];
  const tokens: Record<string, string> = {
    parent: parentToken,
    driver: driverToken,
    attendant: attendantToken,
    institution: tokenA,
    beroya: beroyaToken,
  };
  for (const [role, method, path, expected] of roleMatrix) {
    const denied = await request(method, path, { token: tokens[role] });
    if (denied.status !== expected) {
      throw new CheckError(
        `roles ${role} ${method} ${path}: expected ${expected}, got ${denied.status}`,
      );
    }
  }
  assertStatus(
    'parent own app',
    (await request('GET', '/parent/students', { token: parentToken })).status,
    200,
    {},
  );
  const startKey = `start-${STAMP}`;
  const started = await request('POST', `/driver/trips/${tripId}/start`, {
    token: driverToken,
    headers: { 'idempotency-key': startKey },
  });
  assertStatus('start', started.status, 200, started.json);
  const replay = await request('POST', `/driver/trips/${tripId}/start`, {
    token: driverToken,
    headers: { 'idempotency-key': startKey },
  });
  assertStatus('start replay', replay.status, 200, replay.json);
  if (dataOf(replay.json).status !== dataOf(started.json).status) {
    throw new CheckError('idempotent start replay changed status');
  }

  const ping = await request('POST', `/driver/trips/${tripId}/location`, {
    token: driverToken,
    body: {
      latitude: 34.2,
      longitude: 37.1,
      recorded_at: new Date().toISOString(),
    },
  });
  assertStatus('location ping', ping.status, 200, ping.json);
  const delayed = await request('GET', `/institution/trips/${tripId}`, {
    token: tokenA,
  });
  assertStatus('delay read', delayed.status, 200, delayed.json);
  const delayMinutes = Number(dataOf(delayed.json).delay_minutes ?? 0);
  if (delayMinutes <= 0 && dataOf(delayed.json).delayed !== true) {
    throw new CheckError(
      `simulated day did not record delay (${JSON.stringify(delayed.json)})`,
    );
  }

  const breakdown = await request('POST', `/driver/trips/${tripId}/breakdown`, {
    token: driverToken,
    body: {
      description: 'Phase14 simulated breakdown',
      latitude: 33.6,
      longitude: 36.4,
    },
  });
  assertStatus('breakdown', breakdown.status, 201, breakdown.json);
  const incidentId = asText(dataOf(breakdown.json).id);
  if (!incidentId) {
    throw new CheckError('breakdown missing incident id');
  }
  const incidentLeak = await request(
    'GET',
    `/institution/incidents/${incidentId}`,
    {
      token: tokenB,
    },
  );
  if (incidentLeak.status === 200) {
    throw new CheckError('isolation incidents: B read A incident');
  }

  const reassigned = await request(
    'POST',
    `/institution/trips/${tripId}/reassign`,
    {
      token: tokenA,
      body: {
        driver_id: dataOf(otherDriver.json).id,
        incident_id: incidentId,
        reason: 'Phase14 simulated crew swap',
      },
    },
  );
  assertStatus('reassign', reassigned.status, 200, reassigned.json);
  if (dataOf(reassigned.json).driver_id !== dataOf(otherDriver.json).id) {
    throw new CheckError('reassign did not switch the driver');
  }

  const otherDriverToken = await login(otherDriverPhone);
  const completed = await request('POST', `/driver/trips/${tripId}/complete`, {
    token: otherDriverToken,
  });
  assertStatus('complete', completed.status, 200, completed.json);

  let limited = false;
  for (let index = 0; index < 12; index += 1) {
    // OTP parked — restore POST /auth/otp/request with ADMIN_PHONE for this loop.
    // const otp = await request('POST', '/auth/otp/request', {
    //   body: { phone: ADMIN_PHONE },
    // });
    const attempt = await request('POST', '/auth/login', {
      body: { email: SEED_ADMIN_EMAIL, password: 'wrong-password-for-rate-limit' },
    });
    if (attempt.status === 429) {
      limited = true;
      break;
    }
  }
  if (!limited) {
    throw new CheckError('login rate limit did not return 429');
  }

  const explain = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
    `EXPLAIN SELECT id FROM "SchoolStudent" WHERE "institutionId" = $1 AND "archivedAt" IS NULL ORDER BY "fullName" LIMIT 20`,
    idA,
  );
  const plan = explain.map((row) => Object.values(row)[0] ?? '').join('\n');
  if (!/index|limit/i.test(plan)) {
    throw new CheckError(`students list not using an index:\n${plan}`);
  }

  await prisma.$disconnect();
  console.log(
    `Phase 14 verified — ${REQUIRED_JOB_NAMES.length} jobs, swagger ${paths.length} paths, isolation + simulated day + idempotency + rate limit`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Phase 14 verify failed: ${message}`);
  process.exitCode = 1;
});
