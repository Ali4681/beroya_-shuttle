import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';

const BASE =
  process.env.PHASE7_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
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

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
  const beroyaToken = await login(ADMIN_PHONE);
  const adminPhone = `+9639500${STAMP}`;
  const tomorrow = addDays(todayInDamascus(), 1);
  const dayAfter = addDays(tomorrow, 1);

  const school = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase7 School ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'Phase7 Admin', phone: adminPhone, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('create school', school.status, 201, school.json);
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
  assertStatus('create subscription', subscription.status, 201, subscription.json);
  const activated = await request(
    'POST',
    `/admin/institutions/${institutionId}/subscriptions/${dataOf(subscription.json).id}/activate`,
    { token: beroyaToken },
  );
  assertStatus('activate subscription', activated.status, 201, activated.json);

  const token = await login(adminPhone);
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

  const driverOne = await request('POST', '/institution/drivers', {
    token,
    body: { full_name: 'Trip Driver A', phone: `+9639511${STAMP}`, email: `p7-drv-a-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  const driverTwo = await request('POST', '/institution/drivers', {
    token,
    body: { full_name: 'Trip Driver B', phone: `+9639512${STAMP}`, email: `p7-drv-b-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('driver a', driverOne.status, 201, driverOne.json);
  assertStatus('driver b', driverTwo.status, 201, driverTwo.json);
  const driverA = String(dataOf(driverOne.json).id ?? '');
  const driverB = String(dataOf(driverTwo.json).id ?? '');

  const vehicle = await request('POST', '/institution/vehicles', {
    token,
    body: { plate_number: `P7-${STAMP}`, capacity: 25 },
  });
  assertStatus('vehicle', vehicle.status, 201, vehicle.json);
  const vehicleId = String(dataOf(vehicle.json).id ?? '');

  const routeIds: string[] = [];
  const studentIds: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const student = await request('POST', '/institution/students', {
      token,
      body: {
        full_name: `Trip Student ${index + 1}`,
        branch_id: branchId,
        guardian: {
          full_name: `Trip Parent ${index + 1}`,
          phone: `+96396${(300000 + Number(STAMP) + index).toString()}`,
          email: `p7-parent-${index}-${STAMP}@verify.local`,
          password: VERIFY_PASSWORD,
        },
        pickup: {
          pickup_type: 'HOME',
          latitude: 33.51 + index * 0.001,
          longitude: 36.28 + index * 0.001,
        },
      },
    });
    assertStatus(`student ${index + 1}`, student.status, 201, student.json);
    const studentId = String(dataOf(student.json).id ?? '');
    studentIds.push(studentId);

    const route = await request('POST', '/institution/routes', {
      token,
      body: {
        name: `Line ${index + 1} ${STAMP}`,
        branch_id: branchId,
        origin_lat: 33.5,
        origin_lng: 36.27,
      },
    });
    assertStatus(`route ${index + 1}`, route.status, 201, route.json);
    const routeId = String(dataOf(route.json).id ?? '');
    routeIds.push(routeId);

    const assigned = await request(
      'POST',
      `/institution/routes/${routeId}/students`,
      { token, body: { student_ids: [studentId] } },
    );
    assertStatus(`assign student ${index + 1}`, assigned.status, 201, assigned.json);

    for (const [direction, time] of [
      ['OUTBOUND', '07:30'],
      ['INBOUND', '14:00'],
    ] as const) {
      const schedule = await request(
        'POST',
        `/institution/routes/${routeId}/schedules`,
        {
          token,
          body: {
            direction,
            departure_time: time,
            days_of_week: [1, 2, 3, 4, 5, 6, 7],
          },
        },
      );
      assertStatus(`${direction} ${index + 1}`, schedule.status, 201, schedule.json);
    }

    if (index === 0) {
      const assignment = await request(
        'PATCH',
        `/institution/routes/${routeId}/default-assignment`,
        { token, body: { driver_id: driverA, vehicle_id: vehicleId } },
      );
      assertStatus('default assignment route 1', assignment.status, 200, assignment.json);
    }
  }

  const exception = await request(
    'POST',
    `/institution/students/${studentIds[0]}/route-exceptions`,
    {
      token,
      body: {
        override_route_id: routeIds[1],
        date: tomorrow,
        reason: 'Exam day',
      },
    },
  );
  assertStatus('create exception', exception.status, 201, exception.json);

  const first = await request('POST', '/institution/trips/generate', {
    token,
    body: { date: tomorrow },
  });
  assertStatus('generate tomorrow', first.status, 201, first.json);
  const firstData = dataOf(first.json);
  if (Number(firstData.trips_created) !== 20) {
    throw new CheckError(
      `expected 20 created trips, got ${JSON.stringify(firstData)}`,
    );
  }

  const second = await request('POST', '/institution/trips/generate', {
    token,
    body: { date: tomorrow },
  });
  assertStatus('generate tomorrow again', second.status, 201, second.json);
  const secondData = dataOf(second.json);
  if (
    Number(secondData.trips_created) !== 0 ||
    Number(secondData.trips_existing) !== 20
  ) {
    throw new CheckError(
      `second generate must be idempotent, got ${JSON.stringify(secondData)}`,
    );
  }
  console.log('OK  generate 10 routes × 2 schedules is idempotent');

  const listed = await request(
    'GET',
    `/institution/trips?date=${tomorrow}&limit=100`,
    { token },
  );
  assertStatus('list tomorrow', listed.status, 200, listed.json);
  const trips = rowsOf(listed.json);
  if (trips.length !== 20) {
    throw new CheckError(`expected 20 listed trips, got ${trips.length}`);
  }

  const route0Outbound = trips.find(
    (row) => row.route_id === routeIds[0] && row.direction === 'OUTBOUND',
  );
  const route1Outbound = trips.find(
    (row) => row.route_id === routeIds[1] && row.direction === 'OUTBOUND',
  );
  if (!route0Outbound || !route1Outbound) {
    throw new CheckError('missing outbound trips for exception routes');
  }
  const route0Students = await request(
    'GET',
    `/institution/trips/${route0Outbound.id}/students`,
    { token },
  );
  const route1Students = await request(
    'GET',
    `/institution/trips/${route1Outbound.id}/students`,
    { token },
  );
  assertStatus('route0 students', route0Students.status, 200, route0Students.json);
  assertStatus('route1 students', route1Students.status, 200, route1Students.json);
  const onPrimary = rowsOf(route0Students.json).some(
    (row) => row.student_id === studentIds[0],
  );
  const onOverride = rowsOf(route1Students.json).find(
    (row) => row.student_id === studentIds[0],
  );
  if (onPrimary || !onOverride || onOverride.is_exception !== true) {
    throw new CheckError('exception student must appear only on the override trip');
  }
  console.log('OK  tomorrow exception places the student on the override route only');

  const later = await request('POST', '/institution/trips/generate', {
    token,
    body: { date: dayAfter },
  });
  assertStatus('generate day after', later.status, 201, later.json);
  const laterTrips = await request(
    'GET',
    `/institution/trips?date=${dayAfter}&route_id=${routeIds[0]}&direction=OUTBOUND`,
    { token },
  );
  assertStatus('day after primary', laterTrips.status, 200, laterTrips.json);
  const laterPrimary = rowsOf(laterTrips.json)[0];
  const laterStudents = await request(
    'GET',
    `/institution/trips/${laterPrimary.id}/students`,
    { token },
  );
  if (!rowsOf(laterStudents.json).some((row) => row.student_id === studentIds[0])) {
    throw new CheckError('student must return to the primary route after the exception date');
  }
  console.log('OK  student returns to the primary route the next day');

  const originBefore = route0Outbound.origin_lat;
  const settings = await request('PATCH', '/institution/settings', {
    token,
    body: { timezone: 'Europe/Istanbul' },
  });
  assertStatus('timezone change', settings.status, 200, settings.json);
  const tripAfterTz = await request(
    'GET',
    `/institution/trips/${route0Outbound.id}`,
    { token },
  );
  assertStatus('trip after timezone', tripAfterTz.status, 200, tripAfterTz.json);
  if (dataOf(tripAfterTz.json).origin_lat !== originBefore) {
    throw new CheckError('timezone change must not rewrite generated trip snapshots');
  }

  const assignment = await request(
    'PATCH',
    `/institution/routes/${routeIds[0]}/default-assignment`,
    { token, body: { driver_id: driverB } },
  );
  assertStatus('change default driver', assignment.status, 200, assignment.json);
  const refreshed = await request(
    'GET',
    `/institution/trips/${route0Outbound.id}`,
    { token },
  );
  if (dataOf(refreshed.json).driver_id !== driverB) {
    throw new CheckError('future SCHEDULED trips must pick up the new default driver');
  }

  const overridden = await request(
    'PATCH',
    `/institution/trips/${route0Outbound.id}/override`,
    {
      token,
      body: { departure_time: '07:45', notify_users: false },
    },
  );
  assertStatus('override time', overridden.status, 200, overridden.json);
  const reassigned = await request(
    'POST',
    `/institution/trips/${route0Outbound.id}/reassign`,
    { token, body: { driver_id: driverA, reason: 'Original driver back' } },
  );
  assertStatus('reassign driver', reassigned.status, 200, reassigned.json);

  const events = await request(
    'GET',
    `/institution/trips/${route0Outbound.id}/events`,
    { token },
  );
  assertStatus('timeline', events.status, 200, events.json);
  const timeline = rowsOf(events.json);
  const types = timeline.map((row) => row.type);
  if (!types.includes('TIME_OVERRIDDEN') || !types.includes('DRIVER_CHANGED')) {
    throw new CheckError(`timeline missing required events: ${JSON.stringify(timeline)}`);
  }
  const stamps = timeline.map((row) => Date.parse(String(row.occurred_at ?? '')));
  const sorted = [...stamps].sort((a, b) => a - b);
  if (stamps.some((value, index) => value !== sorted[index] || Number.isNaN(value))) {
    throw new CheckError('timeline must be chronological with occurred_at');
  }
  if (timeline.some((row) => !row.title || !row.type)) {
    throw new CheckError('timeline rows must include type and title');
  }
  console.log('OK  trips/:id/events is a chronological TripEvent timeline');

  const route1StudentRow = onOverride;
  const corrected = await request(
    'PATCH',
    `/institution/trips/${route1Outbound.id}/students/${route1StudentRow.id}/status`,
    { token, body: { status: 'BOARDED' } },
  );
  assertStatus('correct boarding', corrected.status, 200, corrected.json);
  const history = await request(
    'GET',
    `/institution/students/${studentIds[0]}/boarding-history`,
    { token },
  );
  assertStatus('boarding history', history.status, 200, history.json);
  if (!rowsOf(history.json).some((row) => row.status === 'BOARDED')) {
    throw new CheckError('boarding-history should include the corrected boarding');
  }

  const cancelled = await request(
    'POST',
    `/institution/trips/${route0Outbound.id}/cancel`,
    { token, body: { reason: 'Weather', notify_users: false } },
  );
  assertStatus('cancel trip', cancelled.status, 200, cancelled.json);
  const routeAfterCancel = await request(
    'GET',
    `/institution/routes/${routeIds[0]}`,
    { token },
  );
  if (dataOf(routeAfterCancel.json).name == null) {
    throw new CheckError('cancel must not delete the route');
  }

  const stats = await request(
    'GET',
    `/institution/trips/stats?date=${tomorrow}`,
    { token },
  );
  assertStatus('trip stats', stats.status, 200, stats.json);
  const tripStats = dataOf(stats.json);
  if (Number(tripStats.total) !== 20 || Number(tripStats.cancelled) < 1) {
    throw new CheckError(`unexpected trip stats ${JSON.stringify(tripStats)}`);
  }

  console.log('Phase 7 Definition of Done passed');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
