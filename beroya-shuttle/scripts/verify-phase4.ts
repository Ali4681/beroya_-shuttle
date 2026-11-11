import 'dotenv/config';
import { VERIFY_PASSWORD, emailForPhone } from './verify-credentials';

const BASE =
  process.env.PHASE4_VERIFY_BASE ?? 'http://127.0.0.1:3001/api/v1/shuttle';
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

async function main(): Promise<void> {
  const beroyaToken = await login(ADMIN_PHONE);

  const beroyaDriver = await request('POST', '/admin/drivers', {
    token: beroyaToken,
    body: {
      full_name: 'Beroya Driver',
      phone: `+9639700${STAMP}`,
      email: `v1-${STAMP}@verify.local`,
      password: VERIFY_PASSWORD,
      license_number: `LIC-${STAMP}`,
    },
  });
  assertStatus('create beroya driver', beroyaDriver.status, 201, beroyaDriver.json);
  const beroyaDriverId = String(dataOf(beroyaDriver.json).id ?? '');
  if (dataOf(beroyaDriver.json).owner_type !== 'BEROYA') {
    throw new CheckError('admin driver must be BEROYA');
  }

  const beroyaVehicle = await request('POST', '/admin/vehicles', {
    token: beroyaToken,
    body: {
      plate_number: `BY-${STAMP}`,
      vehicle_type: 'bus',
      capacity: 30,
    },
  });
  assertStatus(
    'create beroya vehicle',
    beroyaVehicle.status,
    201,
    beroyaVehicle.json,
  );
  const beroyaVehicleId = String(dataOf(beroyaVehicle.json).id ?? '');

  const hybridPhone = `+9639711${STAMP}`;
  const hybrid = await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase4 Hybrid ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'HYBRID',
      admin: { full_name: 'Hybrid Admin', phone: hybridPhone, email: `ol1-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  assertStatus('create hybrid institution', hybrid.status, 201, hybrid.json);
  const hybridToken = await login(hybridPhone);

  const listed = await request('GET', '/institution/drivers', {
    token: hybridToken,
  });
  assertStatus('hybrid list drivers', listed.status, 200, listed.json);
  const driverRows = listed.json.data as Array<Json>;
  if (!driverRows.some((row) => row.id === beroyaDriverId)) {
    throw new CheckError('HYBRID institution should see the Beroya driver');
  }

  const forbidden = await request(
    'PATCH',
    `/institution/drivers/${beroyaDriverId}`,
    { token: hybridToken, body: { full_name: 'Hacked' } },
  );
  assertStatus('patch beroya driver', forbidden.status, 403, forbidden.json);
  if (errorCode(forbidden.json) !== 'RESOURCE_OWNED_BY_BEROYA') {
    throw new CheckError(
      `expected RESOURCE_OWNED_BY_BEROYA, got ${errorCode(forbidden.json)}`,
    );
  }

  const forbiddenVehicle = await request(
    'PATCH',
    `/institution/vehicles/${beroyaVehicleId}/status`,
    { token: hybridToken, body: { status: 'SUSPENDED' } },
  );
  assertStatus(
    'patch beroya vehicle',
    forbiddenVehicle.status,
    403,
    forbiddenVehicle.json,
  );
  console.log('OK  institution cannot mutate Beroya resources');

  const ownDriver = await request('POST', '/institution/drivers', {
    token: hybridToken,
    body: {
      full_name: 'School Driver',
      phone: `+9639722${STAMP}`,
      email: `v2-${STAMP}@verify.local`,
      password: VERIFY_PASSWORD,
    },
  });
  assertStatus('create institution driver', ownDriver.status, 201, ownDriver.json);

  const ownVehicle = await request('POST', '/institution/vehicles', {
    token: hybridToken,
    body: { plate_number: `SC-${STAMP}`, capacity: 20 },
  });
  assertStatus(
    'create institution vehicle',
    ownVehicle.status,
    201,
    ownVehicle.json,
  );

  const attendant = await request('POST', '/institution/attendants', {
    token: hybridToken,
    body: {
      full_name: 'School Attendant',
      phone: `+9639733${STAMP}`,
      email: `v3-${STAMP}@verify.local`,
      password: VERIFY_PASSWORD,
    },
  });
  assertStatus('create attendant', attendant.status, 201, attendant.json);

  const stats = await request('GET', '/institution/drivers/stats', {
    token: hybridToken,
  });
  assertStatus('driver stats', stats.status, 200, stats.json);
  const driverStats = dataOf(stats.json);
  if (typeof driverStats.total !== 'number' || driverStats.total < 1) {
    throw new CheckError('driver stats should count institution drivers');
  }

  const availableDrivers = await request(
    'GET',
    '/institution/resources/available-drivers',
    { token: hybridToken },
  );
  assertStatus(
    'available drivers',
    availableDrivers.status,
    200,
    availableDrivers.json,
  );
  const availableAttendants = await request(
    'GET',
    '/institution/resources/available-attendants',
    { token: hybridToken },
  );
  assertStatus(
    'available attendants',
    availableAttendants.status,
    200,
    availableAttendants.json,
  );
  const freeAttendants = availableAttendants.json.data as Array<Json>;
  if (!freeAttendants.some((row) => row.id === dataOf(attendant.json).id)) {
    throw new CheckError('new attendant should appear in available-attendants');
  }
  console.log('OK  stats and available-* dropdowns');

  const schoolPhone = `+9639744${STAMP}`;
  await request('POST', '/admin/institutions', {
    token: beroyaToken,
    body: {
      name: `Phase4 School ${STAMP}`,
      type: 'SCHOOL',
      operation_model: 'INSTITUTION_OPERATED',
      admin: { full_name: 'School Admin', phone: schoolPhone, email: `ol2-${STAMP}@verify.local`, password: VERIFY_PASSWORD },
    },
  });
  const schoolToken = await login(schoolPhone);
  const schoolDrivers = await request('GET', '/institution/drivers', {
    token: schoolToken,
  });
  assertStatus(
    'school list drivers',
    schoolDrivers.status,
    200,
    schoolDrivers.json,
  );
  const schoolRows = schoolDrivers.json.data as Array<Json>;
  if (schoolRows.some((row) => row.id === beroyaDriverId)) {
    throw new CheckError(
      'INSTITUTION_OPERATED must not see Beroya drivers',
    );
  }
  console.log('OK  INSTITUTION_OPERATED hides Beroya resources');
  console.log('Phase 4 Definition of Done passed');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
