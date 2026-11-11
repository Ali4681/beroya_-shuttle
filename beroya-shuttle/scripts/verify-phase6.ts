import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';

const BASE =
  process.env.PHASE6_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
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

function optimizeFingerprint(payload: Json): string {
  const stops = (payload.stops as Json[] | undefined) ?? [];
  return JSON.stringify({
    direction: payload.direction,
    stopIds: stops.map((stop) => stop.stop_id),
    sequences: stops.map((stop) => stop.sequence),
    distance: payload.total_distance_meters,
    duration: payload.total_duration_seconds,
  });
}

async function main(): Promise<void> {
  const beroyaToken = await login(ADMIN_PHONE);
  const adminPhone = `+9639600${STAMP}`;
  const hybridPhone = `+9639611${STAMP}`;

  const school = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase6 School ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'Phase6 Admin', phone: adminPhone, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('create school', school.status, 201, school.json);
  const schoolData = dataOf(school.json);
  const branchId = String((schoolData.branches as Json[] | undefined)?.[0]?.id ?? '');
  if (!branchId) {
    throw new CheckError('school must include a default branch');
  }

  const token = await login(adminPhone);
  const branch = await request('PATCH', `/institution/branches/${branchId}`, {
    token,
    body: {
      latitude: 33.5138,
      longitude: 36.2765,
      address: 'Mazzah',
    },
  });
  assertStatus('set branch location', branch.status, 200, branch.json);

  const meetingPoint = await request('POST', '/institution/meeting-points', {
    token,
    body: {
      name: 'Gate Cluster',
      latitude: 33.52,
      longitude: 36.29,
      branch_id: branchId,
    },
  });
  assertStatus('create meeting point', meetingPoint.status, 201, meetingPoint.json);
  const meetingPointId = String(dataOf(meetingPoint.json).id ?? '');

  const studentIds: string[] = [];
  for (let index = 0; index < 15; index += 1) {
    const home = index < 10;
    const created = await request('POST', '/institution/students', {
      token,
      body: {
        full_name: `Student ${index + 1}`,
        branch_id: branchId,
        grade: String(1 + (index % 6)),
        guardian: {
          full_name: `Parent ${index + 1}`,
          phone: `+96397${(200000 + Number(STAMP) + index).toString()}`,
          email: `p6-parent-${index}-${STAMP}@verify.local`,
          password: VERIFY_PASSWORD,
        },
        pickup: home
          ? {
              pickup_type: 'HOME',
              latitude: 33.51 + index * 0.002,
              longitude: 36.28 + index * 0.002,
              address_label: `Home ${index + 1}`,
            }
          : {
              pickup_type: 'MEETING_POINT',
              meeting_point_id: meetingPointId,
            },
      },
    });
    assertStatus(`create student ${index + 1}`, created.status, 201, created.json);
    studentIds.push(String(dataOf(created.json).id ?? ''));
  }

  const driver = await request('POST', '/institution/drivers', {
    token,
    body: {
      full_name: 'Route Driver',
      phone: `+9639622${STAMP}`,
      email: `v2-${STAMP}@verify.local`,
      password: VERIFY_PASSWORD,
    },
  });
  assertStatus('create driver', driver.status, 201, driver.json);
  const driverId = String(dataOf(driver.json).id ?? '');

  const vehicle = await request('POST', '/institution/vehicles', {
    token,
    body: { plate_number: `P6-${STAMP}`, capacity: 30 },
  });
  assertStatus('create vehicle', vehicle.status, 201, vehicle.json);
  const vehicleId = String(dataOf(vehicle.json).id ?? '');

  const attendantOne = await request('POST', '/institution/attendants', {
    token,
    body: { full_name: 'Attendant One', phone: `+9639633${STAMP}`, email: `p6-att-1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  const attendantTwo = await request('POST', '/institution/attendants', {
    token,
    body: { full_name: 'Attendant Two', phone: `+9639644${STAMP}`, email: `p6-att-2-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
  });
  assertStatus('create attendant 1', attendantOne.status, 201, attendantOne.json);
  assertStatus('create attendant 2', attendantTwo.status, 201, attendantTwo.json);
  const attendantOneId = String(dataOf(attendantOne.json).id ?? '');
  const attendantTwoId = String(dataOf(attendantTwo.json).id ?? '');

  const route = await request('POST', '/institution/routes', {
    token,
    body: {
      name: `Morning Line ${STAMP}`,
      branch_id: branchId,
      origin_label: 'Depot',
      origin_lat: 33.505,
      origin_lng: 36.27,
    },
  });
  assertStatus('create route', route.status, 201, route.json);
  const routeId = String(dataOf(route.json).id ?? '');

  const assigned = await request('POST', `/institution/routes/${routeId}/students`, {
    token,
    body: { student_ids: studentIds },
  });
  assertStatus('assign 15 students', assigned.status, 201, assigned.json);
  const assignedStudents = (dataOf(assigned.json).students as Json[] | undefined) ?? [];
  if (assignedStudents.length !== 15) {
    throw new CheckError(`expected 15 assigned students, got ${assignedStudents.length}`);
  }

  const outbound = await request('POST', `/institution/routes/${routeId}/schedules`, {
    token,
    body: {
      direction: 'OUTBOUND',
      departure_time: '07:30',
      days_of_week: [1, 2, 3, 4, 5],
    },
  });
  const inbound = await request('POST', `/institution/routes/${routeId}/schedules`, {
    token,
    body: {
      direction: 'INBOUND',
      departure_time: '14:00',
      days_of_week: [1, 2, 3, 4, 5],
    },
  });
  assertStatus('outbound schedule', outbound.status, 201, outbound.json);
  assertStatus('inbound schedule', inbound.status, 201, inbound.json);

  const extraSchedule = await request(
    'POST',
    `/institution/routes/${routeId}/schedules`,
    {
      token,
      body: {
        direction: 'OUTBOUND',
        departure_time: '08:15',
        days_of_week: [1, 2, 3, 4, 5],
      },
    },
  );
  assertStatus('school third schedule', extraSchedule.status, 409, extraSchedule.json);
  if (errorCode(extraSchedule.json) !== 'SCHOOL_SCHEDULE_LIMIT') {
    throw new CheckError(
      `expected SCHOOL_SCHEDULE_LIMIT, got ${errorCode(extraSchedule.json)}`,
    );
  }

  const assignment = await request(
    'PATCH',
    `/institution/routes/${routeId}/default-assignment`,
    {
      token,
      body: {
        driver_id: driverId,
        vehicle_id: vehicleId,
        attendant_id: attendantOneId,
      },
    },
  );
  assertStatus('default assignment', assignment.status, 200, assignment.json);

  const firstOptimize = await request(
    'POST',
    `/institution/routes/${routeId}/optimize-stops`,
    { token, body: { direction: 'OUTBOUND' } },
  );
  const secondOptimize = await request(
    'POST',
    `/institution/routes/${routeId}/optimize-stops`,
    { token, body: { direction: 'OUTBOUND' } },
  );
  assertStatus('optimize 1', firstOptimize.status, 201, firstOptimize.json);
  assertStatus('optimize 2', secondOptimize.status, 201, secondOptimize.json);
  if (
    optimizeFingerprint(dataOf(firstOptimize.json)) !==
    optimizeFingerprint(dataOf(secondOptimize.json))
  ) {
    throw new CheckError('optimize-stops must be deterministic');
  }
  if (dataOf(firstOptimize.json).persisted !== false) {
    throw new CheckError('optimize-stops must not persist');
  }
  console.log('OK  optimize-stops is deterministic and not persisted');

  const suggested = (dataOf(firstOptimize.json).stops as Json[] | undefined) ?? [];
  const saved = await request('PUT', `/institution/routes/${routeId}/stop-order`, {
    token,
    body: {
      direction: 'OUTBOUND',
      stops: suggested.map((stop) => ({
        stop_id: stop.stop_id,
        sequence: stop.sequence,
      })),
    },
  });
  assertStatus('save stop order', saved.status, 200, saved.json);
  if (dataOf(saved.json).stops_order_stale !== false) {
    throw new CheckError('saving stop-order must clear stops_order_stale');
  }
  console.log('OK  full route created with 15 students, 2 schedules, saved order');

  const secondRoute = await request('POST', '/institution/routes', {
    token,
    body: {
      name: `Second Line ${STAMP}`,
      branch_id: branchId,
      origin_lat: 33.5,
      origin_lng: 36.26,
    },
  });
  assertStatus('create second route', secondRoute.status, 201, secondRoute.json);
  const taken = await request(
    'PATCH',
    `/institution/routes/${dataOf(secondRoute.json).id}/default-assignment`,
    { token, body: { attendant_id: attendantOneId } },
  );
  assertStatus('duplicate attendant', taken.status, 409, taken.json);
  if (errorCode(taken.json) !== 'ATTENDANT_ALREADY_ASSIGNED') {
    throw new CheckError(
      `expected ATTENDANT_ALREADY_ASSIGNED, got ${errorCode(taken.json)}`,
    );
  }
  console.log('OK  attendant cannot be assigned to two routes');

  const free = await request(
    'PATCH',
    `/institution/routes/${dataOf(secondRoute.json).id}/default-assignment`,
    { token, body: { attendant_id: attendantTwoId } },
  );
  assertStatus('second attendant', free.status, 200, free.json);

  const stats = await request('GET', '/institution/routes/stats', { token });
  assertStatus('route stats', stats.status, 200, stats.json);
  const routeStats = dataOf(stats.json);
  if (
    Number(routeStats.total) < 2 ||
    Number(routeStats.active) < 2 ||
    typeof routeStats.suspended !== 'number' ||
    typeof routeStats.stopped_today !== 'number' ||
    typeof routeStats.unavailable !== 'number'
  ) {
    throw new CheckError(`unexpected route stats ${JSON.stringify(routeStats)}`);
  }
  console.log('OK  routes/stats');

  const pickupChange = await request(
    'PATCH',
    `/institution/students/${studentIds[0]}/pickup`,
    {
      token,
      body: {
        pickup_type: 'HOME',
        latitude: 33.54,
        longitude: 36.32,
      },
    },
  );
  assertStatus('pickup change', pickupChange.status, 200, pickupChange.json);
  const afterPickup = await request('GET', `/institution/routes/${routeId}`, {
    token,
  });
  assertStatus('route after pickup change', afterPickup.status, 200, afterPickup.json);
  if (dataOf(afterPickup.json).stops_order_stale !== true) {
    throw new CheckError('pickup change on an assigned student must mark stops_order_stale');
  }

  const beroyaDriver = await request('POST', '/admin/drivers', {
    token: beroyaToken,
    body: {
      full_name: 'Beroya Route Driver',
      phone: `+9639655${STAMP}`,
      email: `v3-${STAMP}@verify.local`,
      password: VERIFY_PASSWORD,
      license_number: `P6-${STAMP}`,
    },
  });
  assertStatus('create beroya driver', beroyaDriver.status, 201, beroyaDriver.json);
  const beroyaDriverId = String(dataOf(beroyaDriver.json).id ?? '');

  const denied = await request(
    'PATCH',
    `/institution/routes/${routeId}/default-assignment`,
    { token, body: { driver_id: beroyaDriverId } },
  );
  assertStatus('school cannot assign beroya driver', denied.status, 403, denied.json);

  const hybrid = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase6 Hybrid ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'HYBRID',
      admin: { full_name: 'Hybrid Admin', phone: hybridPhone, email: `ol2-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('create hybrid', hybrid.status, 201, hybrid.json);
  const hybridBranchId = String(
    (dataOf(hybrid.json).branches as Json[] | undefined)?.[0]?.id ?? '',
  );
  const hybridToken = await login(hybridPhone);
  await request('PATCH', `/institution/branches/${hybridBranchId}`, {
    token: hybridToken,
    body: { latitude: 33.5, longitude: 36.28 },
  });
  const hybridRoute = await request('POST', '/institution/routes', {
    token: hybridToken,
    body: {
      name: `Hybrid Line ${STAMP}`,
      branch_id: hybridBranchId,
      origin_lat: 33.49,
      origin_lng: 36.27,
    },
  });
  assertStatus('hybrid route', hybridRoute.status, 201, hybridRoute.json);
  const hybridAssign = await request(
    'PATCH',
    `/institution/routes/${dataOf(hybridRoute.json).id}/default-assignment`,
    { token: hybridToken, body: { driver_id: beroyaDriverId } },
  );
  assertStatus('hybrid assigns beroya driver', hybridAssign.status, 200, hybridAssign.json);
  console.log('OK  HYBRID can assign a Beroya driver');

  console.log('Phase 6 Definition of Done passed');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
