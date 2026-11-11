import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, TripStudentStatus } from '../src/generated/prisma/client';

const BASE =
  process.env.PHASE11_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
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

function todayInDamascus(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Damascus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function leakScan(label: string, payload: unknown, forbidden: string[]): void {
  const raw = JSON.stringify(payload).toLowerCase();
  for (const token of forbidden) {
    if (raw.includes(token.toLowerCase())) {
      throw new CheckError(`${label} leaked ${token}`);
    }
  }
}

async function main(): Promise<void> {
  const prisma = prismaClient();
  const beroyaToken = await login(ADMIN_PHONE);
  const adminPhone = `+9639800${STAMP}`;
  const driverPhone = `+9639810${STAMP}`;
  const otherDriverPhone = `+9639811${STAMP}`;
  const attendantPhone = `+9639820${STAMP}`;
  const today = todayInDamascus();

  const school = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase11 School ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'Phase11 Admin', phone: adminPhone, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('school', school.status, 201, school.json);
  const institutionId = String(dataOf(school.json).id ?? '');
  const branchId = String(
    (dataOf(school.json).branches as Json[] | undefined)?.[0]?.id ?? '',
  );

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

  const token = await login(adminPhone);
  assertStatus(
    'branch',
    (
      await request('PATCH', `/institution/branches/${branchId}`, {
        token,
        body: { latitude: 33.5138, longitude: 36.2765 },
      })
    ).status,
    200,
    {},
  );

  const driver = await request('POST', '/institution/drivers', {
    token,
    body: { full_name: 'Crew Driver', phone: driverPhone, email: `ol2-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('driver', driver.status, 201, driver.json);
  const otherDriver = await request('POST', '/institution/drivers', {
    token,
    body: { full_name: 'Other Driver', phone: otherDriverPhone, email: `ol3-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('other driver', otherDriver.status, 201, otherDriver.json);
  const attendant = await request('POST', '/institution/attendants', {
    token,
    body: { full_name: 'Crew Attendant', phone: attendantPhone, email: `ol4-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('attendant', attendant.status, 201, attendant.json);
  const vehicle = await request('POST', '/institution/vehicles', {
    token,
    body: { plate_number: `C11-${STAMP}`, capacity: 20 },
  });
  assertStatus('vehicle', vehicle.status, 201, vehicle.json);

  const pickups = [
    { name: 'Boarded Child', lat: 33.52, lng: 36.29, phone: `+9639830${STAMP}` },
    { name: 'Absent Child', lat: 33.525, lng: 36.295, phone: `+9639831${STAMP}` },
    { name: 'Pending Child', lat: 33.53, lng: 36.3, phone: `+9639832${STAMP}` },
  ];
  const studentIds: string[] = [];
  for (const pickup of pickups) {
    const student = await request('POST', '/institution/students', {
      token,
      body: {
        full_name: pickup.name,
        branch_id: branchId,
        guardian: { full_name: `${pickup.name} Parent`, phone: pickup.phone, email: `p11-${pickup.phone.replace('+', '')}@verify.local`, password: VERIFY_PASSWORD },
        pickup: {
          pickup_type: 'HOME',
          latitude: pickup.lat,
          longitude: pickup.lng,
        },
      },
    });
    assertStatus(pickup.name, student.status, 201, student.json);
    studentIds.push(String(dataOf(student.json).id ?? ''));
  }

  const route = await request('POST', '/institution/routes', {
    token,
    body: {
      name: `Crew Line ${STAMP}`,
      branch_id: branchId,
      origin_lat: 33.52,
      origin_lng: 36.29,
    },
  });
  assertStatus('route', route.status, 201, route.json);
  const routeId = String(dataOf(route.json).id ?? '');
  assertStatus(
    'assign',
    (
      await request('POST', `/institution/routes/${routeId}/students`, {
        token,
        body: { student_ids: studentIds },
      })
    ).status,
    201,
    {},
  );
  assertStatus(
    'schedule',
    (
      await request('POST', `/institution/routes/${routeId}/schedules`, {
        token,
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
    'assignment',
    (
      await request('PATCH', `/institution/routes/${routeId}/default-assignment`, {
        token,
        body: {
          driver_id: String(dataOf(driver.json).id ?? ''),
          vehicle_id: String(dataOf(vehicle.json).id ?? ''),
          attendant_id: String(dataOf(attendant.json).id ?? ''),
        },
      })
    ).status,
    200,
    {},
  );
  assertStatus(
    'generate',
    (
      await request('POST', '/institution/trips/generate', {
        token,
        body: { date: today, route_id: routeId },
      })
    ).status,
    201,
    {},
  );

  const listed = await request(
    'GET',
    `/institution/trips?date=${today}&route_id=${routeId}&direction=OUTBOUND`,
    { token },
  );
  assertStatus('trips', listed.status, 200, listed.json);
  const tripId = String((rowsOf(listed.json)[0]?.id as string) ?? '');
  if (!tripId) {
    throw new CheckError('expected a generated outbound trip');
  }

  const driverToken = await login(driverPhone);
  const otherDriverToken = await login(otherDriverPhone);
  const attendantToken = await login(attendantPhone);

  const me = await request('GET', '/driver/me', { token: driverToken });
  assertStatus('driver me', me.status, 200, me.json);
  if (!dataOf(me.json).driver) {
    throw new CheckError('driver/me must include the driver profile');
  }

  const todayTrips = await request('GET', '/driver/trips/today', {
    token: driverToken,
  });
  assertStatus('driver today', todayTrips.status, 200, todayTrips.json);
  if (!rowsOf(todayTrips.json).some((row) => row.id === tripId)) {
    throw new CheckError('driver today is missing the assigned trip');
  }

  const attendantStart = await request('POST', `/driver/trips/${tripId}/start`, {
    token: attendantToken,
  });
  assertStatus('attendant start', attendantStart.status, 403, attendantStart.json);
  console.log('OK  attendant cannot start a trip');

  const foreign = await request('GET', `/driver/trips/${tripId}`, {
    token: otherDriverToken,
  });
  assertStatus('foreign driver read', foreign.status, 404, foreign.json);
  console.log('OK  driver cannot read a trip that is not theirs');

  const started = await request('POST', `/driver/trips/${tripId}/start`, {
    token: driverToken,
  });
  assertStatus('start', started.status, 200, started.json);
  if (dataOf(started.json).status !== 'IN_PROGRESS') {
    throw new CheckError(`expected IN_PROGRESS, got ${JSON.stringify(started.json)}`);
  }
  const startedAt = String(dataOf(started.json).started_at ?? '');
  const startAgain = await request('POST', `/driver/trips/${tripId}/start`, {
    token: driverToken,
  });
  assertStatus('start idempotent', startAgain.status, 200, startAgain.json);
  if (String(dataOf(startAgain.json).started_at ?? '') !== startedAt) {
    throw new CheckError('second start must keep the original started_at');
  }

  const driverTrip = await request('GET', `/driver/trips/${tripId}`, {
    token: driverToken,
  });
  assertStatus('driver trip', driverTrip.status, 200, driverTrip.json);
  leakScan('driver trip', driverTrip.json, [
    'guardian',
    'boarded child',
    'absent child',
    'pending child',
  ]);

  const stops = await request('GET', `/driver/trips/${tripId}/stops`, {
    token: driverToken,
  });
  assertStatus('stops', stops.status, 200, stops.json);
  const stopRows = rowsOf(stops.json);
  if (stopRows.length < 1) {
    throw new CheckError('trip has no stops');
  }
  for (const stop of stopRows) {
    const arrived = await request(
      'POST',
      `/driver/trips/${tripId}/stops/${stop.id}/arrive`,
      { token: driverToken },
    );
    assertStatus(`arrive ${stop.sequence}`, arrived.status, 200, arrived.json);
    const again = await request(
      'POST',
      `/driver/trips/${tripId}/stops/${stop.id}/arrive`,
      { token: driverToken },
    );
    assertStatus(`arrive again ${stop.sequence}`, again.status, 200, again.json);
    if (dataOf(again.json).arrived_at !== dataOf(arrived.json).arrived_at) {
      throw new CheckError('second arrive must keep the original arrived_at');
    }
  }

  const students = await request('GET', `/attendant/trips/${tripId}/students`, {
    token: attendantToken,
  });
  assertStatus('students', students.status, 200, students.json);
  leakScan('attendant students', students.json, ['guardian', '+963983']);
  const roster = rowsOf(students.json);
  const boarded = roster.find((row) =>
    JSON.stringify(row).includes('Boarded Child'),
  );
  const absent = roster.find((row) =>
    JSON.stringify(row).includes('Absent Child'),
  );
  const pending = roster.find((row) =>
    JSON.stringify(row).includes('Pending Child'),
  );
  if (!boarded || !absent || !pending) {
    throw new CheckError(`roster incomplete ${JSON.stringify(roster)}`);
  }

  const driverBoard = await request(
    'PATCH',
    `/attendant/trips/${tripId}/students/${boarded.id}/board`,
    { token: driverToken },
  );
  assertStatus('driver board', driverBoard.status, 403, driverBoard.json);
  console.log('OK  driver cannot record boarding');

  const board = await request(
    'PATCH',
    `/attendant/trips/${tripId}/students/${boarded.id}/board`,
    { token: attendantToken },
  );
  assertStatus('board', board.status, 200, board.json);
  const boardedAt = String(dataOf(board.json).boarded_at ?? '');
  const boardAgain = await request(
    'PATCH',
    `/attendant/trips/${tripId}/students/${boarded.id}/board`,
    { token: attendantToken },
  );
  assertStatus('board idempotent', boardAgain.status, 200, boardAgain.json);
  if (String(dataOf(boardAgain.json).boarded_at ?? '') !== boardedAt) {
    throw new CheckError('second board must keep the original boarded_at');
  }

  assertStatus(
    'not-boarded',
    (
      await request(
        'PATCH',
        `/attendant/trips/${tripId}/students/${absent.id}/not-boarded`,
        { token: attendantToken },
      )
    ).status,
    200,
    {},
  );
  assertStatus(
    'drop-off',
    (
      await request(
        'PATCH',
        `/attendant/trips/${tripId}/students/${boarded.id}/drop-off`,
        { token: attendantToken },
      )
    ).status,
    200,
    {},
  );

  const completed = await request('POST', `/driver/trips/${tripId}/complete`, {
    token: driverToken,
  });
  assertStatus('complete', completed.status, 200, completed.json);
  if (dataOf(completed.json).status !== 'COMPLETED') {
    throw new CheckError('trip must be COMPLETED');
  }

  const leftover = await prisma.tripStudent.findUnique({
    where: { id: String(pending.id ?? '') },
  });
  if (leftover?.status !== TripStudentStatus.PENDING) {
    throw new CheckError(
      `pending student must stay PENDING, got ${leftover?.status}`,
    );
  }

  const live = await request('GET', '/institution/live-map', { token });
  assertStatus('live-map', live.status, 200, live.json);
  if (rowsOf(live.json).some((row) => row.id === tripId)) {
    throw new CheckError('completed trip must leave the live set');
  }

  const events = await request('GET', `/institution/trips/${tripId}/events`, {
    token,
  });
  assertStatus('timeline', events.status, 200, events.json);
  const types = rowsOf(events.json).map((row) => String(row.type ?? ''));
  const required = [
    'TRIP_STARTED',
    'STOP_ARRIVED',
    'STUDENT_BOARDED',
    'STUDENT_NOT_BOARDED',
    'STUDENT_DROPPED_OFF',
    'TRIP_COMPLETED',
  ];
  let cursor = 0;
  for (const type of required) {
    const index = types.indexOf(type, cursor);
    if (index < 0) {
      throw new CheckError(
        `timeline missing ${type} after index ${cursor}: ${JSON.stringify(types)}`,
      );
    }
    cursor = index + 1;
  }
  if (types.filter((type) => type === 'TRIP_STARTED').length !== 1) {
    throw new CheckError('TRIP_STARTED must appear once');
  }
  if (types.filter((type) => type === 'STUDENT_BOARDED').length !== 1) {
    throw new CheckError('STUDENT_BOARDED must appear once');
  }
  console.log('OK  outbound trip timeline matches start → stops → boarding → complete');

  await prisma.$disconnect();
  console.log('Phase 11 Definition of Done passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
