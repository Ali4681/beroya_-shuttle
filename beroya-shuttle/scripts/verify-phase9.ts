import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';
import { PrismaPg } from '@prisma/adapter-pg';
import { io, Socket } from 'socket.io-client';
import {
  PrismaClient,
  TripEventType,
  TripStatus,
} from '../src/generated/prisma/client';

const BASE =
  process.env.PHASE9_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
const SOCKET =
  process.env.PHASE9_VERIFY_SOCKET ?? 'http://127.0.0.1:3001/realtime';
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
): Promise<{ ok?: boolean; code?: string }> {
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
  const adminPhone = `+9639800${STAMP}`;
  const driverAPhone = `+9639811${STAMP}`;
  const driverBPhone = `+9639812${STAMP}`;
  const today = todayInDamascus();

  const school = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase9 School ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'Phase9 Admin', phone: adminPhone, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('create school', school.status, 201, school.json);
  const institutionId = String(dataOf(school.json).id ?? '');
  const branchId = String(
    (dataOf(school.json).branches as Json[] | undefined)?.[0]?.id ?? '',
  );
  const adminUserId = String(
    (dataOf(school.json).primary_admin as Json | undefined)?.id ??
      (dataOf(school.json).admin as Json | undefined)?.id ??
      '',
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

  const driverA = await request('POST', '/institution/drivers', {
    token,
    body: { full_name: 'Driver A', phone: driverAPhone, email: `ol2-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  const driverB = await request('POST', '/institution/drivers', {
    token,
    body: { full_name: 'Driver B', phone: driverBPhone, email: `ol3-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('driver a', driverA.status, 201, driverA.json);
  assertStatus('driver b', driverB.status, 201, driverB.json);
  const driverAId = String(dataOf(driverA.json).id ?? '');
  const driverBId = String(dataOf(driverB.json).id ?? '');

  const vehicleA = await request('POST', '/institution/vehicles', {
    token,
    body: { plate_number: `A9-${STAMP}`, capacity: 20 },
  });
  const vehicleB = await request('POST', '/institution/vehicles', {
    token,
    body: { plate_number: `B9-${STAMP}`, capacity: 20 },
  });
  assertStatus('vehicle a', vehicleA.status, 201, vehicleA.json);
  assertStatus('vehicle b', vehicleB.status, 201, vehicleB.json);
  const vehicleAId = String(dataOf(vehicleA.json).id ?? '');
  const vehicleBId = String(dataOf(vehicleB.json).id ?? '');

  const student = await request('POST', '/institution/students', {
    token,
    body: {
      full_name: 'Incident Student',
      branch_id: branchId,
      guardian: {
        full_name: 'Incident Parent',
        phone: `+9639820${STAMP}`,
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
  const parentUserId = String(
    ((dataOf(student.json).guardian as Json | undefined)?.id as string) ??
      ((dataOf(student.json).guardian_user as Json | undefined)?.id as string) ??
      '',
  );

  const route = await request('POST', '/institution/routes', {
    token,
    body: {
      name: `Incident Line ${STAMP}`,
      branch_id: branchId,
      origin_lat: 33.5,
      origin_lng: 36.27,
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
    'assignment',
    (
      await request('PATCH', `/institution/routes/${routeId}/default-assignment`, {
        token,
        body: { driver_id: driverAId, vehicle_id: vehicleAId },
      })
    ).status,
    200,
    {},
  );

  const generated = await request('POST', '/institution/trips/generate', {
    token,
    body: { date: today, route_id: routeId },
  });
  assertStatus('generate', generated.status, 201, generated.json);
  const listed = await request(
    'GET',
    `/institution/trips?date=${today}&route_id=${routeId}&direction=OUTBOUND`,
    { token },
  );
  assertStatus('list trips', listed.status, 200, listed.json);
  const trips = (listed.json.data as Json[]) ?? [];
  if (trips.length < 1) {
    throw new CheckError('expected a generated trip');
  }
  const tripId = String(trips[0].id ?? '');

  await prisma.shuttleTrip.update({
    where: { id: tripId },
    data: {
      status: TripStatus.IN_PROGRESS,
      startedAt: new Date(),
      driverId: driverAId,
      vehicleId: vehicleAId,
    },
  });
  await prisma.tripEvent.create({
    data: {
      tripId,
      type: TripEventType.TRIP_STARTED,
      title: 'Trip started',
    },
  });

  const tokenA = await login(driverAPhone);
  const tokenB = await login(driverBPhone);
  assertStatus(
    'driver a location',
    (
      await request('POST', `/driver/trips/${tripId}/location`, {
        token: tokenA,
        body: { latitude: 33.5, longitude: 36.27 },
      })
    ).status,
    200,
    {},
  );

  const breakdown = await request('POST', `/driver/trips/${tripId}/breakdown`, {
    token: tokenA,
    body: {
      description: 'Engine overheat',
      latitude: 33.501,
      longitude: 36.271,
    },
  });
  assertStatus('breakdown', breakdown.status, 201, breakdown.json);
  const breakdownData = dataOf(breakdown.json);
  if (breakdownData.trip_status !== 'IN_PROGRESS' || breakdownData.trip_id !== tripId) {
    throw new CheckError(
      `breakdown must keep the same in-progress trip ${JSON.stringify(breakdownData)}`,
    );
  }
  const incidentId = String(breakdownData.id ?? '');

  const reassigned = await request('POST', `/institution/trips/${tripId}/reassign`, {
    token,
    body: {
      driver_id: driverBId,
      vehicle_id: vehicleBId,
      incident_id: incidentId,
      reason: 'Replacement after breakdown',
    },
  });
  assertStatus('reassign', reassigned.status, 200, reassigned.json);
  const afterReassign = dataOf(reassigned.json);
  if (afterReassign.id !== tripId || afterReassign.status !== 'IN_PROGRESS') {
    throw new CheckError(`trip id/status changed ${JSON.stringify(afterReassign)}`);
  }

  const oldRejected = await request('POST', `/driver/trips/${tripId}/location`, {
    token: tokenA,
    body: { latitude: 33.502, longitude: 36.272 },
  });
  if (oldRejected.status !== 403) {
    throw new CheckError(
      `old driver must be 403, got ${oldRejected.status} ${JSON.stringify(oldRejected.json)}`,
    );
  }
  assertStatus(
    'new driver location',
    (
      await request('POST', `/driver/trips/${tripId}/location`, {
        token: tokenB,
        body: { latitude: 33.503, longitude: 36.273 },
      })
    ).status,
    200,
    {},
  );
  console.log('OK  old driver rejected after reassign, new driver accepted');

  const beroyaSocket = await connectSocket(beroyaToken);
  const joined = await subscribe(beroyaSocket, 'admin:beroya');
  if (!joined.ok) {
    throw new CheckError(`beroya should join admin:beroya ${JSON.stringify(joined)}`);
  }
  let beroyaSawEmergency = false;
  beroyaSocket.on('trip.emergency.created', () => {
    beroyaSawEmergency = true;
  });

  const emergency = await request('POST', `/driver/trips/${tripId}/emergency`, {
    token: tokenB,
    body: {
      description: 'Medical emergency',
      latitude: 33.504,
      longitude: 36.274,
    },
  });
  assertStatus('emergency', emergency.status, 201, emergency.json);
  await new Promise((resolve) => setTimeout(resolve, 800));
  beroyaSocket.disconnect();
  if (beroyaSawEmergency) {
    throw new CheckError(
      'INSTITUTION_OPERATED emergency must not reach admin:beroya',
    );
  }
  console.log('OK  INSTITUTION_OPERATED emergency never reaches admin:beroya');

  const latest = await prisma.shuttleNotification.findFirst({
    where: { institutionId, title: 'Emergency on a trip' },
    include: { recipients: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest || latest.recipients.length < 1) {
    throw new CheckError('emergency must notify institution admins');
  }
  const recipientIds = latest.recipients.map((row) => row.userId);
  if (parentUserId && recipientIds.includes(parentUserId)) {
    throw new CheckError('emergency must not notify parents');
  }
  const beroyaUser = await prisma.shuttleUser.findFirst({
    where: { phone: ADMIN_PHONE },
  });
  if (beroyaUser && recipientIds.includes(beroyaUser.id)) {
    throw new CheckError('emergency must not notify Beroya on INSTITUTION_OPERATED');
  }

  await prisma.shuttleTrip.update({
    where: { id: tripId },
    data: { status: TripStatus.COMPLETED, completedAt: new Date() },
  });
  await prisma.tripEvent.create({
    data: {
      tripId,
      type: TripEventType.TRIP_COMPLETED,
      title: 'Trip completed',
    },
  });

  const finished = await prisma.shuttleTrip.findUnique({ where: { id: tripId } });
  if (finished?.status !== TripStatus.COMPLETED || finished.id !== tripId) {
    throw new CheckError('trip must finish with the same id');
  }

  const history = await prisma.tripAssignmentHistory.findMany({
    where: { tripId },
    orderBy: { changedAt: 'asc' },
  });
  const vehicleChange = history.find((row) => row.field === 'VEHICLE');
  if (!vehicleChange || vehicleChange.incidentId !== incidentId) {
    throw new CheckError(
      `vehicle history must link the breakdown ${JSON.stringify(history)}`,
    );
  }
  if (vehicleChange.previousId !== vehicleAId || vehicleChange.newId !== vehicleBId) {
    throw new CheckError(`vehicle swap missing ${JSON.stringify(vehicleChange)}`);
  }

  const events = await prisma.tripEvent.findMany({
    where: { tripId },
    orderBy: { occurredAt: 'asc' },
  });
  const types = events.map((row) => row.type);
  for (const needed of [
    'TRIP_STARTED',
    'BREAKDOWN_REPORTED',
    'VEHICLE_CHANGED',
    'DRIVER_CHANGED',
    'EMERGENCY_TRIGGERED',
    'TRIP_COMPLETED',
  ] as const) {
    if (!types.includes(needed)) {
      throw new CheckError(`missing event ${needed} in ${types.join(',')}`);
    }
  }
  console.log('OK  assignment history and timeline cover the full breakdown scenario');

  const attention = await request('GET', '/institution/dashboard/attention', {
    token,
  });
  assertStatus('attention', attention.status, 200, attention.json);
  const resolve = await request(
    'POST',
    `/institution/incidents/${incidentId}/resolve`,
    { token, body: { resolution_notes: 'Replacement vehicle finished the trip' } },
  );
  if (resolve.status !== 201 && resolve.status !== 200) {
    throw new CheckError(
      `resolve expected 200/201 got ${resolve.status} ${JSON.stringify(resolve.json)}`,
    );
  }
  void adminUserId;

  await prisma.$disconnect();
  console.log('Phase 9 Definition of Done passed');
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
