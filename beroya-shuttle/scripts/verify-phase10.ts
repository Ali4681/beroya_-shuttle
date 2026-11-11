import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  ShuttleRole,
  StudentStatus,
  TripStatus,
  UserStatus,
} from '../src/generated/prisma/client';

const BASE =
  process.env.PHASE10_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
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

async function main(): Promise<void> {
  const prisma = prismaClient();
  const beroyaToken = await login(ADMIN_PHONE);
  const adminPhone = `+9639900${STAMP}`;
  const parentPhone = `+9639910${STAMP}`;
  const driverPhone = `+9639920${STAMP}`;
  const attendantPhone = `+9639930${STAMP}`;
  const today = todayInDamascus();

  const school = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase10 School ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'Phase10 Admin', phone: adminPhone, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
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
    body: { full_name: 'Notify Driver', phone: driverPhone, email: `ol2-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('driver', driver.status, 201, driver.json);
  const attendant = await request('POST', '/institution/attendants', {
    token,
    body: {
      full_name: 'Notify Attendant',
      phone: attendantPhone,
      email: `ol2a-${STAMP}@verify.local`,
      password: VERIFY_PASSWORD,
    },
  });
  assertStatus('attendant', attendant.status, 201, attendant.json);
  const vehicle = await request('POST', '/institution/vehicles', {
    token,
    body: { plate_number: `N10-${STAMP}`, capacity: 20 },
  });
  assertStatus('vehicle', vehicle.status, 201, vehicle.json);

  const student = await request('POST', '/institution/students', {
    token,
    body: {
      full_name: 'Notify Student',
      branch_id: branchId,
      guardian: { full_name: 'Notify Parent', phone: parentPhone, email: `ol3-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
      pickup: {
        pickup_type: 'HOME',
        latitude: 33.52,
        longitude: 36.29,
      },
    },
  });
  assertStatus('student', student.status, 201, student.json);
  const studentId = String(dataOf(student.json).id ?? '');
  const parentUserId = String(
    ((dataOf(student.json).guardian as Json | undefined)?.id as string) ?? '',
  );

  const extraParents = 299;
  const parentRows = Array.from({ length: extraParents }, (_, index) => ({
    id: randomUUID(),
    fullName: `Bulk Parent ${index + 1}`,
    phone: `+96388${(100000 + Number(STAMP) + index).toString()}`,
    role: ShuttleRole.PARENT,
    status: UserStatus.ACTIVE,
    institutionId,
    branchId,
  }));
  await prisma.shuttleUser.createMany({ data: parentRows });
  await prisma.schoolStudent.createMany({
    data: parentRows.map((parent, index) => ({
      institutionId,
      branchId,
      fullName: `Bulk Student ${index + 1}`,
      guardianUserId: parent.id,
      status: StudentStatus.ACTIVE,
    })),
  });

  const preview = await request(
    'POST',
    '/institution/notifications/audience-preview',
    { token, body: { audience: 'ALL_PARENTS' } },
  );
  assertStatus('preview', preview.status, 201, preview.json);
  const previewCount = Number(dataOf(preview.json).recipients_count ?? 0);
  if (previewCount !== 300) {
    throw new CheckError(`expected 300 parents, preview=${previewCount}`);
  }

  const parentToken = await login(parentPhone);
  assertStatus(
    'live device',
    (
      await request('POST', '/auth/devices', {
        token: parentToken,
        body: {
          device_id: 'pixel-live',
          fcm_token: 'live-fcm-token-ok',
          platform: 'ANDROID',
        },
      })
    ).status,
    201,
    {},
  );
  assertStatus(
    'dead device',
    (
      await request('POST', '/auth/devices', {
        token: parentToken,
        body: {
          device_id: 'pixel-dead',
          fcm_token: 'dead-fcm-token',
          platform: 'ANDROID',
        },
      })
    ).status,
    201,
    {},
  );

  const started = Date.now();
  const created = await request('POST', '/institution/notifications', {
    token,
    body: {
      audience: 'ALL_PARENTS',
      title: 'Holiday notice',
      body: 'No buses tomorrow.',
    },
  });
  const elapsed = Date.now() - started;
  assertStatus('create notification', created.status, 201, created.json);
  if (elapsed >= 300) {
    throw new CheckError(`create notification took ${elapsed}ms, expected < 300`);
  }
  const createdData = dataOf(created.json);
  const notificationId = String(createdData.id ?? '');
  if (Number(createdData.recipients_count) !== previewCount) {
    throw new CheckError(
      `preview ${previewCount} != created ${createdData.recipients_count}`,
    );
  }
  console.log(
    `OK  audience-preview matches ${previewCount} recipients (${elapsed}ms)`,
  );

  const workerStarted = Date.now();
  let detailData: Json | undefined;
  while (Date.now() - workerStarted < 10_000) {
    const detail = await request(
      'GET',
      `/institution/notifications/${notificationId}`,
      { token },
    );
    assertStatus('notification detail', detail.status, 200, detail.json);
    detailData = dataOf(detail.json);
    if (Number(detailData.sent_count) >= 1) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!detailData || Number(detailData.sent_count) < 1) {
    throw new CheckError(
      `expected FCM send within 10s, got ${JSON.stringify(detailData)}`,
    );
  }
  console.log('OK  300-parent notification dispatched under 10s');

  const dead = await prisma.userDevice.findFirst({
    where: { fcmToken: 'dead-fcm-token' },
  });
  if (dead) {
    throw new CheckError('dead FCM token should have been deleted');
  }
  const live = await prisma.userDevice.findFirst({
    where: { fcmToken: 'live-fcm-token-ok' },
  });
  if (!live) {
    throw new CheckError('live FCM token should remain');
  }
  console.log('OK  dead token deleted without failing the batch');

  const inbox = await request('GET', '/parent/notifications', {
    token: parentToken,
  });
  assertStatus('parent inbox', inbox.status, 200, inbox.json);
  const inboxRows = inbox.json.data as Json[];
  if (!Array.isArray(inboxRows) || inboxRows.length < 1) {
    throw new CheckError('parent inbox should contain the notice');
  }

  const driverNotify = await request('POST', '/institution/notifications', {
    token,
    body: {
      audience: 'ALL_DRIVERS',
      title: 'Driver notice',
      body: 'Please check today schedule',
    },
  });
  assertStatus('driver notification', driverNotify.status, 201, driverNotify.json);

  const driverTokenEarly = await login(driverPhone);
  assertStatus(
    'parent forbidden on driver inbox',
    (await request('GET', '/driver/notifications', { token: parentToken })).status,
    403,
    {},
  );
  const driverInbox = await request('GET', '/driver/notifications', {
    token: driverTokenEarly,
  });
  assertStatus('driver inbox', driverInbox.status, 200, driverInbox.json);
  const driverRows = driverInbox.json.data as Json[];
  if (!Array.isArray(driverRows) || driverRows.length < 1) {
    throw new CheckError('driver inbox should contain the notice');
  }
  const driverRecipientId = String(driverRows[0]?.id ?? '');
  const marked = await request(
    'PATCH',
    `/driver/notifications/${driverRecipientId}/read`,
    { token: driverTokenEarly },
  );
  assertStatus('driver mark read', marked.status, 200, marked.json);
  if (!dataOf(marked.json).read_at) {
    throw new CheckError('driver mark read should set read_at');
  }
  const readAll = await request('PATCH', '/driver/notifications/read-all', {
    token: driverTokenEarly,
  });
  assertStatus('driver read-all', readAll.status, 200, readAll.json);
  console.log('OK  driver inbox + mark-as-read');

  const attendantNotify = await request('POST', '/institution/notifications', {
    token,
    body: {
      audience: 'ALL_ATTENDANTS',
      title: 'Attendant notice',
      body: 'Please check today roster',
    },
  });
  assertStatus(
    'attendant notification',
    attendantNotify.status,
    201,
    attendantNotify.json,
  );

  const attendantToken = await login(attendantPhone);
  assertStatus(
    'driver forbidden on attendant inbox',
    (
      await request('GET', '/attendant/notifications', {
        token: driverTokenEarly,
      })
    ).status,
    403,
    {},
  );
  assertStatus(
    'parent forbidden on attendant inbox',
    (
      await request('GET', '/attendant/notifications', { token: parentToken })
    ).status,
    403,
    {},
  );
  const attendantInbox = await request('GET', '/attendant/notifications', {
    token: attendantToken,
  });
  assertStatus('attendant inbox', attendantInbox.status, 200, attendantInbox.json);
  const attendantRows = attendantInbox.json.data as Json[];
  if (!Array.isArray(attendantRows) || attendantRows.length < 1) {
    throw new CheckError('attendant inbox should contain the notice');
  }
  const attendantRecipientId = String(attendantRows[0]?.id ?? '');
  const attendantMarked = await request(
    'PATCH',
    `/attendant/notifications/${attendantRecipientId}/read`,
    { token: attendantToken },
  );
  assertStatus(
    'attendant mark read',
    attendantMarked.status,
    200,
    attendantMarked.json,
  );
  if (!dataOf(attendantMarked.json).read_at) {
    throw new CheckError('attendant mark read should set read_at');
  }
  const attendantReadAll = await request(
    'PATCH',
    '/attendant/notifications/read-all',
    { token: attendantToken },
  );
  assertStatus(
    'attendant read-all',
    attendantReadAll.status,
    200,
    attendantReadAll.json,
  );
  console.log('OK  attendant inbox + mark-as-read');

  const route = await request('POST', '/institution/routes', {
    token,
    body: {
      name: `Notify Line ${STAMP}`,
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
        body: { student_ids: [studentId] },
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
  const tripId = String(((listed.json.data as Json[]) ?? [])[0]?.id ?? '');
  await prisma.shuttleTrip.update({
    where: { id: tripId },
    data: { status: TripStatus.IN_PROGRESS, startedAt: new Date() },
  });
  if (parentUserId) {
    await prisma.parentArrivalPreference.upsert({
      where: {
        parentUserId_studentId: { parentUserId, studentId },
      },
      update: { minutesBefore: 10, soundEnabled: true },
      create: {
        parentUserId,
        studentId,
        minutesBefore: 10,
        soundEnabled: true,
      },
    });
  }

  const driverToken = await login(driverPhone);
  const ping = await request('POST', `/driver/trips/${tripId}/location`, {
    token: driverToken,
    body: { latitude: 33.52, longitude: 36.29 },
  });
  assertStatus('arrival ping', ping.status, 200, ping.json);
  const firstAlerts = await prisma.tripAlertDelivery.count({
    where: { tripId, type: 'ARRIVAL_SOON' },
  });
  if (firstAlerts !== 1) {
    throw new CheckError(`expected one arrival alert, got ${firstAlerts}`);
  }
  assertStatus(
    'second ping',
    (
      await request('POST', `/driver/trips/${tripId}/location`, {
        token: driverToken,
        body: { latitude: 33.5201, longitude: 36.2901 },
      })
    ).status,
    200,
    {},
  );
  const secondAlerts = await prisma.tripAlertDelivery.count({
    where: { tripId, type: 'ARRIVAL_SOON' },
  });
  if (secondAlerts !== 1) {
    throw new CheckError(`arrival must send once, got ${secondAlerts}`);
  }
  console.log('OK  arrival alert is once per trip/student/parent');

  await prisma.$disconnect();
  console.log('Phase 10 Definition of Done passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
