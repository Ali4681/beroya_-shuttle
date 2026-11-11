import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';
import { PrismaPg } from '@prisma/adapter-pg';
import { io, Socket } from 'socket.io-client';
import { PrismaClient, TripStatus } from '../src/generated/prisma/client';

const BASE =
  process.env.PHASE8_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
const SOCKET =
  process.env.PHASE8_VERIFY_SOCKET ?? 'http://127.0.0.1:3001/realtime';
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

function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET, {
      auth: { token },
      transports: ['websocket'],
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new CheckError('socket connect timeout'));
    }, 8000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function subscribe(
  socket: Socket,
  room: string,
): Promise<{ ok?: boolean; code?: string; room?: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new CheckError(`subscribe timeout ${room}`)),
      5000,
    );
    socket.emit('subscribe', { room }, (ack: { ok?: boolean; code?: string }) => {
      clearTimeout(timer);
      resolve(ack ?? {});
    });
  });
}

async function main(): Promise<void> {
  const prisma = prismaClient();
  const beroyaToken = await login(ADMIN_PHONE);
  const adminPhone = `+9639700${STAMP}`;
  const otherAdminPhone = `+9639701${STAMP}`;
  const driverPhone = `+9639711${STAMP}`;
  const today = todayInDamascus();

  const school = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase8 School ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'Phase8 Admin', phone: adminPhone, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('create school', school.status, 201, school.json);
  const institutionId = String(dataOf(school.json).id ?? '');
  const branchId = String(
    (dataOf(school.json).branches as Json[] | undefined)?.[0]?.id ?? '',
  );

  const other = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase8 Other ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'Phase8 Other Admin', phone: otherAdminPhone, email: `ol2-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('create other school', other.status, 201, other.json);
  const otherInstitutionId = String(dataOf(other.json).id ?? '');

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
  assertStatus('create subscription', subscription.status, 201, subscription.json);
  assertStatus(
    'activate subscription',
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
  const otherToken = await login(otherAdminPhone);
  assertStatus(
    'branch location',
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
    body: { full_name: 'Live Driver', phone: driverPhone, email: `ol3-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('driver', driver.status, 201, driver.json);
  const driverId = String(dataOf(driver.json).id ?? '');

  const vehicle = await request('POST', '/institution/vehicles', {
    token,
    body: { plate_number: `P8-${STAMP}`, capacity: 20 },
  });
  assertStatus('vehicle', vehicle.status, 201, vehicle.json);
  const vehicleId = String(dataOf(vehicle.json).id ?? '');

  const student = await request('POST', '/institution/students', {
    token,
    body: {
      full_name: 'Live Student',
      branch_id: branchId,
      guardian: {
        full_name: 'Live Parent',
        phone: `+9639720${STAMP}`,
        email: `v1-${STAMP}@verify.local`,
        password: VERIFY_PASSWORD,
      },
      pickup: {
        pickup_type: 'HOME',
        latitude: 33.52,
        longitude: 36.29,
      },
    },
  });
  assertStatus('student', student.status, 201, student.json);

  const route = await request('POST', '/institution/routes', {
    token,
    body: {
      name: `Live Line ${STAMP}`,
      branch_id: branchId,
      origin_lat: 33.5,
      origin_lng: 36.27,
      delay_threshold_minutes: 10,
    },
  });
  assertStatus('route', route.status, 201, route.json);
  const routeId = String(dataOf(route.json).id ?? '');

  assertStatus(
    'assign student',
    (
      await request('POST', `/institution/routes/${routeId}/students`, {
        token,
        body: { student_ids: [String(dataOf(student.json).id ?? '')] },
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
    'default assignment',
    (
      await request('PATCH', `/institution/routes/${routeId}/default-assignment`, {
        token,
        body: { driver_id: driverId, vehicle_id: vehicleId },
      })
    ).status,
    200,
    {},
  );

  const generated = await request('POST', '/institution/trips/generate', {
    token,
    body: { date: today, route_id: routeId },
  });
  assertStatus('generate today', generated.status, 201, generated.json);
  const listed = await request(
    'GET',
    `/institution/trips?date=${today}&route_id=${routeId}&direction=OUTBOUND`,
    { token },
  );
  assertStatus('list trips', listed.status, 200, listed.json);
  const trips = (listed.json.data as Json[]) ?? [];
  if (trips.length < 1) {
    throw new CheckError(`expected a generated trip, got ${JSON.stringify(listed.json)}`);
  }
  const tripId = String(trips[0].id ?? '');

  const past = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.shuttleTrip.update({
    where: { id: tripId },
    data: {
      status: TripStatus.IN_PROGRESS,
      startedAt: new Date(),
      delayThresholdMinutes: 10,
    },
  });
  await prisma.tripStop.updateMany({
    where: { tripId },
    data: { plannedArrivalAt: past },
  });

  const driverToken = await login(driverPhone);
  const pings = Array.from({ length: 200 }, (_, index) => ({
    latitude: 33.5 + index * 0.00001,
    longitude: 36.27,
    speed_kph: 20,
    recorded_at: new Date(Date.now() - 2000 + index * 5).toISOString(),
  }));

  const first = await request('POST', `/driver/trips/${tripId}/location`, {
    token: driverToken,
    body: pings[0],
  });
  assertStatus('first ping', first.status, 200, first.json);

  const batch = await request('POST', `/driver/trips/${tripId}/location/batch`, {
    token: driverToken,
    body: { pings: pings.slice(1) },
  });
  assertStatus('batch pings', batch.status, 200, batch.json);

  const live = await request('GET', `/institution/trips/${tripId}/live`, {
    token,
  });
  assertStatus('trip live', live.status, 200, live.json);
  const liveData = dataOf(live.json);
  if (!liveData.location || (liveData.location as Json).latitude == null) {
    throw new CheckError(`live trip missing location ${JSON.stringify(liveData)}`);
  }

  const map = await request('GET', `/institution/live-map`, { token });
  assertStatus('live-map', map.status, 200, map.json);
  const mapRows = map.json.data as Json[];
  if (!Array.isArray(mapRows) || !mapRows.some((row) => row.id === tripId)) {
    throw new CheckError(`live-map missing trip ${JSON.stringify(map.json)}`);
  }
  console.log('OK  200 driver pings update the live map');

  const pingCount = await prisma.tripLocationPing.count({ where: { tripId } });
  if (pingCount < 1 || pingCount >= 200) {
    throw new CheckError(`expected sampled pings, got ${pingCount}`);
  }
  console.log(`OK  Postgres stored ${pingCount} sampled ping(s), not 200`);

  const delayEvents = await prisma.tripEvent.count({
    where: { tripId, type: 'DELAY_DETECTED' },
  });
  const tripAfter = await prisma.shuttleTrip.findUnique({ where: { id: tripId } });
  if (delayEvents !== 1 || !tripAfter?.delayAlertSentAt) {
    throw new CheckError(
      `expected one delay alert, events=${delayEvents} sentAt=${tripAfter?.delayAlertSentAt}`,
    );
  }

  const extra = await request('POST', `/driver/trips/${tripId}/location`, {
    token: driverToken,
    body: { latitude: 33.51, longitude: 36.28 },
  });
  assertStatus('extra ping after delay', extra.status, 200, extra.json);
  const delayEventsAfter = await prisma.tripEvent.count({
    where: { tripId, type: 'DELAY_DETECTED' },
  });
  if (delayEventsAfter !== 1) {
    throw new CheckError(`delay must alert once, got ${delayEventsAfter}`);
  }
  console.log('OK  delay threshold 10 minutes alerts exactly once');

  const stalePing = await request('POST', `/driver/trips/${tripId}/location`, {
    token: driverToken,
    body: {
      latitude: 33.512,
      longitude: 36.275,
      recorded_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    },
  });
  assertStatus('stale-aged ping', stalePing.status, 200, stalePing.json);
  const staleLive = await request('GET', `/institution/trips/${tripId}/live`, {
    token,
  });
  assertStatus('stale live', staleLive.status, 200, staleLive.json);
  const staleData = dataOf(staleLive.json);
  if (staleData.gps_stale !== true) {
    throw new CheckError(`expected gps_stale true, got ${JSON.stringify(staleData)}`);
  }
  if (!staleData.location) {
    throw new CheckError('last location must remain visible when GPS is stale');
  }
  const emergencies = await prisma.tripIncident.count({
    where: { tripId, type: 'EMERGENCY' },
  });
  if (emergencies !== 0) {
    throw new CheckError('GPS stale must not create an emergency');
  }
  console.log('OK  GPS stale keeps last location and is not an emergency');

  const socketA = await connectSocket(token);
  const socketB = await connectSocket(otherToken);
  const allowed = await subscribe(socketA, `institution:${institutionId}`);
  const denied = await subscribe(socketB, `institution:${institutionId}`);
  socketA.disconnect();
  socketB.disconnect();
  if (!allowed.ok) {
    throw new CheckError(`admin A should join own room ${JSON.stringify(allowed)}`);
  }
  if (denied.ok || denied.code !== 'ROOM_FORBIDDEN') {
    throw new CheckError(
      `admin B must not join institution A ${JSON.stringify(denied)}`,
    );
  }
  console.log('OK  institution B cannot subscribe to institution A rooms');

  const dash = await request('GET', '/institution/dashboard/live-trips', {
    token,
  });
  assertStatus('dashboard live-trips', dash.status, 200, dash.json);
  void otherInstitutionId;

  await prisma.$disconnect();
  console.log('Phase 8 Definition of Done passed');
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
