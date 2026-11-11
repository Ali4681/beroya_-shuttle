import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const BASE =
  process.env.PHASE12_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
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

async function activateInstitution(
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

async function main(): Promise<void> {
  const prisma = prismaClient();
  const beroyaToken = await login(ADMIN_PHONE);
  const adminPhone = `+9639840${STAMP}`;
  const parentPhone = `+9639841${STAMP}`;
  const otherParentPhone = `+9639842${STAMP}`;
  const driverPhone = `+9639843${STAMP}`;
  const uniAdminPhone = `+9639844${STAMP}`;
  const uniStudentPhone = `+9639845${STAMP}`;
  const uniDriverPhone = `+9639846${STAMP}`;
  const supportPhone = `+9631100${STAMP}`;
  const today = todayInDamascus();

  const school = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase12 School ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'Phase12 Admin', phone: adminPhone, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('school', school.status, 201, school.json);
  const institutionId = String(dataOf(school.json).id ?? '');
  const branchId = String(
    (dataOf(school.json).branches as Json[] | undefined)?.[0]?.id ?? '',
  );
  await activateInstitution(beroyaToken, institutionId);

  const token = await login(adminPhone);
  assertStatus(
    'branding',
    (
      await request('PATCH', '/institution/branding', {
        token,
        body: {
          use_institution_identity: true,
          support_phone: supportPhone,
        },
      })
    ).status,
    200,
    {},
  );
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
    body: { full_name: 'Parent-visible Driver', phone: driverPhone, email: `ol2-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('driver', driver.status, 201, driver.json);
  const vehicle = await request('POST', '/institution/vehicles', {
    token,
    body: { plate_number: `P12-${STAMP}`, capacity: 20 },
  });
  assertStatus('vehicle', vehicle.status, 201, vehicle.json);

  const childA = await request('POST', '/institution/students', {
    token,
    body: {
      full_name: 'Child Five',
      branch_id: branchId,
      guardian: { full_name: 'Shared Parent', phone: parentPhone, email: `ol3-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
      pickup: { pickup_type: 'HOME', latitude: 33.52, longitude: 36.29 },
    },
  });
  assertStatus('child A', childA.status, 201, childA.json);
  const childB = await request('POST', '/institution/students', {
    token,
    body: {
      full_name: 'Child Fifteen',
      branch_id: branchId,
      guardian: { full_name: 'Shared Parent', phone: parentPhone, email: `ol4-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
      pickup: { pickup_type: 'HOME', latitude: 33.52, longitude: 36.29 },
    },
  });
  assertStatus('child B', childB.status, 201, childB.json);
  const stranger = await request('POST', '/institution/students', {
    token,
    body: {
      full_name: 'Other Family Child',
      branch_id: branchId,
      guardian: { full_name: 'Other Parent', phone: otherParentPhone, email: `ol5-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
      pickup: { pickup_type: 'HOME', latitude: 33.53, longitude: 36.3 },
    },
  });
  assertStatus('stranger', stranger.status, 201, stranger.json);
  const childAId = String(dataOf(childA.json).id ?? '');
  const childBId = String(dataOf(childB.json).id ?? '');
  const strangerId = String(dataOf(stranger.json).id ?? '');

  const route = await request('POST', '/institution/routes', {
    token,
    body: {
      name: `Parent Line ${STAMP}`,
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
        body: { student_ids: [childAId, childBId] },
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
  const tripId = String(rowsOf(listed.json)[0]?.id ?? '');

  const parentToken = await login(parentPhone);
  const otherParentToken = await login(otherParentPhone);
  const driverToken = await login(driverPhone);

  const me = await request('GET', '/parent/me', { token: parentToken });
  assertStatus('parent me', me.status, 200, me.json);
  const meData = dataOf(me.json);
  const kids = meData.students as Json[] | undefined;
  if (!Array.isArray(kids) || kids.length !== 2) {
    throw new CheckError(`parent/me must list 2 children, got ${JSON.stringify(meData)}`);
  }
  if (kids.some((row) => row.id === strangerId)) {
    throw new CheckError('parent/me leaked another family');
  }
  if ((meData.branding as Json | undefined)?.support_phone !== supportPhone) {
    throw new CheckError('parent/me must include branding.support_phone');
  }
  for (const kid of kids) {
    if (typeof kid.institution_name !== 'string' || !kid.institution_name) {
      throw new CheckError('parent/me students must include institution_name');
    }
    if (!('active_trip_id' in kid)) {
      throw new CheckError('parent/me students must include active_trip_id');
    }
    if (!('last_dropped_off_at' in kid)) {
      throw new CheckError('parent/me students must include last_dropped_off_at');
    }
  }
  leakScan('parent/me', me.json, [driverPhone]);

  const listedKids = await request('GET', '/parent/students', {
    token: parentToken,
  });
  assertStatus('parent students', listedKids.status, 200, listedKids.json);
  if (rowsOf(listedKids.json).length !== 2) {
    throw new CheckError('parent students must be exactly the two children');
  }
  assertStatus(
    'foreign child',
    (await request('GET', `/parent/students/${strangerId}`, { token: parentToken }))
      .status,
    404,
    {},
  );
  assertStatus(
    'other parent cannot read child A',
    (await request('GET', `/parent/students/${childAId}`, { token: otherParentToken }))
      .status,
    404,
    {},
  );

  assertStatus(
    'parent cannot patch student',
    (
      await request('PATCH', `/parent/students/${childAId}`, {
        token: parentToken,
        body: { full_name: 'Hacked' },
      })
    ).status,
    403,
    {},
  );
  assertStatus(
    'parent cannot patch institution student',
    (
      await request('PATCH', `/institution/students/${childAId}`, {
        token: parentToken,
        body: { full_name: 'Hacked' },
      })
    ).status,
    403,
    {},
  );
  assertStatus(
    'parent cannot patch route',
    (
      await request('PATCH', `/institution/routes/${routeId}`, {
        token: parentToken,
        body: { name: 'Hacked Line' },
      })
    ).status,
    403,
    {},
  );
  console.log('OK  parent sees only their two children and cannot edit student/route');

  const prefA = await request(
    'PATCH',
    `/parent/students/${childAId}/arrival-preference`,
    { token: parentToken, body: { minutes_before: 5, sound_enabled: true } },
  );
  assertStatus('pref 5', prefA.status, 200, prefA.json);
  if (Number(dataOf(prefA.json).minutes_before) !== 5) {
    throw new CheckError('preference 5 was not saved');
  }
  const prefB = await request(
    'PATCH',
    `/parent/students/${childBId}/arrival-preference`,
    { token: parentToken, body: { minutes_before: 15, sound_enabled: true } },
  );
  assertStatus('pref 15', prefB.status, 200, prefB.json);

  const childStop = await prisma.tripStudent.findFirst({
    where: { tripId, studentId: childAId },
    include: { tripStop: true },
  });
  if (!childStop?.tripStop) {
    throw new CheckError('child A is not linked to a trip stop');
  }
  assertStatus(
    'start',
    (await request('POST', `/driver/trips/${tripId}/start`, { token: driverToken }))
      .status,
    200,
    {},
  );
  const earlierStops = await prisma.tripStop.findMany({
    where: { tripId, sequence: { lt: childStop.tripStop.sequence } },
  });
  for (const stop of earlierStops) {
    assertStatus(
      `arrive earlier ${stop.sequence}`,
      (
        await request('POST', `/driver/trips/${tripId}/stops/${stop.id}/arrive`, {
          token: driverToken,
        })
      ).status,
      200,
      {},
    );
  }
  const ping = await request('POST', `/driver/trips/${tripId}/location`, {
    token: driverToken,
    body: {
      latitude: childStop.tripStop.latitude + 0.025,
      longitude: childStop.tripStop.longitude,
    },
  });
  assertStatus('arrival ping', ping.status, 200, ping.json);

  const tripStudents = await prisma.tripStudent.findMany({
    where: { tripId, studentId: { in: [childAId, childBId] } },
    include: { tripStop: true },
  });
  const now = Date.now();
  const expected = new Map<string, boolean>();
  const remainders: Record<string, number> = {};
  for (const row of tripStudents) {
    const remaining = row.tripStop?.etaAt
      ? row.tripStop.etaAt.getTime() - now
      : Number.POSITIVE_INFINITY;
    remainders[row.studentId] = remaining / 60_000;
    const minutes = row.studentId === childAId ? 5 : 15;
    expected.set(
      row.studentId,
      remaining >= -60_000 && remaining <= minutes * 60_000,
    );
  }
  if (expected.get(childAId) === expected.get(childBId)) {
    throw new CheckError(
      `ETA window did not separate 5 vs 15 minutes: ${JSON.stringify({
        expected: Object.fromEntries(expected),
        remainders,
      })}`,
    );
  }
  const alerts = await prisma.tripAlertDelivery.findMany({
    where: { tripId, type: 'ARRIVAL_SOON' },
  });
  const alertStudentIds = new Set(alerts.map((row) => row.studentId));
  if (alertStudentIds.has(childAId) !== Boolean(expected.get(childAId))) {
    throw new CheckError('5-minute preference did not match the stop ETA window');
  }
  if (alertStudentIds.has(childBId) !== Boolean(expected.get(childBId))) {
    throw new CheckError('15-minute preference did not match the stop ETA window');
  }
  console.log('OK  arrival preference is saved and changes when the alert fires');

  const active = await request('GET', `/parent/students/${childAId}/active-trip`, {
    token: parentToken,
  });
  assertStatus('active-trip', active.status, 200, active.json);
  const activeData = dataOf(active.json);
  if (activeData.id !== tripId) {
    throw new CheckError(`active-trip missing ${JSON.stringify(active.json)}`);
  }
  if (activeData.support_phone !== supportPhone) {
    throw new CheckError('active-trip must expose support_phone only');
  }
  leakScan('active-trip', active.json, [driverPhone]);

  const live = await request('GET', `/parent/trips/${tripId}/live`, {
    token: parentToken,
  });
  assertStatus('parent live', live.status, 200, live.json);
  const liveStops = dataOf(live.json).stops as Json[] | undefined;
  if (!Array.isArray(liveStops) || liveStops.length === 0) {
    throw new CheckError('parent live must include stops[]');
  }
  const firstStop = liveStops[0];
  for (const key of [
    'id',
    'sequence',
    'stop_type',
    'status',
    'latitude',
    'longitude',
  ]) {
    if (!(key in firstStop)) {
      throw new CheckError(`parent live stop missing ${key}`);
    }
  }
  if (!('student_stop_id' in dataOf(live.json))) {
    throw new CheckError('parent live must include student_stop_id');
  }
  leakScan('parent live', live.json, [driverPhone]);
  assertStatus(
    'other parent live',
    (await request('GET', `/parent/trips/${tripId}/live`, { token: otherParentToken }))
      .status,
    404,
    {},
  );

  const trips = await request(
    'GET',
    `/parent/students/${childAId}/trips?from=${today}&to=${today}`,
    { token: parentToken },
  );
  assertStatus('child trips', trips.status, 200, trips.json);
  if (!rowsOf(trips.json).some((row) => (row.trip as Json | undefined)?.id === tripId)) {
    throw new CheckError('child trips must include today outbound');
  }

  const absencePath = `/parent/students/${childBId}/trips/${tripId}/absence`;
  const absenceReason = `مريض ${STAMP}`;
  const absence = await request('POST', absencePath, {
    token: parentToken,
    body: { reason: absenceReason },
  });
  assertStatus('parent absence', absence.status, 200, absence.json);
  const absenceData = dataOf(absence.json);
  if (
    absenceData.student_id !== childBId ||
    absenceData.trip_id !== tripId ||
    absenceData.status !== 'ABSENT' ||
    !absenceData.not_boarded_at ||
    absenceData.reason !== absenceReason
  ) {
    throw new CheckError(`parent absence payload ${JSON.stringify(absence.json)}`);
  }
  const absenceAgain = await request('POST', absencePath, {
    token: parentToken,
    body: { reason: 'should not replace' },
  });
  assertStatus('parent absence idempotent', absenceAgain.status, 200, absenceAgain.json);
  if (dataOf(absenceAgain.json).reason !== absenceReason) {
    throw new CheckError('idempotent absence must keep original reason');
  }
  const crewNotices = await prisma.shuttleNotification.findMany({
    where: {
      origin: 'SYSTEM',
      data: { path: ['type'], equals: 'STUDENT_ABSENT' },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const absenceNotices = crewNotices.filter((row) => {
    const data = row.data as Json | null;
    return data?.tripId === tripId && data?.studentId === childBId;
  });
  if (absenceNotices.length < 1) {
    throw new CheckError('parent absence must notify crew at least once');
  }
  const noticeCountBefore = absenceNotices.length;
  await request('POST', absencePath, { token: parentToken, body: { reason: absenceReason } });
  const noticeCountAfter = (
    await prisma.shuttleNotification.findMany({
      where: {
        origin: 'SYSTEM',
        data: { path: ['type'], equals: 'STUDENT_ABSENT' },
      },
    })
  ).filter((row) => {
    const data = row.data as Json | null;
    return data?.tripId === tripId && data?.studentId === childBId;
  }).length;
  if (noticeCountAfter !== noticeCountBefore) {
    throw new CheckError('idempotent absence must not re-notify crew');
  }
  assertStatus(
    'other parent cannot mark absence',
    (await request('POST', absencePath, { token: otherParentToken })).status,
    404,
    {},
  );
  const history = await request(
    'GET',
    `/parent/students/${childBId}/boarding-history`,
    { token: parentToken },
  );
  assertStatus('boarding after absence', history.status, 200, history.json);
  if (
    !rowsOf(history.json).some(
      (row) =>
        row.status === 'ABSENT' &&
        (row.trip as Json | undefined)?.id === tripId,
    )
  ) {
    throw new CheckError('boarding-history must reflect parent absence');
  }
  const liveAfter = await request('GET', `/parent/trips/${tripId}/live`, {
    token: parentToken,
  });
  assertStatus('live after absence', liveAfter.status, 200, liveAfter.json);
  console.log('OK  parent absence marks ABSENT');

  const uni = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase12 Uni ${STAMP}`,
      type: 'UNIVERSITY',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'Uni Admin', phone: uniAdminPhone, email: `ol6-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('university', uni.status, 201, uni.json);
  const uniId = String(dataOf(uni.json).id ?? '');
  const uniBranch = String(
    (dataOf(uni.json).branches as Json[] | undefined)?.[0]?.id ?? '',
  );
  await activateInstitution(beroyaToken, uniId);
  const uniToken = await login(uniAdminPhone);
  assertStatus(
    'uni branding',
    (
      await request('PATCH', '/institution/branding', {
        token: uniToken,
        body: { support_phone: supportPhone },
      })
    ).status,
    200,
    {},
  );
  assertStatus(
    'uni branch',
    (
      await request('PATCH', `/institution/branches/${uniBranch}`, {
        token: uniToken,
        body: { latitude: 33.51, longitude: 36.27 },
      })
    ).status,
    200,
    {},
  );
  const uniStudent = await request('POST', '/institution/university-students', {
    token: uniToken,
    body: {
      full_name: 'Uni Rider',
      phone: uniStudentPhone,
      email: `v1-${STAMP}@verify.local`,
      password: VERIFY_PASSWORD,
      branch_id: uniBranch,
      faculty: 'Engineering',
    },
  });
  assertStatus('uni student', uniStudent.status, 201, uniStudent.json);
  const uniDriver = await request('POST', '/institution/drivers', {
    token: uniToken,
    body: { full_name: 'Uni Driver', phone: uniDriverPhone, email: `ol7-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('uni driver', uniDriver.status, 201, uniDriver.json);
  const uniVehicle = await request('POST', '/institution/vehicles', {
    token: uniToken,
    body: { plate_number: `U12-${STAMP}`, capacity: 40 },
  });
  assertStatus('uni vehicle', uniVehicle.status, 201, uniVehicle.json);
  const uniRoute = await request('POST', '/institution/routes', {
    token: uniToken,
    body: {
      name: `Campus Line ${STAMP}`,
      branch_id: uniBranch,
      origin_lat: 33.51,
      origin_lng: 36.27,
    },
  });
  assertStatus('uni route', uniRoute.status, 201, uniRoute.json);
  const uniRouteId = String(dataOf(uniRoute.json).id ?? '');
  assertStatus(
    'uni schedule',
    (
      await request('POST', `/institution/routes/${uniRouteId}/schedules`, {
        token: uniToken,
        body: {
          direction: 'OUTBOUND',
          departure_time: '08:00',
          days_of_week: [1, 2, 3, 4, 5, 6, 7],
        },
      })
    ).status,
    201,
    {},
  );
  assertStatus(
    'uni assignment',
    (
      await request('PATCH', `/institution/routes/${uniRouteId}/default-assignment`, {
        token: uniToken,
        body: {
          driver_id: String(dataOf(uniDriver.json).id ?? ''),
          vehicle_id: String(dataOf(uniVehicle.json).id ?? ''),
        },
      })
    ).status,
    200,
    {},
  );
  assertStatus(
    'uni generate',
    (
      await request('POST', '/institution/trips/generate', {
        token: uniToken,
        body: { date: today, route_id: uniRouteId },
      })
    ).status,
    201,
    {},
  );
  const uniTrips = await request(
    'GET',
    `/institution/trips?date=${today}&route_id=${uniRouteId}&direction=OUTBOUND`,
    { token: uniToken },
  );
  assertStatus('uni trips', uniTrips.status, 200, uniTrips.json);
  const uniTripId = String(rowsOf(uniTrips.json)[0]?.id ?? '');

  const riderToken = await login(uniStudentPhone);
  const uniMe = await request('GET', '/university/me', { token: riderToken });
  assertStatus('university me', uniMe.status, 200, uniMe.json);
  if ((dataOf(uniMe.json).branding as Json | undefined)?.support_phone !== supportPhone) {
    throw new CheckError('university/me must include branding');
  }
  leakScan('university/me', uniMe.json, [uniDriverPhone, driverPhone]);

  const uniRoutes = await request('GET', '/university/routes', {
    token: riderToken,
  });
  assertStatus('university routes', uniRoutes.status, 200, uniRoutes.json);
  if (!rowsOf(uniRoutes.json).some((row) => row.id === uniRouteId)) {
    throw new CheckError('university student must see every campus route');
  }
  leakScan('university routes', uniRoutes.json, [uniDriverPhone]);

  const uniToday = await request('GET', '/university/trips/today', {
    token: riderToken,
  });
  assertStatus('university today', uniToday.status, 200, uniToday.json);
  if (!rowsOf(uniToday.json).some((row) => row.id === uniTripId)) {
    throw new CheckError('university today must list the generated trip');
  }
  leakScan('university today', uniToday.json, [uniDriverPhone]);

  const uniLive = await request('GET', `/university/trips/${uniTripId}/live`, {
    token: riderToken,
  });
  assertStatus('university live', uniLive.status, 200, uniLive.json);
  leakScan('university live', uniLive.json, [uniDriverPhone, driverPhone]);
  assertStatus(
    'university cannot follow school trip',
    (await request('GET', `/university/trips/${tripId}/live`, { token: riderToken }))
      .status,
    404,
    {},
  );
  console.log('OK  no driver phone on /parent/* or /university/* payloads');

  await prisma.$disconnect();
  console.log('Phase 12 Definition of Done passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
