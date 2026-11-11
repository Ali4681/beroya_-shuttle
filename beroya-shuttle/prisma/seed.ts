import 'dotenv/config';
import { randomUUID } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Prisma,
  PrismaClient,
  ShuttleRole,
  UserStatus,
} from '../src/generated/prisma/client';
import { hashPassword, normalizeEmail } from '../src/common/utils/password';
import type {
  DeliveryStatus,
  IncidentType,
  InstitutionType,
  NotificationAudience,
  NotificationOrigin,
  OperationModel,
  ResourceStatus,
  RouteStatus,
  StopType,
  StudentStatus,
  StudentSubscriptionType,
  TripDirection,
  TripEventType,
  TripStatus,
  TripStudentStatus,
  VehicleStatus,
} from '../src/generated/prisma/client';
import {
  addCalendarDays,
  clockInTimezone,
  isoWeekdayInTimezone,
  todayInTimezone,
  zonedDateTime,
} from '../src/common/utils/timezone';

/*
 * Usage:
 *   npx prisma db seed            -> Beroya admin + full demo data (skipped if it already exists)
 *   npm run prisma:seed:reset     -> delete the demo data and recreate it
 *   npm run prisma:seed:live      -> re-push live GPS for in-progress demo trips (needs the API running)
 *
 * Dashboard / app users sign in with email and password (SEED_DEMO_PASSWORD or SEED_ADMIN_PASSWORD, default BeroyaAdmin1).
 * Full scenario packs are printed at the end:
 *   SCHOOL DEMO-S (Aziziyeh), SCHOOL DEMO-F (Furqan), UNI DEMO-U (university),
 *   PARENT-ABSENCE-LIVE (IN_PROGRESS + student PENDING for parent absence QA).
 */

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const TZ = 'Asia/Damascus';
const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;
const SEED_PHONE_PREFIX = '+96393';
const SCHOOL_DAYS = [6, 7, 1, 2, 3, 4];
const WORK_DAYS = [7, 1, 2, 3, 4];

const NAMES = {
  school: 'مدرسة الأمل الخاصة',
  university: 'جامعة حلب الدولية',
  company: 'شركة الشام للاتصالات',
  suspended: 'مدرسة النور النموذجية',
  pending: 'معهد الفيحاء للغات',
} as const;

const BEROYA_PLATES = ['BRY-1001', 'BRY-1002', 'BRY-1003'];

const now = new Date();
const today = todayInTimezone(TZ, now);

const phone = (n: number) => `${SEED_PHONE_PREFIX}${String(n).padStart(7, '0')}`;
const demoEmail = (n: number) => `user${String(n).padStart(7, '0')}@beroya.local`;
const uuid = () => randomUUID();
const at = (base: Date, minutes: number) => new Date(base.getTime() + minutes * MINUTE);
const daysAgo = (days: number) => at(now, -days * DAY_MINUTES);
const daysFromNow = (days: number) => at(now, days * DAY_MINUTES);
const weekday = (date: Date) => isoWeekdayInTimezone(date, TZ);
const json = (value: unknown) => value as Prisma.InputJsonValue;

let rngState = 20261003;
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
const jitter = (max: number) => Math.round(rand() * max);

function liveClock(minutesAgo: number): string {
  const nowClock = clockInTimezone(now, TZ);
  const clock = clockInTimezone(at(now, -minutesAgo), TZ);
  return clock > nowClock ? '00:00' : clock;
}

// =============================================================================
// Types
// =============================================================================

type Crew = {
  driverId?: string;
  driverUserId?: string;
  vehicleId?: string;
  attendantId?: string;
  attendantUserId?: string;
};

type StudentCtx = {
  id: string;
  name: string;
  guardianUserId: string;
  subscriptionType: StudentSubscriptionType;
};

type StopDef = {
  id: string;
  sequence: number;
  stopType: StopType;
  label: string;
  lat: number;
  lng: number;
  meetingPointId?: string;
  offset: number | null;
  studentIds: string[];
};

type ScheduleCtx = { id: string; time: string; days: number[] };

type RouteCtx = {
  id: string;
  name: string;
  institutionId: string;
  branchId: string;
  origin: { label: string; lat: number; lng: number };
  delayThreshold: number;
  crew: Crew;
  stops: Record<TripDirection, StopDef[]>;
  students: StudentCtx[];
  schedules: Record<TripDirection, ScheduleCtx[]>;
};

type Pickup = {
  stopType: 'STUDENT_HOME' | 'MEETING_POINT' | 'CUSTOM';
  label: string;
  lat: number;
  lng: number;
  meetingPointId?: string;
  studentIds: string[];
};

type TripPlan = {
  route: RouteCtx;
  direction: TripDirection;
  date: Date;
  time: string;
  scheduleId: string | null;
  status: TripStatus;
  arrived?: number;
  delay?: number;
  notBoarded?: string[];
  /** Keep these students PENDING even if their board stop already has arrivedAt (parent live-absence demos). */
  forcePending?: string[];
  excludeStudents?: string[];
  extraStudents?: StudentCtx[];
  crew?: Crew;
  cancelReason?: string;
  actorUserId?: string;
  overriddenFrom?: string;
};

type BuiltStop = {
  id: string;
  def: StopDef;
  planned: Date;
  arrivedAt: Date | null;
};

type BuiltTrip = {
  id: string;
  plan: TripPlan;
  crew: Crew;
  departure: Date;
  stops: BuiltStop[];
  riders: Array<{
    id: string;
    student: StudentCtx;
    status: TripStudentStatus;
    stopIndex: number;
  }>;
};

// =============================================================================
// Generic builders
// =============================================================================

type UserInput = {
  fullName: string;
  phone: string;
  email?: string;
  passwordHash?: string;
  role: ShuttleRole;
  institutionId?: string | null;
  branchId?: string | null;
  status?: UserStatus;
  createdAt?: Date;
  lastLoginAt?: Date | null;
};

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? 'BeroyaAdmin1';
/** Dedicated parent account for live-trip absence QA (parent app «تسجيل غياب»). */
const PARENT_ABSENCE_LIVE_EMAIL = 'parent.absence.live@beroya.test';
const PARENT_ABSENCE_LIVE_PASSWORD = 'Password123!';
let demoPasswordHash: Promise<string> | null = null;
function sharedPasswordHash() {
  demoPasswordHash ??= hashPassword(DEMO_PASSWORD);
  return demoPasswordHash;
}

async function createUser(input: UserInput) {
  const digits = input.phone.replace(/\D/g, '').slice(-7);
  return prisma.shuttleUser.create({
    data: {
      status: UserStatus.ACTIVE,
      phoneVerifiedAt: input.createdAt ?? now,
      ...input,
      email: input.email ?? `user${digits}@beroya.local`,
      passwordHash: input.passwordHash ?? (await sharedPasswordHash()),
    },
  });
}

async function createDriver(input: {
  name: string;
  phone: string;
  institutionId: string | null;
  branchId?: string | null;
  nationalId: string;
  license: string;
  licenseExpiryDays: number;
  status?: ResourceStatus;
  createdAt: Date;
}) {
  const status = input.status ?? 'ACTIVE';
  const user = await createUser({
    fullName: input.name,
    phone: input.phone,
    role: ShuttleRole.DRIVER,
    institutionId: input.institutionId,
    branchId: input.branchId ?? null,
    status: status === 'ACTIVE' ? UserStatus.ACTIVE : UserStatus.SUSPENDED,
    createdAt: input.createdAt,
    lastLoginAt: status === 'ACTIVE' ? daysAgo(1) : null,
  });
  const profile = await prisma.driverProfile.create({
    data: {
      userId: user.id,
      institutionId: input.institutionId,
      ownerType: input.institutionId ? 'INSTITUTION' : 'BEROYA',
      nationalId: input.nationalId,
      licenseNumber: input.license,
      licenseExpiry: daysFromNow(input.licenseExpiryDays),
      status,
      createdAt: input.createdAt,
    },
  });
  return { id: profile.id, userId: user.id, name: input.name, phone: input.phone };
}

async function createVehicle(input: {
  institutionId: string | null;
  plate: string;
  type: string;
  capacity: number;
  status?: VehicleStatus;
  licenseExpiryDays: number;
  insuranceExpiryDays: number;
  createdAt: Date;
}) {
  const vehicle = await prisma.shuttleVehicle.create({
    data: {
      institutionId: input.institutionId,
      ownerType: input.institutionId ? 'INSTITUTION' : 'BEROYA',
      plateNumber: input.plate,
      vehicleType: input.type,
      capacity: input.capacity,
      status: input.status ?? 'ACTIVE',
      licenseExpiry: daysFromNow(input.licenseExpiryDays),
      insuranceExpiry: daysFromNow(input.insuranceExpiryDays),
      createdAt: input.createdAt,
    },
  });
  return { id: vehicle.id, plate: vehicle.plateNumber };
}

async function createAttendant(input: {
  name: string;
  phone: string;
  institutionId: string;
  branchId: string;
  nationalId: string;
  status?: ResourceStatus;
  createdAt: Date;
}) {
  const status = input.status ?? 'ACTIVE';
  const user = await createUser({
    fullName: input.name,
    phone: input.phone,
    role: ShuttleRole.ATTENDANT,
    institutionId: input.institutionId,
    branchId: input.branchId,
    status: status === 'ACTIVE' ? UserStatus.ACTIVE : UserStatus.SUSPENDED,
    createdAt: input.createdAt,
  });
  const profile = await prisma.attendantProfile.create({
    data: {
      userId: user.id,
      institutionId: input.institutionId,
      nationalId: input.nationalId,
      status,
      createdAt: input.createdAt,
    },
  });
  return { id: profile.id, userId: user.id, name: input.name, phone: input.phone };
}

async function createInstitution(input: {
  name: string;
  displayName: string;
  type: InstitutionType;
  operationModel: OperationModel;
  status?: 'ACTIVE' | 'SUSPENDED';
  statusReason?: string;
  contactPhone: string;
  contactEmail: string;
  city?: string;
  address: string;
  createdAt: Date;
  settings?: Partial<{
    defaultDelayThresholdMinutes: number;
    defaultParentArrivalAlertMinutes: number;
    gpsStaleAfterSeconds: number;
    locationPingIntervalSeconds: number;
  }>;
  branding?: Partial<{
    useInstitutionIdentity: boolean;
    primaryColor: string;
    secondaryColor: string;
    welcomeMessage: string;
    supportPhone: string;
  }>;
}) {
  return prisma.institution.create({
    data: {
      name: input.name,
      displayName: input.displayName,
      type: input.type,
      operationModel: input.operationModel,
      status: input.status ?? 'ACTIVE',
      statusReason: input.statusReason,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      city: input.city,
      address: input.address,
      createdAt: input.createdAt,
      settings: { create: { timezone: TZ, ...input.settings } },
      branding: { create: { ...input.branding } },
    },
  });
}

async function createBranch(input: {
  institutionId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  status?: ResourceStatus;
  createdAt: Date;
}) {
  const branch = await prisma.institutionBranch.create({
    data: {
      institutionId: input.institutionId,
      name: input.name,
      address: input.address,
      latitude: input.lat,
      longitude: input.lng,
      status: input.status ?? 'ACTIVE',
      createdAt: input.createdAt,
    },
  });
  return { id: branch.id, name: branch.name, lat: input.lat, lng: input.lng };
}

async function createAdmin(input: {
  institutionId: string;
  branchId: string;
  name: string;
  phone: string;
  email: string;
  createdAt: Date;
}) {
  const admin = await createUser({
    fullName: input.name,
    phone: input.phone,
    email: normalizeEmail(input.email),
    passwordHash: await sharedPasswordHash(),
    role: ShuttleRole.INSTITUTION_ADMIN,
    institutionId: input.institutionId,
    branchId: input.branchId,
    createdAt: input.createdAt,
    lastLoginAt: daysAgo(0.2),
  });
  await prisma.institution.update({
    where: { id: input.institutionId },
    data: { primaryAdminUserId: admin.id },
  });
  return admin;
}

async function createMeetingPoint(input: {
  institutionId: string;
  branchId: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  status?: ResourceStatus;
}) {
  const point = await prisma.meetingPoint.create({
    data: {
      institutionId: input.institutionId,
      branchId: input.branchId,
      name: input.name,
      addressLabel: input.address,
      latitude: input.lat,
      longitude: input.lng,
      status: input.status ?? 'ACTIVE',
      createdAt: daysAgo(40),
    },
  });
  return { id: point.id, name: point.name, lat: input.lat, lng: input.lng };
}

async function createRoute(input: {
  institutionId: string;
  branch: { id: string; name: string; lat: number; lng: number };
  name: string;
  code: string;
  status?: RouteStatus;
  origin: { label: string; lat: number; lng: number };
  delayThreshold?: number | null;
  defaultDelay: number;
  crew: Crew;
  pickups: Pickup[];
  students: StudentCtx[];
  schedules: Array<{
    direction: TripDirection;
    time: string;
    days: number[];
    isActive?: boolean;
  }>;
  staleOrder?: boolean;
  createdAt: Date;
}): Promise<RouteCtx> {
  const route = await prisma.shuttleRoute.create({
    data: {
      institutionId: input.institutionId,
      branchId: input.branch.id,
      name: input.name,
      code: input.code,
      status: input.status ?? 'ACTIVE',
      originLabel: input.origin.label,
      originLat: input.origin.lat,
      originLng: input.origin.lng,
      delayThresholdMinutes: input.delayThreshold ?? null,
      defaultDriverId: input.crew.driverId ?? null,
      defaultVehicleId: input.crew.vehicleId ?? null,
      defaultAttendantId: input.crew.attendantId ?? null,
      createdAt: input.createdAt,
    },
  });

  const stale = input.staleOrder === true;
  const pickupDef = (pickup: Pickup, sequence: number, offset: number): StopDef => ({
    id: uuid(),
    sequence,
    stopType: pickup.stopType,
    label: pickup.label,
    lat: pickup.lat,
    lng: pickup.lng,
    meetingPointId: pickup.meetingPointId,
    offset: stale ? null : offset,
    studentIds: pickup.studentIds,
  });
  const institutionDef = (sequence: number, offset: number): StopDef => ({
    id: uuid(),
    sequence,
    stopType: 'INSTITUTION',
    label: input.branch.name,
    lat: input.branch.lat,
    lng: input.branch.lng,
    offset,
    studentIds: [],
  });

  const outbound: StopDef[] = [
    ...input.pickups.map((pickup, index) => pickupDef(pickup, index + 1, 5 + index * 6)),
    institutionDef(input.pickups.length + 1, 9 + input.pickups.length * 6),
  ];
  const inbound: StopDef[] = [
    institutionDef(1, 0),
    ...[...input.pickups]
      .reverse()
      .map((pickup, index) => pickupDef(pickup, index + 2, 8 + index * 6)),
  ];

  const stopRows: Prisma.RouteStopCreateManyInput[] = [];
  const linkRows: Prisma.RouteStopStudentCreateManyInput[] = [];
  for (const [direction, defs] of [
    ['OUTBOUND', outbound],
    ['INBOUND', inbound],
  ] as const) {
    for (const def of defs) {
      stopRows.push({
        id: def.id,
        routeId: route.id,
        direction,
        sequence: def.sequence,
        stopType: def.stopType,
        label: def.label,
        latitude: def.lat,
        longitude: def.lng,
        meetingPointId: def.meetingPointId ?? null,
        etaOffsetMinutes: def.offset,
      });
      for (const studentId of def.studentIds) {
        linkRows.push({ routeStopId: def.id, studentId });
      }
    }
  }
  await prisma.routeStop.createMany({ data: stopRows });
  if (linkRows.length) {
    await prisma.routeStopStudent.createMany({ data: linkRows });
  }
  if (input.students.length) {
    await prisma.studentRouteAssignment.createMany({
      data: input.students.map((student) => ({
        studentId: student.id,
        routeId: route.id,
        startedAt: input.createdAt,
      })),
    });
  }

  const schedules: Record<TripDirection, ScheduleCtx[]> = { OUTBOUND: [], INBOUND: [] };
  for (const schedule of input.schedules) {
    const created = await prisma.routeSchedule.create({
      data: {
        routeId: route.id,
        direction: schedule.direction,
        departureTime: schedule.time,
        daysOfWeek: schedule.days,
        isActive: schedule.isActive ?? true,
        createdAt: input.createdAt,
      },
    });
    if (schedule.isActive !== false) {
      schedules[schedule.direction].push({
        id: created.id,
        time: schedule.time,
        days: schedule.days,
      });
    }
  }

  return {
    id: route.id,
    name: route.name,
    institutionId: input.institutionId,
    branchId: input.branch.id,
    origin: input.origin,
    delayThreshold: input.delayThreshold ?? input.defaultDelay,
    crew: input.crew,
    stops: { OUTBOUND: outbound, INBOUND: inbound },
    students: input.students,
    schedules,
  };
}

// =============================================================================
// Trips
// =============================================================================

function ridesDirection(type: StudentSubscriptionType, direction: TripDirection) {
  if (type === 'OUTBOUND_ONLY') return direction === 'OUTBOUND';
  if (type === 'INBOUND_ONLY') return direction === 'INBOUND';
  return true;
}

async function buildTrip(plan: TripPlan): Promise<BuiltTrip> {
  const { route, direction } = plan;
  const crew = plan.crew ?? route.crew;
  const id = uuid();
  const delay = plan.delay ?? 0;
  const departure = zonedDateTime(plan.date, plan.time, TZ);
  const started = plan.status === 'IN_PROGRESS' || plan.status === 'COMPLETED';
  const startedAt = started ? at(departure, delay) : null;
  const defs = route.stops[direction];

  const arrivedCount =
    plan.status === 'COMPLETED'
      ? defs.length
      : plan.status === 'IN_PROGRESS'
        ? Math.min(plan.arrived ?? 1, defs.length - 1)
        : 0;

  const stops: BuiltStop[] = defs.map((def, index) => {
    const planned = at(departure, def.offset ?? index * 6);
    const arrivedAt =
      index < arrivedCount ? at(planned, delay + (index === 0 ? 0 : jitter(2))) : null;
    return { id: uuid(), def, planned, arrivedAt };
  });

  const stopIndexByStudent = new Map<string, number>();
  defs.forEach((def, index) =>
    def.studentIds.forEach((studentId) => stopIndexByStudent.set(studentId, index)),
  );
  const firstPickup = Math.max(
    0,
    defs.findIndex((def) => def.stopType !== 'INSTITUTION'),
  );
  const institutionIndex = defs.findIndex((def) => def.stopType === 'INSTITUTION');

  const riders: BuiltTrip['riders'] = [];
  const studentRows: Prisma.TripStudentCreateManyInput[] = [];
  const events: Prisma.TripEventCreateManyInput[] = [];
  const pings: Prisma.TripLocationPingCreateManyInput[] = [];
  const markerId = crew.attendantUserId ?? crew.driverUserId ?? null;

  const event = (
    type: TripEventType,
    occurredAt: Date,
    title: string,
    extra: { actorUserId?: string | null; description?: string; data?: unknown } = {},
  ) => {
    events.push({
      id: uuid(),
      tripId: id,
      type,
      occurredAt,
      title,
      actorUserId: extra.actorUserId ?? null,
      description: extra.description ?? null,
      data: extra.data === undefined ? undefined : json(extra.data),
    });
  };

  if (plan.overriddenFrom && plan.overriddenFrom !== plan.time) {
    event('TIME_OVERRIDDEN', at(departure, -90), 'Departure time overridden', {
      actorUserId: plan.actorUserId,
      description: `${plan.overriddenFrom} → ${plan.time}`,
      data: { from: plan.overriddenFrom, to: plan.time },
    });
  }

  if (startedAt) {
    event('TRIP_STARTED', startedAt, 'Trip started', { actorUserId: crew.driverUserId });
  }

  stops.forEach((stop, index) => {
    if (!stop.arrivedAt) return;
    event('STOP_ARRIVED', stop.arrivedAt, `Arrived at ${stop.def.label}`, {
      actorUserId: crew.driverUserId,
      data: { tripStopId: stop.id, sequence: index + 1 },
    });
    pings.push({
      tripId: id,
      latitude: stop.def.lat,
      longitude: stop.def.lng,
      speedKph: 18 + jitter(25),
      heading: jitter(359),
      accuracy: 5 + jitter(10),
      recordedAt: stop.arrivedAt,
    });
  });

  const candidates = [
    ...route.students
      .filter((student) => ridesDirection(student.subscriptionType, direction))
      .filter((student) => !plan.excludeStudents?.includes(student.id))
      .map((student) => ({ student, isException: false })),
    ...(plan.extraStudents ?? []).map((student) => ({ student, isException: true })),
  ];

  for (const { student, isException } of candidates) {
    const stopIndex = isException
      ? firstPickup
      : (stopIndexByStudent.get(student.id) ?? firstPickup);
    const boardIndex = direction === 'OUTBOUND' ? stopIndex : institutionIndex;
    const dropIndex = direction === 'OUTBOUND' ? institutionIndex : stopIndex;
    const boardStop = stops[boardIndex];
    const dropStop = stops[dropIndex];
    const tripStudentId = uuid();

    let status: TripStudentStatus = 'PENDING';
    let boardedAt: Date | null = null;
    let droppedOffAt: Date | null = null;
    let notBoardedAt: Date | null = null;

    if (boardStop?.arrivedAt && !plan.forcePending?.includes(student.id)) {
      if (plan.notBoarded?.includes(student.id)) {
        status = 'NOT_BOARDED';
        notBoardedAt = at(boardStop.arrivedAt, 1);
        event('STUDENT_NOT_BOARDED', notBoardedAt, 'Student not boarded', {
          actorUserId: markerId,
          description: student.name,
          data: { tripStudentId, studentId: student.id },
        });
      } else {
        status = 'BOARDED';
        boardedAt = at(boardStop.arrivedAt, 1);
        event('STUDENT_BOARDED', boardedAt, 'Student boarded', {
          actorUserId: markerId,
          description: student.name,
          data: { tripStudentId, studentId: student.id },
        });
        if (dropStop?.arrivedAt) {
          status = 'DROPPED_OFF';
          droppedOffAt = at(dropStop.arrivedAt, 1);
          event('STUDENT_DROPPED_OFF', droppedOffAt, 'Student dropped off', {
            actorUserId: markerId,
            description: student.name,
            data: { tripStudentId, studentId: student.id },
          });
        }
      }
    }

    riders.push({ id: tripStudentId, student, status, stopIndex });
    studentRows.push({
      id: tripStudentId,
      tripId: id,
      studentId: student.id,
      tripStopId: stops[stopIndex]?.id ?? null,
      status,
      isException,
      boardedAt,
      droppedOffAt,
      notBoardedAt,
      markedByUserId: status === 'PENDING' ? null : markerId,
    });
  }

  let delayDetectedAt: Date | null = null;
  if (started && delay > 0 && delay >= route.delayThreshold) {
    delayDetectedAt = at(departure, route.delayThreshold);
    event('DELAY_DETECTED', delayDetectedAt, 'Delay detected', {
      description: `${delay} min`,
      data: { delayMinutes: delay },
    });
  }

  let completedAt: Date | null = null;
  if (plan.status === 'COMPLETED') {
    completedAt = at(stops[stops.length - 1].arrivedAt ?? departure, 2);
    event('TRIP_COMPLETED', completedAt, 'Trip completed', { actorUserId: crew.driverUserId });
  }

  let cancelledAt: Date | null = null;
  if (plan.status === 'CANCELLED') {
    cancelledAt = at(departure, -45);
    event('TRIP_CANCELLED', cancelledAt, 'Trip cancelled', {
      actorUserId: plan.actorUserId,
      description: plan.cancelReason,
      data: { reason: plan.cancelReason },
    });
  }

  let lastLocation: { lat: number; lng: number; at: Date } | null = null;
  let etaToNextStopAt: Date | null = null;
  let etaToFinishAt: Date | null = null;
  if (plan.status === 'IN_PROGRESS') {
    const from = stops[arrivedCount - 1].def;
    const to = stops[arrivedCount].def;
    lastLocation = {
      lat: from.lat + (to.lat - from.lat) * 0.55,
      lng: from.lng + (to.lng - from.lng) * 0.55,
      at: at(now, -0.5),
    };
    pings.push({
      tripId: id,
      latitude: lastLocation.lat,
      longitude: lastLocation.lng,
      speedKph: 32,
      heading: 90,
      accuracy: 8,
      recordedAt: lastLocation.at,
    });
    etaToNextStopAt = at(stops[arrivedCount].planned, delay);
    etaToFinishAt = at(stops[stops.length - 1].planned, delay);
  } else if (plan.status === 'COMPLETED') {
    const last = stops[stops.length - 1];
    lastLocation = { lat: last.def.lat, lng: last.def.lng, at: last.arrivedAt ?? departure };
  }

  await prisma.shuttleTrip.create({
    data: {
      id,
      institutionId: route.institutionId,
      branchId: route.branchId,
      routeId: route.id,
      scheduleId: plan.scheduleId,
      direction,
      status: plan.status,
      serviceDate: plan.date,
      scheduledDepartureTime: plan.time,
      originLabel: route.origin.label,
      originLat: route.origin.lat,
      originLng: route.origin.lng,
      driverId: crew.driverId ?? null,
      vehicleId: crew.vehicleId ?? null,
      attendantId: crew.attendantId ?? null,
      startedAt,
      completedAt,
      cancelledAt,
      cancelReason: plan.cancelReason ?? null,
      delayThresholdMinutes: route.delayThreshold,
      delayMinutes: started ? delay : 0,
      delayDetectedAt,
      lastLocationLat: lastLocation?.lat ?? null,
      lastLocationLng: lastLocation?.lng ?? null,
      lastLocationAt: lastLocation?.at ?? null,
      etaToNextStopAt,
      etaToFinishAt,
      createdAt: new Date(Math.min(now.getTime(), at(departure, -DAY_MINUTES).getTime())),
    },
  });

  await prisma.tripStop.createMany({
    data: stops.map((stop, index) => ({
      id: stop.id,
      tripId: id,
      routeStopId: stop.def.id,
      sequence: index + 1,
      stopType: stop.def.stopType,
      label: stop.def.label,
      latitude: stop.def.lat,
      longitude: stop.def.lng,
      status: stop.arrivedAt ? 'ARRIVED' : 'PENDING',
      plannedArrivalAt: stop.planned,
      etaAt: stop.arrivedAt || plan.status !== 'IN_PROGRESS' ? null : at(stop.planned, delay),
      arrivedAt: stop.arrivedAt,
    })),
  });
  if (studentRows.length) await prisma.tripStudent.createMany({ data: studentRows });
  if (events.length) await prisma.tripEvent.createMany({ data: events });
  if (pings.length) await prisma.tripLocationPing.createMany({ data: pings });

  return { id, plan, crew, departure, stops, riders };
}

async function addIncident(
  trip: BuiltTrip,
  input: {
    type: IncidentType;
    reportedByUserId: string;
    description: string;
    minutesAfterStart: number;
    resolved?: { byUserId: string; notes: string; afterMinutes: number };
  },
) {
  const reportedAt = at(trip.departure, input.minutesAfterStart);
  const nearStop = trip.stops[Math.min(1, trip.stops.length - 1)].def;
  const incident = await prisma.tripIncident.create({
    data: {
      tripId: trip.id,
      type: input.type,
      status: input.resolved ? 'RESOLVED' : 'OPEN',
      reportedByUserId: input.reportedByUserId,
      description: input.description,
      latitude: nearStop.lat + 0.0012,
      longitude: nearStop.lng + 0.0009,
      resolvedAt: input.resolved ? at(reportedAt, input.resolved.afterMinutes) : null,
      resolvedByUserId: input.resolved?.byUserId ?? null,
      resolutionNotes: input.resolved?.notes ?? null,
      createdAt: reportedAt,
    },
  });
  await prisma.tripEvent.create({
    data: {
      tripId: trip.id,
      type: input.type === 'BREAKDOWN' ? 'BREAKDOWN_REPORTED' : 'EMERGENCY_TRIGGERED',
      actorUserId: input.reportedByUserId,
      title: input.type === 'BREAKDOWN' ? 'Breakdown reported' : 'Emergency triggered',
      description: input.description,
      data: json({ incidentId: incident.id }),
      occurredAt: reportedAt,
    },
  });
  if (input.resolved) {
    await prisma.tripEvent.create({
      data: {
        tripId: trip.id,
        type: 'INCIDENT_RESOLVED',
        actorUserId: input.resolved.byUserId,
        title: 'Incident resolved',
        description: input.resolved.notes,
        data: json({ incidentId: incident.id }),
        occurredAt: at(reportedAt, input.resolved.afterMinutes),
      },
    });
  }
  return incident;
}

async function correctStudentStatus(
  trip: BuiltTrip,
  actorUserId: string,
  from: TripStudentStatus,
) {
  const rider = trip.riders.find((item) => item.status === 'DROPPED_OFF');
  if (!rider) return;
  const correctedAt = at(trip.departure, 180);
  await prisma.tripStudent.update({
    where: { id: rider.id },
    data: { correctedAt, markedByUserId: actorUserId },
  });
  await prisma.tripEvent.create({
    data: {
      tripId: trip.id,
      type: 'STUDENT_STATUS_CORRECTED',
      actorUserId,
      title: 'Student status corrected',
      description: `${rider.student.name}: ${from} → DROPPED_OFF`,
      data: json({ tripStudentId: rider.id, from, to: 'DROPPED_OFF' }),
      occurredAt: correctedAt,
    },
  });
}

function pastServiceDates(count: number, days: number[]): Date[] {
  const dates: Date[] = [];
  for (let offset = -1; dates.length < count && offset > -30; offset -= 1) {
    const date = addCalendarDays(today, offset);
    if (days.includes(weekday(date))) dates.push(date);
  }
  return dates;
}

function nextServiceDate(days: number[]): Date {
  for (let offset = 1; offset < 8; offset += 1) {
    const date = addCalendarDays(today, offset);
    if (days.includes(weekday(date))) return date;
  }
  return addCalendarDays(today, 1);
}

async function scheduleDay(route: RouteCtx, date: Date, status: TripStatus = 'SCHEDULED') {
  const trips: BuiltTrip[] = [];
  for (const direction of ['OUTBOUND', 'INBOUND'] as const) {
    for (const schedule of route.schedules[direction]) {
      if (!schedule.days.includes(weekday(date))) continue;
      trips.push(
        await buildTrip({
          route,
          direction,
          date,
          time: schedule.time,
          scheduleId: schedule.id,
          status,
          delay: status === 'COMPLETED' ? jitter(6) : 0,
          notBoarded:
            status === 'COMPLETED' && route.students.length && rand() < 0.35
              ? [route.students[Math.floor(rand() * route.students.length)].id]
              : [],
        }),
      );
    }
  }
  return trips;
}

// =============================================================================
// Communication & audit
// =============================================================================

async function createNotification(input: {
  institutionId: string;
  branchId?: string | null;
  routeId?: string | null;
  audience: NotificationAudience;
  origin: NotificationOrigin;
  title: string;
  body: string;
  sentByUserId?: string | null;
  createdAt: Date;
  recipients: string[];
  data?: unknown;
}) {
  const statuses: DeliveryStatus[] = input.recipients.map((_, index) =>
    index % 9 === 4 ? 'FAILED' : index % 3 === 0 ? 'SENT' : 'DELIVERED',
  );
  const failed = statuses.filter((status) => status === 'FAILED').length;
  await prisma.shuttleNotification.create({
    data: {
      institutionId: input.institutionId,
      branchId: input.branchId ?? null,
      routeId: input.routeId ?? null,
      audience: input.audience,
      origin: input.origin,
      title: input.title,
      body: input.body,
      data: input.data === undefined ? undefined : json(input.data),
      recipientsCount: input.recipients.length,
      sentCount: input.recipients.length - failed,
      failedCount: failed,
      sentByUserId: input.sentByUserId ?? null,
      createdAt: input.createdAt,
      recipients: {
        create: input.recipients.map((userId, index) => ({
          userId,
          status: statuses[index],
          sentAt: statuses[index] === 'FAILED' ? null : at(input.createdAt, 0.2),
          deliveredAt: statuses[index] === 'DELIVERED' ? at(input.createdAt, 1) : null,
          readAt: index % 5 === 0 ? at(input.createdAt, 2) : null,
          errorMessage: statuses[index] === 'FAILED' ? 'Device token is no longer registered' : null,
          createdAt: input.createdAt,
        })),
      },
    },
  });
}

type AuditInput = {
  institutionId?: string | null;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  createdAt: Date;
};

async function createAuditLogs(entries: AuditInput[]) {
  await prisma.shuttleAuditLog.createMany({
    data: entries.map((entry, index) => ({
      institutionId: entry.institutionId ?? null,
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: entry.before === undefined ? undefined : json(entry.before),
      after: entry.after === undefined ? undefined : json(entry.after),
      ipAddress: `10.0.0.${10 + (index % 40)}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/154.0',
      createdAt: entry.createdAt,
    })),
  });
}

// =============================================================================
// Seed sections
// =============================================================================

async function ensureBeroyaAdmin() {
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '+963900000000';
  const fullName = process.env.SEED_ADMIN_NAME ?? 'Beroya Admin';
  const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL ?? 'admin@beroya.local');
  const passwordHash = await hashPassword(process.env.SEED_ADMIN_PASSWORD ?? 'BeroyaAdmin1');
  const existing = await prisma.shuttleUser.findFirst({
    where: { phone: adminPhone, role: ShuttleRole.BEROYA_ADMIN, institutionId: null },
  });
  if (existing) {
    if (!existing.email || !existing.passwordHash) {
      await prisma.shuttleUser.update({
        where: { id: existing.id },
        data: { email: existing.email ?? email, passwordHash: existing.passwordHash ?? passwordHash },
      });
      console.log(`BEROYA_ADMIN login set: ${existing.email ?? email}`);
    } else {
      console.log(`BEROYA_ADMIN already exists: ${existing.id} (${existing.email})`);
    }
    return existing;
  }
  const admin = await prisma.shuttleUser.create({
    data: {
      fullName,
      phone: adminPhone,
      email,
      passwordHash,
      role: ShuttleRole.BEROYA_ADMIN,
      status: UserStatus.ACTIVE,
      phoneVerifiedAt: new Date(),
    },
  });
  console.log(`Created BEROYA_ADMIN: ${admin.email}`);
  return admin;
}

async function seedBeroyaResources() {
  const drivers = {
    samer: await createDriver({
      name: 'سامر الحلبي',
      phone: phone(10),
      institutionId: null,
      nationalId: '01020304050',
      license: 'DL-551203',
      licenseExpiryDays: 420,
      createdAt: daysAgo(120),
    }),
    maher: await createDriver({
      name: 'ماهر العلي',
      phone: phone(11),
      institutionId: null,
      nationalId: '01020304051',
      license: 'DL-551204',
      licenseExpiryDays: 25,
      createdAt: daysAgo(110),
    }),
    wassim: await createDriver({
      name: 'وسيم قاسم',
      phone: phone(12),
      institutionId: null,
      nationalId: '01020304052',
      license: 'DL-551205',
      licenseExpiryDays: 200,
      status: 'SUSPENDED',
      createdAt: daysAgo(100),
    }),
  };
  const vehicles = {
    bus1: await createVehicle({
      institutionId: null,
      plate: BEROYA_PLATES[0],
      type: 'باص هيونداي كاونتي',
      capacity: 28,
      licenseExpiryDays: 300,
      insuranceExpiryDays: 180,
      createdAt: daysAgo(120),
    }),
    bus2: await createVehicle({
      institutionId: null,
      plate: BEROYA_PLATES[1],
      type: 'ميكروباص تويوتا هايس',
      capacity: 14,
      licenseExpiryDays: 250,
      insuranceExpiryDays: 20,
      createdAt: daysAgo(115),
    }),
    bus3: await createVehicle({
      institutionId: null,
      plate: BEROYA_PLATES[2],
      type: 'باص كيا جرانبيرد',
      capacity: 40,
      status: 'UNDER_MAINTENANCE',
      licenseExpiryDays: 90,
      insuranceExpiryDays: 90,
      createdAt: daysAgo(90),
    }),
  };
  return { drivers, vehicles };
}

async function seedSchool(
  beroyaAdminId: string,
  beroya: Awaited<ReturnType<typeof seedBeroyaResources>>,
) {
  const created = daysAgo(75);
  const school = await createInstitution({
    name: NAMES.school,
    displayName: 'الأمل',
    type: 'SCHOOL',
    operationModel: 'BEROYA_OPERATED',
    contactPhone: '+963112233440',
    contactEmail: 'info@alamal-school.sy',
    city: 'حلب',
    address: 'حلب - العزيزية - شارع الخليل',
    createdAt: created,
    settings: { defaultDelayThresholdMinutes: 10, defaultParentArrivalAlertMinutes: 10 },
    branding: {
      useInstitutionIdentity: true,
      primaryColor: '#0F766E',
      secondaryColor: '#F59E0B',
      welcomeMessage: 'أهلاً بكم في خدمة النقل المدرسي لمدرسة الأمل في حلب',
      supportPhone: '+963112233441',
    },
  });

  const mezzeh = await createBranch({
    institutionId: school.id,
    name: 'فرع العزيزية',
    address: 'العزيزية - شارع الخليل',
    lat: 36.207,
    lng: 37.152,
    createdAt: created,
  });
  const malki = await createBranch({
    institutionId: school.id,
    name: 'فرع حلب الجديدة',
    address: 'حلب الجديدة - شارع الجامعة',
    lat: 36.2,
    lng: 37.107,
    createdAt: created,
  });
  const admin = await createAdmin({
    institutionId: school.id,
    branchId: mezzeh.id,
    name: 'ريم الأيوبي',
    phone: phone(1),
    email: 'reem@beroya.local',
    createdAt: created,
  });

  await prisma.institutionSubscription.createMany({
    data: [
      {
        institutionId: school.id,
        billingPeriod: 'TERM',
        status: 'EXPIRED',
        startsAt: daysAgo(100),
        endsAt: daysAgo(11),
        agreedAmount: 950,
        currencyCode: 'USD',
        notes: 'الفصل الدراسي الثاني',
        activatedAt: daysAgo(100),
        createdAt: daysAgo(105),
      },
      {
        institutionId: school.id,
        billingPeriod: 'MONTHLY',
        status: 'ACTIVE',
        startsAt: daysAgo(10),
        endsAt: daysFromNow(20),
        agreedAmount: 350,
        currencyCode: 'USD',
        notes: 'اشتراك شهري — 4 خطوط',
        activatedAt: daysAgo(10),
        createdAt: daysAgo(12),
      },
      {
        institutionId: school.id,
        billingPeriod: 'MONTHLY',
        status: 'PENDING',
        startsAt: daysFromNow(20),
        endsAt: daysFromNow(50),
        agreedAmount: 380,
        currencyCode: 'USD',
        notes: 'تجديد بانتظار الدفع',
        createdAt: daysAgo(1),
      },
    ],
  });

  const meetingPoints = {
    mezzeh: await createMeetingPoint({
      institutionId: school.id,
      branchId: mezzeh.id,
      name: 'دوار العزيزية',
      address: 'أمام صيدلية الشفاء',
      lat: 36.2085,
      lng: 37.1495,
    }),
    umayyad: await createMeetingPoint({
      institutionId: school.id,
      branchId: null,
      name: 'ساحة سعدالله الجابري',
      address: 'جانب فندق الشيراتون',
      lat: 36.211,
      lng: 37.1455,
    }),
    jahez: await createMeetingPoint({
      institutionId: school.id,
      branchId: malki.id,
      name: 'حديقة السبيل',
      address: 'المدخل الشمالي للحديقة',
      lat: 36.2125,
      lng: 37.1555,
      status: 'SUSPENDED',
    }),
  };

  const drivers = {
    hassan: await createDriver({
      name: 'حسان الدرة',
      phone: phone(20),
      institutionId: school.id,
      branchId: mezzeh.id,
      nationalId: '02030405060',
      license: 'DL-662301',
      licenseExpiryDays: 500,
      createdAt: created,
    }),
    bassel: await createDriver({
      name: 'باسل حداد',
      phone: phone(21),
      institutionId: school.id,
      branchId: mezzeh.id,
      nationalId: '02030405061',
      license: 'DL-662302',
      licenseExpiryDays: 18,
      createdAt: created,
    }),
    nizar: await createDriver({
      name: 'نزار عيسى',
      phone: phone(22),
      institutionId: school.id,
      branchId: malki.id,
      nationalId: '02030405062',
      license: 'DL-662303',
      licenseExpiryDays: 300,
      createdAt: daysAgo(30),
    }),
  };
  const vehicles = {
    v1: await createVehicle({
      institutionId: school.id,
      plate: 'حلب 512341',
      type: 'باص مرسيدس سبرينتر',
      capacity: 20,
      licenseExpiryDays: 280,
      insuranceExpiryDays: 140,
      createdAt: created,
    }),
    v2: await createVehicle({
      institutionId: school.id,
      plate: 'حلب 512342',
      type: 'باص هيونداي كاونتي',
      capacity: 26,
      licenseExpiryDays: 200,
      insuranceExpiryDays: 15,
      createdAt: created,
    }),
    v3: await createVehicle({
      institutionId: school.id,
      plate: 'حلب 512343',
      type: 'ميكروباص كيا',
      capacity: 14,
      licenseExpiryDays: 330,
      insuranceExpiryDays: 300,
      createdAt: daysAgo(30),
    }),
    v4: await createVehicle({
      institutionId: school.id,
      plate: 'حلب 512344',
      type: 'باص إيسوزو',
      capacity: 30,
      status: 'UNDER_MAINTENANCE',
      licenseExpiryDays: 120,
      insuranceExpiryDays: 60,
      createdAt: daysAgo(60),
    }),
  };
  const attendants = {
    salma: await createAttendant({
      name: 'سلمى الزين',
      phone: phone(30),
      institutionId: school.id,
      branchId: mezzeh.id,
      nationalId: '03040506070',
      createdAt: created,
    }),
    dima: await createAttendant({
      name: 'ديما الأحمد',
      phone: phone(31),
      institutionId: school.id,
      branchId: mezzeh.id,
      nationalId: '03040506071',
      createdAt: created,
    }),
    rasha: await createAttendant({
      name: 'رشا يوسف',
      phone: phone(32),
      institutionId: school.id,
      branchId: malki.id,
      nationalId: '03040506072',
      createdAt: created,
    }),
    hiba: await createAttendant({
      name: 'هبة النجار',
      phone: phone(33),
      institutionId: school.id,
      branchId: malki.id,
      nationalId: '03040506073',
      createdAt: daysAgo(20),
    }),
    amal: await createAttendant({
      name: 'أمل عرنوس',
      phone: phone(34),
      institutionId: school.id,
      branchId: mezzeh.id,
      nationalId: '03040506074',
      status: 'SUSPENDED',
      createdAt: daysAgo(50),
    }),
  };

  const parentDefs = [
    ['رامي الخطيب', 'mezzeh'],
    ['هالة الشامي', 'mezzeh'],
    ['فادي الحسن', 'mezzeh'],
    ['سامي المصري', 'mezzeh'],
    ['لمى النابلسي', 'mezzeh'],
    ['طارق العظمة', 'mezzeh'],
    ['عبير السيد', 'mezzeh'],
    ['جورج البيطار', 'mezzeh'],
    ['منى القباني', 'malki'],
    ['وائل الدقاق', 'malki'],
    ['رنا الأتاسي', 'malki'],
    ['بشار الجابي', 'malki'],
    ['نادين الزعيم', 'malki'],
    ['خلدون الحمصي', 'mezzeh'],
  ] as const;
  const parents = [];
  for (const [index, [name, branchKey]] of parentDefs.entries()) {
    parents.push(
      await createUser({
        fullName: name,
        phone: phone(40 + index),
        role: ShuttleRole.PARENT,
        institutionId: school.id,
        branchId: branchKey === 'mezzeh' ? mezzeh.id : malki.id,
        status: index === 13 ? UserStatus.SUSPENDED : UserStatus.ACTIVE,
        createdAt: daysAgo(60 - index),
        lastLoginAt: index % 3 === 0 ? daysAgo(index % 5) : null,
      }),
    );
  }

  type StudentDef = {
    key: string;
    name: string;
    grade: string;
    section: string;
    branch: 'mezzeh' | 'malki';
    parent: number;
    home?: { lat: number; lng: number; label: string };
    meetingPoint?: 'mezzeh' | 'umayyad';
    subscriptionType?: StudentSubscriptionType;
    status?: StudentStatus;
  };
  const studentDefs: StudentDef[] = [
    { key: 's1', name: 'لين الخطيب', grade: 'الصف الثالث', section: 'أ', branch: 'mezzeh', parent: 0, home: { lat: 36.2055, lng: 37.1542, label: 'العزيزية - شارع الخليل - بناء 14' } },
    { key: 's2', name: 'عمر الشامي', grade: 'الصف الخامس', section: 'ب', branch: 'mezzeh', parent: 1, home: { lat: 36.2068, lng: 37.1508, label: 'العزيزية - شارع المدارس' } },
    { key: 's3', name: 'جود الحسن', grade: 'الصف الرابع', section: 'أ', branch: 'mezzeh', parent: 2, home: { lat: 36.2082, lng: 37.1482, label: 'العزيزية - قرب ساحة المحافظة' } },
    { key: 's4', name: 'يزن المصري', grade: 'الصف السادس', section: 'أ', branch: 'mezzeh', parent: 3, meetingPoint: 'mezzeh' },
    { key: 's5', name: 'ميرا المصري', grade: 'الصف الثاني', section: 'ب', branch: 'mezzeh', parent: 3, meetingPoint: 'mezzeh' },
    { key: 's6', name: 'تيم النابلسي', grade: 'الصف الأول', section: 'أ', branch: 'mezzeh', parent: 4, home: { lat: 36.2062, lng: 37.1415, label: 'الجميلية - شارع الفارابي' } },
    { key: 's7', name: 'ريم العظمة', grade: 'الصف الثالث', section: 'ب', branch: 'mezzeh', parent: 5, home: { lat: 36.2075, lng: 37.1398, label: 'الجميلية - قرب المسجد' } },
    { key: 's8', name: 'آدم السيد', grade: 'الصف الخامس', section: 'أ', branch: 'mezzeh', parent: 6, home: { lat: 36.205, lng: 37.1435, label: 'الجميلية البلد' } },
    { key: 's9', name: 'سارة البيطار', grade: 'الصف السادس', section: 'ب', branch: 'mezzeh', parent: 7, home: { lat: 36.2042, lng: 37.146, label: 'الجميلية - بناء 3' }, subscriptionType: 'OUTBOUND_ONLY' },
    { key: 's10', name: 'زين القباني', grade: 'الصف الرابع', section: 'ب', branch: 'malki', parent: 8, meetingPoint: 'umayyad' },
    { key: 's11', name: 'نور القباني', grade: 'الصف الأول', section: 'ب', branch: 'malki', parent: 8, meetingPoint: 'umayyad' },
    { key: 's12', name: 'حلا الدقاق', grade: 'الصف الثاني', section: 'أ', branch: 'malki', parent: 9, home: { lat: 36.2015, lng: 37.1095, label: 'حلب الجديدة - شارع الروضة' } },
    { key: 's13', name: 'مجد الأتاسي', grade: 'الصف الخامس', section: 'ب', branch: 'malki', parent: 10, home: { lat: 36.199, lng: 37.1112, label: 'حلب الجديدة - قرب السوق' } },
    { key: 's14', name: 'ليا الجابي', grade: 'الصف الثالث', section: 'أ', branch: 'malki', parent: 11, home: { lat: 36.2048, lng: 37.1185, label: 'الفرقان - الجادة الخامسة' } },
    { key: 's15', name: 'فارس الزعيم', grade: 'الصف السادس', section: 'أ', branch: 'malki', parent: 12, home: { lat: 36.1985, lng: 37.1055, label: 'حلب الجديدة - شارع الجامعة' } },
    { key: 's16', name: 'ماسة الحمصي', grade: 'الصف الرابع', section: 'ب', branch: 'mezzeh', parent: 13, meetingPoint: 'mezzeh', status: 'INACTIVE' },
  ];

  const students: Record<string, StudentCtx> = {};
  for (const def of studentDefs) {
    const pickupAt = daysAgo(20);
    const student = await prisma.schoolStudent.create({
      data: {
        institutionId: school.id,
        branchId: def.branch === 'mezzeh' ? mezzeh.id : malki.id,
        fullName: def.name,
        grade: def.grade,
        section: def.section,
        guardianUserId: parents[def.parent].id,
        subscriptionType: def.subscriptionType ?? 'ROUND_TRIP',
        status: def.status ?? 'ACTIVE',
        createdAt: daysAgo(45),
        pickupConfig: {
          create: def.home
            ? {
                pickupType: 'HOME',
                latitude: def.home.lat,
                longitude: def.home.lng,
                addressLabel: def.home.label,
                createdAt: pickupAt,
                updatedAt: pickupAt,
              }
            : {
                pickupType: 'MEETING_POINT',
                meetingPointId: meetingPoints[def.meetingPoint ?? 'mezzeh'].id,
                createdAt: pickupAt,
                updatedAt: pickupAt,
              },
        },
      },
    });
    students[def.key] = {
      id: student.id,
      name: def.name,
      guardianUserId: parents[def.parent].id,
      subscriptionType: def.subscriptionType ?? 'ROUND_TRIP',
    };
  }

  const homePickup = (key: string): Pickup => {
    const def = studentDefs.find((item) => item.key === key)!;
    return {
      stopType: 'STUDENT_HOME',
      label: def.home!.label,
      lat: def.home!.lat,
      lng: def.home!.lng,
      studentIds: [students[key].id],
    };
  };
  const pointPickup = (point: { id: string; name: string; lat: number; lng: number }, keys: string[]): Pickup => ({
    stopType: 'MEETING_POINT',
    label: point.name,
    lat: point.lat,
    lng: point.lng,
    meetingPointId: point.id,
    studentIds: keys.map((key) => students[key].id),
  });
  const pick = (...keys: string[]) => keys.map((key) => students[key]);

  const routeA = await createRoute({
    institutionId: school.id,
    branch: mezzeh,
    name: 'خط العزيزية',
    code: 'A-01',
    origin: { label: 'كراج العزيزية', lat: 36.2045, lng: 37.156 },
    defaultDelay: 10,
    crew: {
      driverId: drivers.hassan.id,
      driverUserId: drivers.hassan.userId,
      vehicleId: vehicles.v1.id,
      attendantId: attendants.salma.id,
      attendantUserId: attendants.salma.userId,
    },
    pickups: [homePickup('s1'), homePickup('s2'), homePickup('s3'), pointPickup(meetingPoints.mezzeh, ['s4', 's5'])],
    students: pick('s1', 's2', 's3', 's4', 's5'),
    schedules: [
      { direction: 'OUTBOUND', time: '03:00', days: SCHOOL_DAYS },
      { direction: 'INBOUND', time: '13:30', days: SCHOOL_DAYS },
    ],
    createdAt: daysAgo(40),
  });
  const routeB = await createRoute({
    institutionId: school.id,
    branch: mezzeh,
    name: 'خط الجميلية',
    code: 'B-02',
    origin: { label: 'الجميلية - الكراج', lat: 36.205, lng: 37.138 },
    defaultDelay: 10,
    crew: {
      driverId: drivers.bassel.id,
      driverUserId: drivers.bassel.userId,
      vehicleId: vehicles.v2.id,
      attendantId: attendants.dima.id,
      attendantUserId: attendants.dima.userId,
    },
    pickups: [homePickup('s6'), homePickup('s7'), homePickup('s8'), homePickup('s9')],
    students: pick('s6', 's7', 's8', 's9'),
    schedules: [
      { direction: 'OUTBOUND', time: '06:50', days: SCHOOL_DAYS },
      { direction: 'INBOUND', time: '13:30', days: SCHOOL_DAYS },
    ],
    createdAt: daysAgo(40),
  });
  const routeC = await createRoute({
    institutionId: school.id,
    branch: malki,
    name: 'خط حلب الجديدة',
    code: 'C-03',
    origin: { label: 'مرآب بيرويا - السليمانية', lat: 36.2145, lng: 37.1585 },
    delayThreshold: 8,
    defaultDelay: 10,
    crew: {
      driverId: beroya.drivers.samer.id,
      driverUserId: beroya.drivers.samer.userId,
      vehicleId: beroya.vehicles.bus1.id,
      attendantId: attendants.rasha.id,
      attendantUserId: attendants.rasha.userId,
    },
    pickups: [pointPickup(meetingPoints.umayyad, ['s10', 's11']), homePickup('s12'), homePickup('s13')],
    students: pick('s10', 's11', 's12', 's13'),
    schedules: [
      { direction: 'OUTBOUND', time: '07:00', days: SCHOOL_DAYS },
      { direction: 'INBOUND', time: '13:45', days: SCHOOL_DAYS },
    ],
    createdAt: daysAgo(35),
  });
  const routeD = await createRoute({
    institutionId: school.id,
    branch: malki,
    name: 'خط الفرقان',
    code: 'D-04',
    status: 'UNDER_EDIT',
    origin: { label: 'دوار الفرقان', lat: 36.2055, lng: 37.1195 },
    defaultDelay: 10,
    crew: {},
    pickups: [homePickup('s14')],
    students: pick('s14'),
    schedules: [
      { direction: 'OUTBOUND', time: '07:10', days: SCHOOL_DAYS, isActive: false },
      { direction: 'INBOUND', time: '13:50', days: SCHOOL_DAYS, isActive: false },
    ],
    staleOrder: true,
    createdAt: daysAgo(3),
  });

  // ---- Full demo scenario: driver + attendant + parent share one live school trip
  // Phones 110–112 (company employees already use 90–92)
  const demoSchoolDriver = await createDriver({
    name: 'كريم النجار',
    phone: phone(110),
    institutionId: school.id,
    branchId: mezzeh.id,
    nationalId: '09000000110',
    license: 'DL-900110',
    licenseExpiryDays: 400,
    createdAt: daysAgo(15),
  });
  const demoSchoolAttendant = await createAttendant({
    name: 'لينا داوود',
    phone: phone(111),
    institutionId: school.id,
    branchId: mezzeh.id,
    nationalId: '09000000111',
    createdAt: daysAgo(15),
  });
  const demoSchoolParent = await createUser({
    fullName: 'ياسر منصور',
    phone: phone(112),
    role: ShuttleRole.PARENT,
    institutionId: school.id,
    branchId: mezzeh.id,
    createdAt: daysAgo(14),
    lastLoginAt: daysAgo(0.2),
  });
  const demoSchoolVehicle = await createVehicle({
    institutionId: school.id,
    plate: 'حلب 512390',
    type: 'باص تويوتا كوستر',
    capacity: 18,
    licenseExpiryDays: 310,
    insuranceExpiryDays: 200,
    createdAt: daysAgo(15),
  });
  const demoSchoolChild = await prisma.schoolStudent.create({
    data: {
      institutionId: school.id,
      branchId: mezzeh.id,
      fullName: 'آية منصور',
      grade: 'الصف الرابع',
      section: 'أ',
      guardianUserId: demoSchoolParent.id,
      subscriptionType: 'ROUND_TRIP',
      status: 'ACTIVE',
      createdAt: daysAgo(14),
      pickupConfig: {
        create: {
          pickupType: 'HOME',
          latitude: 36.2092,
          longitude: 37.1512,
          addressLabel: 'العزيزية الشرقية - بناء 7',
          createdAt: daysAgo(14),
          updatedAt: daysAgo(14),
        },
      },
    },
  });
  const demoSchoolStudent: StudentCtx = {
    id: demoSchoolChild.id,
    name: demoSchoolChild.fullName,
    guardianUserId: demoSchoolParent.id,
    subscriptionType: 'ROUND_TRIP',
  };
  const routeDemoSchool = await createRoute({
    institutionId: school.id,
    branch: mezzeh,
    name: 'خط السيناريو التجريبي',
    code: 'DEMO-S',
    origin: { label: 'كراج العزيزية - بوابة تجريبية', lat: 36.2038, lng: 37.1575 },
    defaultDelay: 10,
    crew: {
      driverId: demoSchoolDriver.id,
      driverUserId: demoSchoolDriver.userId,
      vehicleId: demoSchoolVehicle.id,
      attendantId: demoSchoolAttendant.id,
      attendantUserId: demoSchoolAttendant.userId,
    },
    pickups: [
      {
        stopType: 'STUDENT_HOME',
        label: 'العزيزية الشرقية - بناء 7',
        lat: 36.2092,
        lng: 37.1512,
        studentIds: [demoSchoolStudent.id],
      },
    ],
    students: [demoSchoolStudent],
    schedules: [
      { direction: 'OUTBOUND', time: '07:20', days: SCHOOL_DAYS },
      { direction: 'INBOUND', time: '13:40', days: SCHOOL_DAYS },
    ],
    createdAt: daysAgo(12),
  });

  // ---- Furqan scenario: driver + attendant + parent in حي الفرقان (phones 120–122)
  const furqanDriver = await createDriver({
    name: 'طارق الحسن',
    phone: phone(120),
    institutionId: school.id,
    branchId: malki.id,
    nationalId: '09000000120',
    license: 'DL-900120',
    licenseExpiryDays: 380,
    createdAt: daysAgo(14),
  });
  const furqanAttendant = await createAttendant({
    name: 'ميس العلي',
    phone: phone(121),
    institutionId: school.id,
    branchId: malki.id,
    nationalId: '09000000121',
    createdAt: daysAgo(14),
  });
  const furqanParent = await createUser({
    fullName: 'وليد بركات',
    phone: phone(122),
    role: ShuttleRole.PARENT,
    institutionId: school.id,
    branchId: malki.id,
    createdAt: daysAgo(13),
    lastLoginAt: daysAgo(0.15),
  });
  const furqanVehicle = await createVehicle({
    institutionId: school.id,
    plate: 'حلب 512391',
    type: 'باص هيونداي كاونتي',
    capacity: 22,
    licenseExpiryDays: 290,
    insuranceExpiryDays: 170,
    createdAt: daysAgo(14),
  });
  const furqanChild = await prisma.schoolStudent.create({
    data: {
      institutionId: school.id,
      branchId: malki.id,
      fullName: 'جنى بركات',
      grade: 'الصف الخامس',
      section: 'ب',
      guardianUserId: furqanParent.id,
      subscriptionType: 'ROUND_TRIP',
      status: 'ACTIVE',
      createdAt: daysAgo(13),
      pickupConfig: {
        create: {
          pickupType: 'HOME',
          latitude: 36.2042,
          longitude: 37.1178,
          addressLabel: 'الفرقان - شارع النور - بناء 12',
          createdAt: daysAgo(13),
          updatedAt: daysAgo(13),
        },
      },
    },
  });
  const furqanStudent: StudentCtx = {
    id: furqanChild.id,
    name: furqanChild.fullName,
    guardianUserId: furqanParent.id,
    subscriptionType: 'ROUND_TRIP',
  };
  const routeDemoFurqan = await createRoute({
    institutionId: school.id,
    branch: malki,
    name: 'خط الفرقان التجريبي',
    code: 'DEMO-F',
    origin: { label: 'دوار الفرقان - بوابة الكراج', lat: 36.2058, lng: 37.1202 },
    defaultDelay: 10,
    crew: {
      driverId: furqanDriver.id,
      driverUserId: furqanDriver.userId,
      vehicleId: furqanVehicle.id,
      attendantId: furqanAttendant.id,
      attendantUserId: furqanAttendant.userId,
    },
    pickups: [
      {
        stopType: 'STUDENT_HOME',
        label: 'الفرقان - شارع النور - بناء 12',
        lat: 36.2042,
        lng: 37.1178,
        studentIds: [furqanStudent.id],
      },
      {
        stopType: 'CUSTOM',
        label: 'الفرقان - دوار الجادة الثالثة',
        lat: 36.2035,
        lng: 37.1165,
        studentIds: [],
      },
    ],
    students: [furqanStudent],
    schedules: [
      { direction: 'OUTBOUND', time: '07:25', days: SCHOOL_DAYS },
      { direction: 'INBOUND', time: '13:50', days: SCHOOL_DAYS },
    ],
    createdAt: daysAgo(11),
  });

  // ---- Parent live-absence QA: IN_PROGRESS trip + student still PENDING
  const absenceLiveParent = await createUser({
    fullName: 'سامر غياب حي',
    phone: phone(130),
    email: PARENT_ABSENCE_LIVE_EMAIL,
    passwordHash: await hashPassword(PARENT_ABSENCE_LIVE_PASSWORD),
    role: ShuttleRole.PARENT,
    institutionId: school.id,
    branchId: mezzeh.id,
    createdAt: daysAgo(10),
    lastLoginAt: daysAgo(0.05),
  });
  const absenceLiveDriver = await createDriver({
    name: 'نادر غياب',
    phone: phone(131),
    institutionId: school.id,
    branchId: mezzeh.id,
    nationalId: '09000000131',
    license: 'DL-900131',
    licenseExpiryDays: 350,
    createdAt: daysAgo(10),
  });
  const absenceLiveAttendant = await createAttendant({
    name: 'رغد غياب',
    phone: phone(132),
    institutionId: school.id,
    branchId: mezzeh.id,
    nationalId: '09000000132',
    createdAt: daysAgo(10),
  });
  const absenceLiveVehicle = await createVehicle({
    institutionId: school.id,
    plate: 'حلب 512392',
    type: 'ميكروباص تويوتا',
    capacity: 16,
    licenseExpiryDays: 300,
    insuranceExpiryDays: 150,
    createdAt: daysAgo(10),
  });
  const absenceLiveChild = await prisma.schoolStudent.create({
    data: {
      institutionId: school.id,
      branchId: mezzeh.id,
      fullName: 'لارا غياب',
      grade: 'الصف الثالث',
      section: 'أ',
      guardianUserId: absenceLiveParent.id,
      subscriptionType: 'ROUND_TRIP',
      status: 'ACTIVE',
      createdAt: daysAgo(10),
      pickupConfig: {
        create: {
          pickupType: 'HOME',
          latitude: 36.2068,
          longitude: 37.1505,
          addressLabel: 'العزيزية - شارع الغياب التجريبي - بناء 1',
          createdAt: daysAgo(10),
          updatedAt: daysAgo(10),
        },
      },
    },
  });
  const absenceLiveStudent: StudentCtx = {
    id: absenceLiveChild.id,
    name: absenceLiveChild.fullName,
    guardianUserId: absenceLiveParent.id,
    subscriptionType: 'ROUND_TRIP',
  };
  const routeAbsenceLive = await createRoute({
    institutionId: school.id,
    branch: mezzeh,
    name: 'خط غياب ولي الأمر الحي',
    code: 'DEMO-ABS',
    origin: { label: 'كراج العزيزية - بوابة الغياب', lat: 36.204, lng: 37.155 },
    defaultDelay: 10,
    crew: {
      driverId: absenceLiveDriver.id,
      driverUserId: absenceLiveDriver.userId,
      vehicleId: absenceLiveVehicle.id,
      attendantId: absenceLiveAttendant.id,
      attendantUserId: absenceLiveAttendant.userId,
    },
    pickups: [
      {
        stopType: 'STUDENT_HOME',
        label: 'العزيزية - شارع الغياب التجريبي - بناء 1',
        lat: 36.2068,
        lng: 37.1505,
        studentIds: [absenceLiveStudent.id],
      },
    ],
    students: [absenceLiveStudent],
    schedules: [
      { direction: 'OUTBOUND', time: '07:35', days: SCHOOL_DAYS },
      { direction: 'INBOUND', time: '14:05', days: SCHOOL_DAYS },
    ],
    createdAt: daysAgo(9),
  });

  const tomorrow = nextServiceDate(SCHOOL_DAYS);
  await prisma.studentRouteException.createMany({
    data: [
      {
        studentId: students.s3.id,
        overrideRouteId: routeB.id,
        direction: 'INBOUND',
        date: tomorrow,
        reason: 'زيارة بيت الجدة في الجميلية',
        createdByUserId: admin.id,
        createdAt: daysAgo(1),
      },
      {
        studentId: students.s7.id,
        overrideRouteId: routeA.id,
        direction: null,
        date: addCalendarDays(tomorrow, 2),
        reason: 'سفر الأهل',
        createdByUserId: admin.id,
        createdAt: daysAgo(0.5),
      },
    ],
  });

  // ---- Trips: history
  const history: BuiltTrip[] = [];
  for (const date of pastServiceDates(5, SCHOOL_DAYS)) {
    for (const route of [routeA, routeB, routeC]) {
      history.push(...(await scheduleDay(route, date, 'COMPLETED')));
    }
  }
  const lastPast = history.filter((trip) => trip.plan.route.id === routeA.id);
  if (lastPast[1]) {
    await addIncident(lastPast[1], {
      type: 'EMERGENCY',
      reportedByUserId: attendants.salma.userId,
      description: 'طالبة شعرت بدوار أثناء الرحلة وتم التواصل مع ولي الأمر',
      minutesAfterStart: 12,
      resolved: { byUserId: admin.id, notes: 'تم إيصال الطالبة إلى المنزل بحالة جيدة', afterMinutes: 20 },
    });
  }
  const correctable = history.find((trip) => trip.plan.route.id === routeC.id && trip.plan.direction === 'INBOUND');
  if (correctable) await correctStudentStatus(correctable, admin.id, 'NOT_BOARDED');

  // ---- Trips: today
  const sched = (route: RouteCtx, direction: TripDirection) => route.schedules[direction][0];
  await buildTrip({
    route: routeA,
    direction: 'OUTBOUND',
    date: today,
    time: sched(routeA, 'OUTBOUND').time,
    scheduleId: sched(routeA, 'OUTBOUND').id,
    status: 'SCHEDULED',
  });
  await buildTrip({
    route: routeB,
    direction: 'OUTBOUND',
    date: today,
    time: sched(routeB, 'OUTBOUND').time,
    scheduleId: sched(routeB, 'OUTBOUND').id,
    status: 'COMPLETED',
  });
  const cOut = await buildTrip({
    route: routeC,
    direction: 'OUTBOUND',
    date: today,
    time: sched(routeC, 'OUTBOUND').time,
    scheduleId: sched(routeC, 'OUTBOUND').id,
    status: 'COMPLETED',
    delay: 9,
    crew: { ...routeC.crew, vehicleId: vehicles.v3.id },
  });
  const breakdown = await addIncident(cOut, {
    type: 'BREAKDOWN',
    reportedByUserId: beroya.drivers.samer.userId,
    description: 'ارتفاع حرارة المحرك قرب ساحة سعدالله الجابري',
    minutesAfterStart: 6,
    resolved: { byUserId: admin.id, notes: 'تم استبدال المركبة بميكروباص المدرسة', afterMinutes: 15 },
  });
  await prisma.tripAssignmentHistory.create({
    data: {
      tripId: cOut.id,
      field: 'VEHICLE',
      previousId: beroya.vehicles.bus1.id,
      previousLabel: beroya.vehicles.bus1.plate,
      newId: vehicles.v3.id,
      newLabel: vehicles.v3.plate,
      reason: 'عطل في المحرك',
      incidentId: breakdown.id,
      changedByUserId: admin.id,
      changedAt: at(cOut.departure, 12),
    },
  });
  await prisma.tripEvent.create({
    data: {
      tripId: cOut.id,
      type: 'VEHICLE_CHANGED',
      actorUserId: admin.id,
      title: 'Vehicle changed',
      description: `${beroya.vehicles.bus1.plate} → ${vehicles.v3.plate}`,
      data: json({ incidentId: breakdown.id }),
      occurredAt: at(cOut.departure, 12),
    },
  });

  const aIn = await buildTrip({
    route: routeA,
    direction: 'INBOUND',
    date: today,
    time: liveClock(25),
    scheduleId: sched(routeA, 'INBOUND').id,
    status: 'IN_PROGRESS',
    arrived: 2,
    actorUserId: admin.id,
    overriddenFrom: sched(routeA, 'INBOUND').time,
  });
  const bIn = await buildTrip({
    route: routeB,
    direction: 'INBOUND',
    date: today,
    time: sched(routeB, 'INBOUND').time,
    scheduleId: sched(routeB, 'INBOUND').id,
    status: 'CANCELLED',
    cancelReason: 'عطل طارئ في المركبة وتعذّر تأمين بديل',
    actorUserId: admin.id,
  });
  const cIn = await buildTrip({
    route: routeC,
    direction: 'INBOUND',
    date: today,
    time: liveClock(20),
    scheduleId: sched(routeC, 'INBOUND').id,
    status: 'IN_PROGRESS',
    arrived: 1,
    delay: 12,
    actorUserId: admin.id,
    overriddenFrom: sched(routeC, 'INBOUND').time,
  });
  await addIncident(cIn, {
    type: 'BREAKDOWN',
    reportedByUserId: attendants.rasha.userId,
    description: 'صوت غير طبيعي في المكابح، السائق يتابع بسرعة منخفضة',
    minutesAfterStart: 14,
  });

  // ---- Trips: next service day
  for (const route of [routeA, routeB, routeC]) {
    for (const direction of ['OUTBOUND', 'INBOUND'] as const) {
      const schedule = sched(route, direction);
      await buildTrip({
        route,
        direction,
        date: tomorrow,
        time: schedule.time,
        scheduleId: schedule.id,
        status: 'SCHEDULED',
        excludeStudents: route.id === routeA.id && direction === 'INBOUND' ? [students.s3.id] : [],
        extraStudents: route.id === routeB.id && direction === 'INBOUND' ? [students.s3] : [],
      });
    }
  }

  // ---- Demo scenario trips (school): completed outbound + live inbound + tomorrow scheduled
  for (const date of pastServiceDates(2, SCHOOL_DAYS)) {
    await scheduleDay(routeDemoSchool, date, 'COMPLETED');
  }
  await buildTrip({
    route: routeDemoSchool,
    direction: 'OUTBOUND',
    date: today,
    time: sched(routeDemoSchool, 'OUTBOUND').time,
    scheduleId: sched(routeDemoSchool, 'OUTBOUND').id,
    status: 'COMPLETED',
    delay: 3,
  });
  await buildTrip({
    route: routeDemoSchool,
    direction: 'INBOUND',
    date: today,
    time: liveClock(18),
    scheduleId: sched(routeDemoSchool, 'INBOUND').id,
    status: 'IN_PROGRESS',
    arrived: 1,
    delay: 2,
    actorUserId: admin.id,
    overriddenFrom: sched(routeDemoSchool, 'INBOUND').time,
  });
  for (const direction of ['OUTBOUND', 'INBOUND'] as const) {
    const schedule = sched(routeDemoSchool, direction);
    await buildTrip({
      route: routeDemoSchool,
      direction,
      date: tomorrow,
      time: schedule.time,
      scheduleId: schedule.id,
      status: 'SCHEDULED',
    });
  }

  // ---- Furqan scenario trips
  for (const date of pastServiceDates(2, SCHOOL_DAYS)) {
    await scheduleDay(routeDemoFurqan, date, 'COMPLETED');
  }
  // Normal live inbound for طارق / ميس / وليد (no emergency)
  await buildTrip({
    route: routeDemoFurqan,
    direction: 'OUTBOUND',
    date: today,
    time: sched(routeDemoFurqan, 'OUTBOUND').time,
    scheduleId: sched(routeDemoFurqan, 'OUTBOUND').id,
    status: 'COMPLETED',
    delay: 2,
  });
  await buildTrip({
    route: routeDemoFurqan,
    direction: 'INBOUND',
    date: today,
    time: liveClock(14),
    scheduleId: sched(routeDemoFurqan, 'INBOUND').id,
    status: 'IN_PROGRESS',
    arrived: 1,
    delay: 1,
    actorUserId: admin.id,
    overriddenFrom: sched(routeDemoFurqan, 'INBOUND').time,
  });
  for (const direction of ['OUTBOUND', 'INBOUND'] as const) {
    const schedule = sched(routeDemoFurqan, direction);
    await buildTrip({
      route: routeDemoFurqan,
      direction,
      date: tomorrow,
      time: schedule.time,
      scheduleId: schedule.id,
      status: 'SCHEDULED',
    });
  }

  // ---- Parent live-absence QA trips (student stays PENDING on live bus)
  await buildTrip({
    route: routeAbsenceLive,
    direction: 'OUTBOUND',
    date: today,
    time: sched(routeAbsenceLive, 'OUTBOUND').time,
    scheduleId: sched(routeAbsenceLive, 'OUTBOUND').id,
    status: 'SCHEDULED',
  });
  const absenceLiveTrip = await buildTrip({
    route: routeAbsenceLive,
    direction: 'INBOUND',
    date: today,
    time: liveClock(12),
    scheduleId: sched(routeAbsenceLive, 'INBOUND').id,
    status: 'IN_PROGRESS',
    arrived: 1,
    delay: 2,
    forcePending: [absenceLiveStudent.id],
    actorUserId: admin.id,
    overriddenFrom: sched(routeAbsenceLive, 'INBOUND').time,
  });
  for (const direction of ['OUTBOUND', 'INBOUND'] as const) {
    const schedule = sched(routeAbsenceLive, direction);
    await buildTrip({
      route: routeAbsenceLive,
      direction,
      date: tomorrow,
      time: schedule.time,
      scheduleId: schedule.id,
      status: 'SCHEDULED',
    });
  }

  // ---- Parents: preferences, devices, alerts
  const prefRows: Prisma.ParentArrivalPreferenceCreateManyInput[] = [];
  for (const [index, student] of Object.values(students).entries()) {
    prefRows.push({
      parentUserId: student.guardianUserId,
      studentId: student.id,
      minutesBefore: [5, 10, 15][index % 3],
      soundEnabled: index % 4 !== 0,
    });
  }
  prefRows.push(
    {
      parentUserId: demoSchoolParent.id,
      studentId: demoSchoolStudent.id,
      minutesBefore: 10,
      soundEnabled: true,
    },
    {
      parentUserId: furqanParent.id,
      studentId: furqanStudent.id,
      minutesBefore: 10,
      soundEnabled: true,
    },
    {
      parentUserId: absenceLiveParent.id,
      studentId: absenceLiveStudent.id,
      minutesBefore: 10,
      soundEnabled: true,
    },
  );
  await prisma.parentArrivalPreference.createMany({ data: prefRows });

  await prisma.userDevice.createMany({
    data: [
      ...parents.slice(0, 8).map((parent, index) => ({
        userId: parent.id,
        deviceId: `seed-parent-device-${index + 1}`,
        fcmToken: `seed-fcm-parent-${index + 1}`,
        platform: index % 2 === 0 ? ('ANDROID' as const) : ('IOS' as const),
        appVersion: '1.0.0',
        lastSeenAt: daysAgo(index % 3),
      })),
      {
        userId: demoSchoolParent.id,
        deviceId: 'seed-parent-device-demo',
        fcmToken: 'seed-fcm-parent-demo',
        platform: 'ANDROID' as const,
        appVersion: '1.0.0',
        lastSeenAt: now,
      },
      {
        userId: furqanParent.id,
        deviceId: 'seed-parent-device-furqan',
        fcmToken: 'seed-fcm-parent-furqan',
        platform: 'IOS' as const,
        appVersion: '1.0.0',
        lastSeenAt: now,
      },
      {
        userId: absenceLiveParent.id,
        deviceId: 'seed-parent-device-absence-live',
        fcmToken: 'seed-fcm-parent-absence-live',
        platform: 'ANDROID' as const,
        appVersion: '1.0.0',
        lastSeenAt: now,
      },
      ...[
        drivers.hassan,
        drivers.bassel,
        beroya.drivers.samer,
        demoSchoolDriver,
        furqanDriver,
        absenceLiveDriver,
      ].map((driver, index) => ({
        userId: driver.userId,
        deviceId: `seed-driver-device-${index + 1}`,
        fcmToken: `seed-fcm-driver-${index + 1}`,
        platform: 'ANDROID' as const,
        appVersion: '1.0.0',
        lastSeenAt: now,
      })),
      {
        userId: demoSchoolAttendant.userId,
        deviceId: 'seed-attendant-device-demo',
        fcmToken: 'seed-fcm-attendant-demo',
        platform: 'IOS' as const,
        appVersion: '1.0.0',
        lastSeenAt: now,
      },
      {
        userId: furqanAttendant.userId,
        deviceId: 'seed-attendant-device-furqan',
        fcmToken: 'seed-fcm-attendant-furqan',
        platform: 'ANDROID' as const,
        appVersion: '1.0.0',
        lastSeenAt: now,
      },
    ],
  });

  const alertRows: Prisma.TripAlertDeliveryCreateManyInput[] = [];
  const nextStopIndex = aIn.stops.findIndex((stop) => !stop.arrivedAt);
  for (const rider of aIn.riders.filter((item) => item.stopIndex === nextStopIndex)) {
    alertRows.push({
      tripId: aIn.id,
      userId: rider.student.guardianUserId,
      studentId: rider.student.id,
      type: 'ARRIVAL_SOON',
      status: 'SENT',
      sentAt: at(now, -2),
    });
  }
  for (const rider of cIn.riders) {
    alertRows.push({
      tripId: cIn.id,
      userId: rider.student.guardianUserId,
      studentId: rider.student.id,
      type: 'DELAY',
      status: 'DELIVERED',
      sentAt: at(now, -6),
    });
  }
  if (alertRows.length) await prisma.tripAlertDelivery.createMany({ data: alertRows });

  // ---- Notifications
  const guardiansOf = (route: RouteCtx) => [...new Set(route.students.map((s) => s.guardianUserId))];
  const activeParents = parents.filter((parent) => parent.status === 'ACTIVE').map((parent) => parent.id);
  await createNotification({
    institutionId: school.id,
    audience: 'ALL_PARENTS',
    origin: 'MANUAL',
    title: 'عطلة رسمية يوم الخميس القادم',
    body: 'نعلمكم بأن يوم الخميس القادم عطلة رسمية ولن تعمل رحلات النقل المدرسي. تستأنف الرحلات يوم السبت.',
    sentByUserId: admin.id,
    createdAt: daysAgo(3),
    recipients: activeParents,
  });
  await createNotification({
    institutionId: school.id,
    branchId: mezzeh.id,
    routeId: routeA.id,
    audience: 'ROUTE_PARENTS',
    origin: 'MANUAL',
    title: 'تعديل موعد رحلة العودة',
    body: 'تم تعديل موعد رحلة العودة اليوم بسبب النشاط المدرسي. نعتذر عن أي إزعاج.',
    sentByUserId: admin.id,
    createdAt: at(aIn.departure, -90),
    recipients: guardiansOf(routeA),
  });
  await createNotification({
    institutionId: school.id,
    branchId: mezzeh.id,
    routeId: routeB.id,
    audience: 'ROUTE_PARENTS',
    origin: 'SYSTEM',
    title: 'إلغاء رحلة العودة',
    body: 'تم إلغاء رحلة العودة اليوم على خط الجميلية: عطل طارئ في المركبة وتعذّر تأمين بديل.',
    createdAt: at(bIn.departure, -45),
    recipients: guardiansOf(routeB),
    data: { tripId: bIn.id, reason: 'TRIP_CANCELLED' },
  });
  await createNotification({
    institutionId: school.id,
    branchId: malki.id,
    routeId: routeC.id,
    audience: 'ROUTE_PARENTS',
    origin: 'SYSTEM',
    title: 'تأخر رحلة العودة',
    body: 'رحلة العودة على خط حلب الجديدة متأخرة حوالي 12 دقيقة.',
    createdAt: at(now, -6),
    recipients: guardiansOf(routeC),
    data: { tripId: cIn.id, delayMinutes: 12 },
  });
  await createNotification({
    institutionId: school.id,
    audience: 'ALL_DRIVERS',
    origin: 'MANUAL',
    title: 'تحديث جدول الرحلات',
    body: 'يرجى مراجعة جدول رحلات اليوم قبل المغادرة والتأكد من جاهزية المركبة.',
    sentByUserId: admin.id,
    createdAt: daysAgo(1),
    recipients: [drivers.hassan.userId, drivers.bassel.userId, drivers.nizar.userId],
    data: { type: 'INSTITUTION_BROADCAST' },
  });
  await createNotification({
    institutionId: school.id,
    branchId: mezzeh.id,
    routeId: routeA.id,
    audience: 'ROUTE_DRIVERS',
    origin: 'SYSTEM',
    title: 'رحلة جديدة مجدولة',
    body: `تمت إضافة خط ${routeA.name} — مغادرة ${sched(routeA, 'INBOUND').time}`,
    createdAt: at(aIn.departure, -120),
    recipients: [drivers.hassan.userId],
    data: { tripId: aIn.id, type: 'TRIP_ASSIGNED' },
  });
  await createNotification({
    institutionId: school.id,
    audience: 'ALL_ATTENDANTS',
    origin: 'MANUAL',
    title: 'تذكير للمشرفات',
    body: 'يرجى التأكد من قائمة الطلاب قبل مغادرة الرحلة ومراجعة ملاحظات اليوم.',
    sentByUserId: admin.id,
    createdAt: daysAgo(1),
    recipients: [
      attendants.salma.userId,
      attendants.dima.userId,
      attendants.rasha.userId,
      attendants.hiba.userId,
    ],
    data: { type: 'INSTITUTION_BROADCAST' },
  });
  await createNotification({
    institutionId: school.id,
    branchId: mezzeh.id,
    routeId: routeA.id,
    audience: 'ROUTE_ATTENDANTS',
    origin: 'SYSTEM',
    title: 'رحلة جديدة مجدولة',
    body: `تمت إضافة خط ${routeA.name} — مغادرة ${sched(routeA, 'INBOUND').time}`,
    createdAt: at(aIn.departure, -110),
    recipients: [attendants.salma.userId],
    data: { tripId: aIn.id, type: 'TRIP_ASSIGNED' },
  });

  // ---- Audit log
  await createAuditLogs([
    { institutionId: school.id, actorUserId: beroyaAdminId, action: 'INSTITUTION_CREATED', entityType: 'Institution', entityId: school.id, after: { name: NAMES.school, type: 'SCHOOL', operationModel: 'BEROYA_OPERATED' }, createdAt: created },
    { institutionId: school.id, actorUserId: beroyaAdminId, action: 'SUBSCRIPTION_ACTIVATED', entityType: 'InstitutionSubscription', after: { status: 'ACTIVE', billingPeriod: 'MONTHLY' }, before: { status: 'PENDING' }, createdAt: daysAgo(10) },
    { institutionId: school.id, actorUserId: admin.id, action: 'INSTITUTION_BRANDING_UPDATED', entityType: 'InstitutionBranding', before: { primaryColor: null }, after: { primaryColor: '#0F766E', useInstitutionIdentity: true }, createdAt: daysAgo(60) },
    { institutionId: school.id, actorUserId: admin.id, action: 'BRANCH_CREATED', entityType: 'InstitutionBranch', entityId: malki.id, after: { name: malki.name }, createdAt: daysAgo(58) },
    { institutionId: school.id, actorUserId: admin.id, action: 'ROUTE_CREATED', entityType: 'ShuttleRoute', entityId: routeA.id, after: { name: routeA.name, code: 'A-01' }, createdAt: daysAgo(40) },
    { institutionId: school.id, actorUserId: admin.id, action: 'ROUTE_STUDENTS_ASSIGNED', entityType: 'ShuttleRoute', entityId: routeA.id, after: { count: routeA.students.length }, createdAt: daysAgo(39) },
    { institutionId: school.id, actorUserId: admin.id, action: 'ROUTE_STOP_ORDER_SAVED', entityType: 'ShuttleRoute', entityId: routeC.id, after: { direction: 'OUTBOUND' }, createdAt: daysAgo(30) },
    { institutionId: school.id, actorUserId: admin.id, action: 'STUDENT_CREATED', entityType: 'SchoolStudent', entityId: students.s1.id, after: { fullName: students.s1.name }, createdAt: daysAgo(45) },
    { institutionId: school.id, actorUserId: admin.id, action: 'STUDENT_PICKUP_CHANGED', entityType: 'SchoolStudent', entityId: students.s4.id, before: { pickupType: 'HOME' }, after: { pickupType: 'MEETING_POINT' }, createdAt: daysAgo(20) },
    { institutionId: school.id, actorUserId: admin.id, action: 'ROUTE_STATUS_CHANGED', entityType: 'ShuttleRoute', entityId: routeD.id, before: { status: 'ACTIVE' }, after: { status: 'UNDER_EDIT' }, createdAt: daysAgo(2) },
    { institutionId: school.id, actorUserId: admin.id, action: 'ROUTE_EXCEPTION_CREATED', entityType: 'StudentRouteException', entityId: students.s3.id, after: { overrideRoute: routeB.name, direction: 'INBOUND' }, createdAt: daysAgo(1) },
    { institutionId: school.id, actorUserId: admin.id, action: 'ATTENDANT_STATUS_CHANGED', entityType: 'AttendantProfile', entityId: attendants.amal.id, before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED' }, createdAt: daysAgo(8) },
    { institutionId: school.id, actorUserId: admin.id, action: 'VEHICLE_STATUS_CHANGED', entityType: 'ShuttleVehicle', entityId: vehicles.v4.id, before: { status: 'ACTIVE' }, after: { status: 'UNDER_MAINTENANCE' }, createdAt: daysAgo(4) },
    { institutionId: school.id, actorUserId: admin.id, action: 'INCIDENT_RESOLVED', entityType: 'TripIncident', entityId: breakdown.id, after: { status: 'RESOLVED' }, createdAt: at(cOut.departure, 21) },
    { institutionId: school.id, actorUserId: admin.id, action: 'TRIP_CANCELLED', entityType: 'ShuttleTrip', entityId: bIn.id, after: { status: 'CANCELLED', reason: 'عطل طارئ في المركبة' }, createdAt: at(bIn.departure, -45) },
  ]);

  return {
    school,
    admin,
    routes: { routeA, routeB, routeC, routeD, routeDemoSchool, routeDemoFurqan },
    drivers,
    attendants,
    demoScenario: {
      driver: {
        name: demoSchoolDriver.name,
        phone: demoSchoolDriver.phone,
        email: demoEmail(110),
      },
      attendant: {
        name: demoSchoolAttendant.name,
        phone: demoSchoolAttendant.phone,
        email: demoEmail(111),
      },
      parent: {
        name: demoSchoolParent.fullName,
        phone: demoSchoolParent.phone!,
        email: demoEmail(112),
      },
      studentName: demoSchoolStudent.name,
      routeCode: 'DEMO-S',
    },
    furqanScenario: {
      driver: {
        name: furqanDriver.name,
        phone: furqanDriver.phone,
        email: demoEmail(120),
      },
      attendant: {
        name: furqanAttendant.name,
        phone: furqanAttendant.phone,
        email: demoEmail(121),
      },
      parent: {
        name: furqanParent.fullName,
        phone: furqanParent.phone!,
        email: demoEmail(122),
      },
      studentName: furqanStudent.name,
      routeCode: 'DEMO-F',
      area: 'الفرقان',
    },
    parentAbsenceLive: {
      email: PARENT_ABSENCE_LIVE_EMAIL,
      password: PARENT_ABSENCE_LIVE_PASSWORD,
      parentName: absenceLiveParent.fullName,
      studentId: absenceLiveStudent.id,
      studentName: absenceLiveStudent.name,
      tripId: absenceLiveTrip.id,
      routeCode: 'DEMO-ABS',
      tripStatus: 'IN_PROGRESS',
      studentStatus: 'PENDING',
    },
  };
}

async function seedUniversity(beroyaAdminId: string) {
  const created = daysAgo(60);
  const uni = await createInstitution({
    name: NAMES.university,
    displayName: 'الجامعة الدولية',
    type: 'UNIVERSITY',
    operationModel: 'INSTITUTION_OPERATED',
    contactPhone: '+963115566770',
    contactEmail: 'transport@diu.edu.sy',
    city: 'حلب',
    address: 'حلب - جامعة حلب - شارع الجامعة',
    createdAt: created,
    settings: { defaultDelayThresholdMinutes: 15, gpsStaleAfterSeconds: 180, locationPingIntervalSeconds: 20 },
    branding: {
      useInstitutionIdentity: false,
      primaryColor: '#1D4ED8',
      secondaryColor: '#0EA5E9',
      welcomeMessage: 'خدمة النقل الجامعي في حلب',
      supportPhone: '+963115566771',
    },
  });
  const campus = await createBranch({
    institutionId: uni.id,
    name: 'الحرم الرئيسي',
    address: 'جامعة حلب - شارع الجامعة',
    lat: 36.211,
    lng: 37.137,
    createdAt: created,
  });
  const medicine = await createBranch({
    institutionId: uni.id,
    name: 'كلية الطب - الحمدانية',
    address: 'الحمدانية - قرب المشافي الجامعية',
    lat: 36.1865,
    lng: 37.1245,
    createdAt: created,
  });
  const admin = await createAdmin({
    institutionId: uni.id,
    branchId: campus.id,
    name: 'د. سليم حمدان',
    phone: phone(2),
    email: 'saleem@beroya.local',
    createdAt: created,
  });
  await prisma.institutionSubscription.create({
    data: {
      institutionId: uni.id,
      billingPeriod: 'TERM',
      status: 'ACTIVE',
      startsAt: daysAgo(30),
      endsAt: daysFromNow(80),
      agreedAmount: 4200,
      currencyCode: 'USD',
      notes: 'الفصل الأول 2026-2027',
      activatedAt: daysAgo(30),
      createdAt: daysAgo(35),
    },
  });

  const points = {
    raees: await createMeetingPoint({ institutionId: uni.id, branchId: null, name: 'دوار كراج حلب', address: 'مدخل الكراج - جهة الجامعة', lat: 36.2165, lng: 37.142 }),
    baramkeh: await createMeetingPoint({ institutionId: uni.id, branchId: campus.id, name: 'موقف الجامعة', address: 'قرب كلية الحقوق', lat: 36.2105, lng: 37.1365 }),
    babToma: await createMeetingPoint({ institutionId: uni.id, branchId: campus.id, name: 'ساحة السليمانية', address: 'أمام البوابة', lat: 36.215, lng: 37.159 }),
    kafarsouseh: await createMeetingPoint({ institutionId: uni.id, branchId: null, name: 'دوار حلب الجديدة', address: 'جانب الجامع', lat: 36.1995, lng: 37.1085 }),
  };

  const drivers = {
    khaled: await createDriver({ name: 'خالد الرفاعي', phone: phone(60), institutionId: uni.id, branchId: campus.id, nationalId: '04050607080', license: 'DL-773401', licenseExpiryDays: 365, createdAt: created }),
    ayman: await createDriver({ name: 'أيمن سليمان', phone: phone(61), institutionId: uni.id, branchId: campus.id, nationalId: '04050607081', license: 'DL-773402', licenseExpiryDays: 240, createdAt: created }),
  };
  const vehicles = {
    big: await createVehicle({ institutionId: uni.id, plate: 'حلب 702201', type: 'باص كينغ لونغ', capacity: 45, licenseExpiryDays: 300, insuranceExpiryDays: 200, createdAt: created }),
    mid: await createVehicle({ institutionId: uni.id, plate: 'حلب 702202', type: 'باص هيونداي كاونتي', capacity: 28, licenseExpiryDays: 260, insuranceExpiryDays: 160, createdAt: created }),
  };
  const attendant = await createAttendant({ name: 'سوسن خوري', phone: phone(62), institutionId: uni.id, branchId: campus.id, nationalId: '04050607082', createdAt: created });

  const studentNames = [
    ['أحمد الشهابي', 'كلية الهندسة المعلوماتية'],
    ['بتول الحكيم', 'كلية الطب البشري'],
    ['حسن المحمد', 'كلية الصيدلة'],
    ['دانة زيدان', 'كلية العمارة'],
    ['رامي حجازي', 'كلية إدارة الأعمال'],
    ['سلاف عبود', 'كلية الهندسة المعلوماتية'],
    ['علي الخوري', 'كلية طب الأسنان'],
    ['غنى الصالح', 'كلية الطب البشري'],
    ['كنان العبدالله', 'كلية الهندسة المدنية'],
    ['لجين مراد', 'كلية الصيدلة'],
    ['مازن الحلو', 'كلية إدارة الأعمال'],
    ['يارا شاهين', 'كلية العمارة'],
  ] as const;
  const universityStudentIds: string[] = [];
  for (const [index, [name, faculty]] of studentNames.entries()) {
    const user = await createUser({
      fullName: name,
      phone: phone(70 + index),
      role: ShuttleRole.UNIVERSITY_STUDENT,
      institutionId: uni.id,
      branchId: index % 4 === 1 ? medicine.id : campus.id,
      status: index === 11 ? UserStatus.SUSPENDED : UserStatus.ACTIVE,
      createdAt: daysAgo(40 - index),
      lastLoginAt: index % 2 === 0 ? daysAgo(index % 4) : null,
    });
    await prisma.universityStudentProfile.create({
      data: {
        userId: user.id,
        institutionId: uni.id,
        branchId: index % 4 === 1 ? medicine.id : campus.id,
        studentNumber: `2026-${String(1001 + index)}`,
        faculty,
        status: index === 11 ? 'INACTIVE' : 'ACTIVE',
        createdAt: daysAgo(40 - index),
      },
    });
    if (index !== 11) universityStudentIds.push(user.id);
  }
  await prisma.userDevice.createMany({
    data: universityStudentIds.slice(0, 5).map((userId, index) => ({
      userId,
      deviceId: `seed-uni-device-${index + 1}`,
      fcmToken: `seed-fcm-uni-${index + 1}`,
      platform: index % 2 === 0 ? ('IOS' as const) : ('ANDROID' as const),
      appVersion: '1.0.0',
    })),
  });

  const pointPickup = (point: { id: string; name: string; lat: number; lng: number }): Pickup => ({
    stopType: 'MEETING_POINT',
    label: point.name,
    lat: point.lat,
    lng: point.lng,
    meetingPointId: point.id,
    studentIds: [],
  });

  const u1 = await createRoute({
    institutionId: uni.id,
    branch: campus,
    name: 'خط كراج حلب - الحرم',
    code: 'U-01',
    origin: { label: 'مرآب الجامعة - الحرم', lat: 36.2115, lng: 37.1385 },
    defaultDelay: 15,
    crew: { driverId: drivers.khaled.id, driverUserId: drivers.khaled.userId, vehicleId: vehicles.big.id, attendantId: attendant.id, attendantUserId: attendant.userId },
    pickups: [
      pointPickup(points.raees),
      pointPickup(points.baramkeh),
      { stopType: 'CUSTOM', label: 'مدخل أوتوستراد حلب - اللاذقية', lat: 36.195, lng: 37.13, studentIds: [] },
    ],
    students: [],
    schedules: [
      { direction: 'OUTBOUND', time: '08:00', days: WORK_DAYS },
      { direction: 'OUTBOUND', time: '10:00', days: WORK_DAYS },
      { direction: 'INBOUND', time: '14:00', days: WORK_DAYS },
      { direction: 'INBOUND', time: '17:00', days: WORK_DAYS },
    ],
    createdAt: daysAgo(50),
  });
  const u2 = await createRoute({
    institutionId: uni.id,
    branch: campus,
    name: 'خط السليمانية - الحرم',
    code: 'U-02',
    origin: { label: 'السليمانية', lat: 36.2155, lng: 37.1605 },
    defaultDelay: 15,
    crew: { driverId: drivers.ayman.id, driverUserId: drivers.ayman.userId, vehicleId: vehicles.mid.id },
    pickups: [pointPickup(points.babToma), pointPickup(points.kafarsouseh)],
    students: [],
    schedules: [
      { direction: 'OUTBOUND', time: '08:30', days: WORK_DAYS },
      { direction: 'INBOUND', time: '15:00', days: WORK_DAYS },
    ],
    createdAt: daysAgo(50),
  });

  // ---- Full demo scenario: driver + attendant + university student share one live trip
  // Phones 113–115
  const demoUniDriver = await createDriver({
    name: 'فادي عيسى',
    phone: phone(113),
    institutionId: uni.id,
    branchId: campus.id,
    nationalId: '09000000113',
    license: 'DL-900113',
    licenseExpiryDays: 360,
    createdAt: daysAgo(20),
  });
  const demoUniAttendant = await createAttendant({
    name: 'ندى الحسن',
    phone: phone(115),
    institutionId: uni.id,
    branchId: campus.id,
    nationalId: '09000000115',
    createdAt: daysAgo(20),
  });
  const demoUniVehicle = await createVehicle({
    institutionId: uni.id,
    plate: 'حلب 702290',
    type: 'باص هيونداي كاونتي',
    capacity: 30,
    licenseExpiryDays: 280,
    insuranceExpiryDays: 180,
    createdAt: daysAgo(20),
  });
  const demoUniStudentUser = await createUser({
    fullName: 'سارة منصور',
    phone: phone(114),
    role: ShuttleRole.UNIVERSITY_STUDENT,
    institutionId: uni.id,
    branchId: campus.id,
    createdAt: daysAgo(18),
    lastLoginAt: daysAgo(0.1),
  });
  await prisma.universityStudentProfile.create({
    data: {
      userId: demoUniStudentUser.id,
      institutionId: uni.id,
      branchId: campus.id,
      studentNumber: '2026-DEMO',
      faculty: 'كلية الهندسة المعلوماتية',
      status: 'ACTIVE',
      createdAt: daysAgo(18),
    },
  });
  const routeDemoUni = await createRoute({
    institutionId: uni.id,
    branch: campus,
    name: 'خط السيناريو الجامعي',
    code: 'DEMO-U',
    origin: { label: 'مرآب الجامعة - بوابة تجريبية', lat: 36.2102, lng: 37.1398 },
    defaultDelay: 12,
    crew: {
      driverId: demoUniDriver.id,
      driverUserId: demoUniDriver.userId,
      vehicleId: demoUniVehicle.id,
      attendantId: demoUniAttendant.id,
      attendantUserId: demoUniAttendant.userId,
    },
    pickups: [
      pointPickup(points.raees),
      pointPickup(points.baramkeh),
    ],
    students: [],
    schedules: [
      { direction: 'OUTBOUND', time: '08:15', days: WORK_DAYS },
      { direction: 'INBOUND', time: '16:30', days: WORK_DAYS },
    ],
    createdAt: daysAgo(16),
  });

  for (const date of pastServiceDates(3, WORK_DAYS)) {
    await scheduleDay(u1, date, 'COMPLETED');
    await scheduleDay(u2, date, 'COMPLETED');
    await scheduleDay(routeDemoUni, date, 'COMPLETED');
  }

  const isWorkDay = WORK_DAYS.includes(weekday(today));
  const nowClock = clockInTimezone(now, TZ);
  const todayPlan: Array<[RouteCtx, TripDirection, ScheduleCtx]> = [
    [u1, 'OUTBOUND', u1.schedules.OUTBOUND[0]],
    [u1, 'OUTBOUND', u1.schedules.OUTBOUND[1]],
    [u1, 'INBOUND', u1.schedules.INBOUND[0]],
    [u2, 'OUTBOUND', u2.schedules.OUTBOUND[0]],
    [u2, 'INBOUND', u2.schedules.INBOUND[0]],
  ];
  for (const [route, direction, schedule] of todayPlan) {
    await buildTrip({
      route,
      direction,
      date: today,
      time: schedule.time,
      scheduleId: schedule.id,
      status: schedule.time < nowClock ? 'COMPLETED' : 'SCHEDULED',
      delay: schedule.time < nowClock ? jitter(5) : 0,
    });
  }
  const liveSchedule = u1.schedules.INBOUND[1];
  const liveTime = liveClock(15) === u1.schedules.INBOUND[0].time ? liveClock(16) : liveClock(15);
  const uLive = await buildTrip({
    route: u1,
    direction: 'INBOUND',
    date: today,
    time: liveTime,
    scheduleId: liveSchedule.id,
    status: 'IN_PROGRESS',
    arrived: 1,
    delay: 4,
    actorUserId: admin.id,
    overriddenFrom: liveSchedule.time,
  });
  await addIncident(uLive, {
    type: 'EMERGENCY',
    reportedByUserId: attendant.userId,
    description: 'طالب يشعر بضيق تنفس، تم التوقف جانب الطريق',
    minutesAfterStart: 9,
  });

  // Demo scenario trips: outbound done / inbound live / next day scheduled
  const demoUniSched = (direction: TripDirection) => routeDemoUni.schedules[direction][0];
  await buildTrip({
    route: routeDemoUni,
    direction: 'OUTBOUND',
    date: today,
    time: demoUniSched('OUTBOUND').time,
    scheduleId: demoUniSched('OUTBOUND').id,
    status: 'COMPLETED',
    delay: 4,
  });
  await buildTrip({
    route: routeDemoUni,
    direction: 'INBOUND',
    date: today,
    time: liveClock(12),
    scheduleId: demoUniSched('INBOUND').id,
    status: 'IN_PROGRESS',
    arrived: 1,
    delay: 3,
    actorUserId: admin.id,
    overriddenFrom: demoUniSched('INBOUND').time,
  });

  const nextDay = nextServiceDate(WORK_DAYS);
  await scheduleDay(u1, nextDay);
  await scheduleDay(u2, nextDay);
  await scheduleDay(routeDemoUni, nextDay);

  const allUniStudents = [...universityStudentIds, demoUniStudentUser.id];
  await prisma.userDevice.create({
    data: {
      userId: demoUniStudentUser.id,
      deviceId: 'seed-uni-device-demo',
      fcmToken: 'seed-fcm-uni-demo',
      platform: 'IOS',
      appVersion: '1.0.0',
      lastSeenAt: now,
    },
  });
  await prisma.userDevice.createMany({
    data: [
      {
        userId: demoUniDriver.userId,
        deviceId: 'seed-driver-device-uni-demo',
        fcmToken: 'seed-fcm-driver-uni-demo',
        platform: 'ANDROID',
        appVersion: '1.0.0',
        lastSeenAt: now,
      },
      {
        userId: demoUniAttendant.userId,
        deviceId: 'seed-attendant-device-uni-demo',
        fcmToken: 'seed-fcm-attendant-uni-demo',
        platform: 'IOS',
        appVersion: '1.0.0',
        lastSeenAt: now,
      },
    ],
  });

  await createNotification({
    institutionId: uni.id,
    audience: 'ALL_UNIVERSITY_STUDENTS',
    origin: 'MANUAL',
    title: 'بدء العمل بجدول النقل الجديد',
    body: `يبدأ العمل بجدول النقل الجديد اعتباراً من ${isWorkDay ? 'اليوم' : 'يوم الأحد'}. يرجى مراجعة مواعيد الخطوط في التطبيق.`,
    sentByUserId: admin.id,
    createdAt: daysAgo(4),
    recipients: allUniStudents,
  });
  await createNotification({
    institutionId: uni.id,
    branchId: campus.id,
    routeId: u1.id,
    audience: 'ROUTE_UNIVERSITY_STUDENTS',
    origin: 'MANUAL',
    title: 'تغيير نقطة تجمع',
    body: 'تم نقل نقطة التجمع عند موقف الجامعة إلى جانب كلية الحقوق بشكل مؤقت.',
    sentByUserId: admin.id,
    createdAt: daysAgo(1),
    recipients: universityStudentIds.slice(0, 6),
  });
  await createNotification({
    institutionId: uni.id,
    branchId: campus.id,
    routeId: routeDemoUni.id,
    audience: 'ROUTE_UNIVERSITY_STUDENTS',
    origin: 'MANUAL',
    title: 'خط السيناريو الجامعي جاهز',
    body: 'خط DEMO-U يعمل اليوم برحلة حية. راقب الموقع من تطبيق الطالب.',
    sentByUserId: admin.id,
    createdAt: daysAgo(0.3),
    recipients: [demoUniStudentUser.id],
  });

  await createAuditLogs([
    { institutionId: uni.id, actorUserId: beroyaAdminId, action: 'INSTITUTION_CREATED', entityType: 'Institution', entityId: uni.id, after: { name: NAMES.university, type: 'UNIVERSITY' }, createdAt: created },
    { institutionId: uni.id, actorUserId: beroyaAdminId, action: 'SUBSCRIPTION_CREATED', entityType: 'InstitutionSubscription', after: { billingPeriod: 'TERM', agreedAmount: 4200 }, createdAt: daysAgo(35) },
    { institutionId: uni.id, actorUserId: admin.id, action: 'INSTITUTION_SETTINGS_UPDATED', entityType: 'InstitutionSettings', before: { defaultDelayThresholdMinutes: 10 }, after: { defaultDelayThresholdMinutes: 15 }, createdAt: daysAgo(29) },
    { institutionId: uni.id, actorUserId: admin.id, action: 'UNIVERSITY_STUDENT_CREATED', entityType: 'UniversityStudentProfile', after: { count: studentNames.length + 1 }, createdAt: daysAgo(28) },
    { institutionId: uni.id, actorUserId: admin.id, action: 'ROUTE_SCHEDULE_CREATED', entityType: 'RouteSchedule', entityId: u1.id, after: { direction: 'INBOUND', departureTime: '17:00' }, createdAt: daysAgo(27) },
    { institutionId: uni.id, actorUserId: admin.id, action: 'UNIVERSITY_STUDENT_STATUS_CHANGED', entityType: 'UniversityStudentProfile', before: { status: 'ACTIVE' }, after: { status: 'INACTIVE' }, createdAt: daysAgo(6) },
  ]);

  return {
    uni,
    admin,
    drivers,
    demoScenario: {
      driver: {
        name: demoUniDriver.name,
        phone: demoUniDriver.phone,
        email: demoEmail(113),
      },
      attendant: {
        name: demoUniAttendant.name,
        phone: demoUniAttendant.phone,
        email: demoEmail(115),
      },
      student: {
        name: demoUniStudentUser.fullName,
        phone: demoUniStudentUser.phone!,
        email: demoEmail(114),
      },
      routeCode: 'DEMO-U',
    },
  };
}

async function seedCompany(
  beroyaAdminId: string,
  beroya: Awaited<ReturnType<typeof seedBeroyaResources>>,
) {
  const created = daysAgo(45);
  const company = await createInstitution({
    name: NAMES.company,
    displayName: 'الشام للاتصالات',
    type: 'COMPANY',
    operationModel: 'BEROYA_OPERATED',
    contactPhone: '+963119988770',
    contactEmail: 'hr@sham-telecom.sy',
    address: 'حلب - السليمانية',
    createdAt: created,
    branding: { supportPhone: '+963119988771' },
  });
  const hq = await createBranch({
    institutionId: company.id,
    name: 'المقر الرئيسي',
    address: 'السليمانية - شارع النيل',
    lat: 36.2148,
    lng: 37.1612,
    createdAt: created,
  });
  const admin = await createAdmin({
    institutionId: company.id,
    branchId: hq.id,
    name: 'مروان الشريف',
    phone: phone(3),
    email: 'marwan@beroya.local',
    createdAt: created,
  });
  await prisma.institutionSubscription.create({
    data: {
      institutionId: company.id,
      billingPeriod: 'MONTHLY',
      status: 'ACTIVE',
      startsAt: daysAgo(18),
      endsAt: daysFromNow(12),
      agreedAmount: 600,
      currencyCode: 'USD',
      notes: 'يشمل سائق ومركبة من بيرويا',
      activatedAt: daysAgo(18),
      createdAt: daysAgo(20),
    },
  });
  for (const [index, name] of ['هيثم الكردي', 'ريما سعد', 'إياد ملحم'].entries()) {
    await createUser({
      fullName: name,
      phone: phone(90 + index),
      role: ShuttleRole.COMPANY_EMPLOYEE,
      institutionId: company.id,
      branchId: hq.id,
      createdAt: daysAgo(30),
    });
  }

  const k1 = await createRoute({
    institutionId: company.id,
    branch: hq,
    name: 'خط الحمدانية - المقر',
    code: 'K-01',
    origin: { label: 'الحمدانية', lat: 36.1845, lng: 37.122 },
    defaultDelay: 10,
    crew: {
      driverId: beroya.drivers.maher.id,
      driverUserId: beroya.drivers.maher.userId,
      vehicleId: beroya.vehicles.bus2.id,
    },
    pickups: [
      { stopType: 'CUSTOM', label: 'الحمدانية - ساحة الحي', lat: 36.1858, lng: 37.1255, studentIds: [] },
      { stopType: 'CUSTOM', label: 'الزهراء - المدخل', lat: 36.214, lng: 37.1065, studentIds: [] },
      { stopType: 'CUSTOM', label: 'السليمانية - قرب المقر', lat: 36.2142, lng: 37.1595, studentIds: [] },
    ],
    students: [],
    schedules: [
      { direction: 'OUTBOUND', time: '07:30', days: WORK_DAYS },
      { direction: 'INBOUND', time: '16:30', days: WORK_DAYS },
    ],
    createdAt: daysAgo(40),
  });
  for (const date of pastServiceDates(3, WORK_DAYS)) {
    await scheduleDay(k1, date, 'COMPLETED');
  }
  const nowClock = clockInTimezone(now, TZ);
  await buildTrip({
    route: k1,
    direction: 'OUTBOUND',
    date: today,
    time: '07:30',
    scheduleId: k1.schedules.OUTBOUND[0].id,
    status: nowClock > '08:15' ? 'COMPLETED' : 'SCHEDULED',
  });
  await buildTrip({
    route: k1,
    direction: 'INBOUND',
    date: today,
    time: '16:30',
    scheduleId: k1.schedules.INBOUND[0].id,
    status: nowClock > '17:15' ? 'COMPLETED' : 'SCHEDULED',
  });
  await scheduleDay(k1, nextServiceDate(WORK_DAYS));

  await createAuditLogs([
    { institutionId: company.id, actorUserId: beroyaAdminId, action: 'INSTITUTION_CREATED', entityType: 'Institution', entityId: company.id, after: { name: NAMES.company, operationModel: 'BEROYA_OPERATED' }, createdAt: created },
    { institutionId: company.id, actorUserId: beroyaAdminId, action: 'ROUTE_DEFAULT_ASSIGNMENT_CHANGED', entityType: 'ShuttleRoute', entityId: k1.id, after: { driver: beroya.drivers.maher.name, vehicle: beroya.vehicles.bus2.plate }, createdAt: daysAgo(39) },
  ]);
  return { company, admin };
}

async function seedInactiveCustomers(beroyaAdminId: string) {
  const suspended = await createInstitution({
    name: NAMES.suspended,
    displayName: 'النور',
    type: 'SCHOOL',
    operationModel: 'INSTITUTION_OPERATED',
    status: 'SUSPENDED',
    statusReason: 'تأخر سداد الاشتراك لأكثر من 30 يوماً',
    contactPhone: '+963113344550',
    contactEmail: 'admin@alnour.sy',
    address: 'حلب - السيف الدولة',
    createdAt: daysAgo(150),
  });
  const suspendedBranch = await createBranch({
    institutionId: suspended.id,
    name: 'الفرع الرئيسي',
    address: 'السيف الدولة - ساحة الحي',
    lat: 36.1935,
    lng: 37.1645,
    createdAt: daysAgo(150),
  });
  await createAdmin({
    institutionId: suspended.id,
    branchId: suspendedBranch.id,
    name: 'نبيل كيلاني',
    phone: phone(4),
    email: 'nabil@beroya.local',
    createdAt: daysAgo(150),
  });
  await prisma.institutionSubscription.createMany({
    data: [
      {
        institutionId: suspended.id,
        billingPeriod: 'TERM',
        status: 'EXPIRED',
        startsAt: daysAgo(130),
        endsAt: daysAgo(36),
        agreedAmount: 700,
        currencyCode: 'USD',
        activatedAt: daysAgo(130),
        createdAt: daysAgo(132),
      },
      {
        institutionId: suspended.id,
        billingPeriod: 'MONTHLY',
        status: 'CANCELLED',
        startsAt: daysAgo(35),
        endsAt: daysAgo(5),
        agreedAmount: 250,
        currencyCode: 'USD',
        cancelledAt: daysAgo(6),
        cancelReason: 'عدم السداد',
        createdAt: daysAgo(36),
      },
    ],
  });

  const pending = await createInstitution({
    name: NAMES.pending,
    displayName: 'الفيحاء',
    type: 'UNIVERSITY',
    operationModel: 'BEROYA_OPERATED',
    contactPhone: '+963114455660',
    contactEmail: 'info@fayhaa.sy',
    address: 'حلب - المحافظة',
    createdAt: daysAgo(2),
  });
  const pendingBranch = await createBranch({
    institutionId: pending.id,
    name: 'الفرع الرئيسي',
    address: 'المحافظة - شارع القوتلي',
    lat: 36.2095,
    lng: 37.1475,
    createdAt: daysAgo(2),
  });
  await createAdmin({
    institutionId: pending.id,
    branchId: pendingBranch.id,
    name: 'سهى المعلم',
    phone: phone(5),
    email: 'suha@beroya.local',
    createdAt: daysAgo(2),
  });
  await prisma.institutionSubscription.create({
    data: {
      institutionId: pending.id,
      billingPeriod: 'TERM',
      status: 'PENDING',
      startsAt: daysFromNow(5),
      endsAt: daysFromNow(95),
      agreedAmount: 1800,
      currencyCode: 'USD',
      notes: 'بانتظار توقيع العقد',
      createdAt: daysAgo(2),
    },
  });

  await createAuditLogs([
    { institutionId: suspended.id, actorUserId: beroyaAdminId, action: 'INSTITUTION_STATUS_CHANGED', entityType: 'Institution', entityId: suspended.id, before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED', statusReason: 'تأخر سداد الاشتراك' }, createdAt: daysAgo(5) },
    { institutionId: suspended.id, actorUserId: beroyaAdminId, action: 'SUBSCRIPTION_CANCELLED', entityType: 'InstitutionSubscription', before: { status: 'ACTIVE' }, after: { status: 'CANCELLED' }, createdAt: daysAgo(6) },
    { institutionId: pending.id, actorUserId: beroyaAdminId, action: 'INSTITUTION_CREATED', entityType: 'Institution', entityId: pending.id, after: { name: NAMES.pending }, createdAt: daysAgo(2) },
    { institutionId: pending.id, actorUserId: beroyaAdminId, action: 'SUBSCRIPTION_CREATED', entityType: 'InstitutionSubscription', after: { status: 'PENDING', agreedAmount: 1800 }, createdAt: daysAgo(2) },
  ]);
}

// =============================================================================
// Reset & live locations
// =============================================================================

async function resetSeedData() {
  const institutions = await prisma.institution.findMany({
    where: { name: { in: Object.values(NAMES) } },
    select: { id: true },
  });
  const ids = institutions.map((item) => item.id);
  const users = await prisma.shuttleUser.findMany({
    where: {
      OR: [{ institutionId: { in: ids } }, { phone: { startsWith: SEED_PHONE_PREFIX } }],
    },
    select: { id: true },
  });
  const userIds = users.map((item) => item.id);

  await prisma.shuttleAuditLog.deleteMany({
    where: { OR: [{ institutionId: { in: ids } }, { actorUserId: { in: userIds } }] },
  });
  await prisma.shuttleNotification.deleteMany({
    where: { OR: [{ institutionId: { in: ids } }, { sentByUserId: { in: userIds } }] },
  });
  await prisma.shuttleTrip.deleteMany({ where: { institutionId: { in: ids } } });
  await prisma.tripAssignmentHistory.deleteMany({ where: { changedByUserId: { in: userIds } } });
  await prisma.tripIncident.deleteMany({ where: { reportedByUserId: { in: userIds } } });
  await prisma.studentRouteException.deleteMany({
    where: {
      OR: [{ createdByUserId: { in: userIds } }, { student: { institutionId: { in: ids } } }],
    },
  });
  await prisma.shuttleRoute.deleteMany({ where: { institutionId: { in: ids } } });
  await prisma.schoolStudent.deleteMany({ where: { institutionId: { in: ids } } });
  await prisma.meetingPoint.deleteMany({ where: { institutionId: { in: ids } } });
  await prisma.shuttleVehicle.deleteMany({
    where: { OR: [{ institutionId: { in: ids } }, { plateNumber: { in: BEROYA_PLATES } }] },
  });
  await prisma.shuttleUser.deleteMany({ where: { id: { in: userIds } } });
  await prisma.institution.deleteMany({ where: { id: { in: ids } } });
  console.log(`Removed demo data (${ids.length} institutions, ${userIds.length} users).`);
}

async function pushLiveLocations() {
  if (process.env.NODE_ENV === 'production') return;
  const trips = await prisma.shuttleTrip.findMany({
    where: {
      status: 'IN_PROGRESS',
      driverId: { not: null },
      lastLocationLat: { not: null },
      institution: { name: { in: Object.values(NAMES) } },
    },
    include: { driver: { include: { user: true } } },
  });
  if (trips.length === 0) return;

  const base = (
    process.env.SEED_API_URL ??
    `http://localhost:${process.env.PORT ?? 3001}/${process.env.API_PREFIX ?? 'api/v1/shuttle'}`
  ).replace(/\/$/, '');
  // OTP parked — restore OTP_DEV_CODE when using /auth/otp/verify.
  // const code = process.env.OTP_DEV_CODE ?? '000000';
  const tokens = new Map<string, string>();
  let pushed = 0;

  try {
    for (const trip of trips) {
      const driverEmail = trip.driver?.user.email;
      if (!driverEmail) continue;
      let token = tokens.get(driverEmail);
      if (!token) {
        // OTP parked — restore /auth/otp/verify with driverPhone + OTP_DEV_CODE.
        // const login = await fetch(`${base}/auth/otp/verify`, {
        //   method: 'POST',
        //   headers: { 'content-type': 'application/json' },
        //   body: JSON.stringify({ phone: trip.driver?.user.phone, code }),
        // });
        const login = await fetch(`${base}/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: driverEmail, password: DEMO_PASSWORD }),
        });
        if (!login.ok) {
          console.warn(`  ! Driver login failed (${driverEmail}): ${login.status} ${await login.text()}`);
          continue;
        }
        const body = (await login.json()) as { data?: { access_token?: string } };
        token = body.data?.access_token;
        if (!token) continue;
        tokens.set(driverEmail, token);
      }
      const response = await fetch(`${base}/driver/trips/${trip.id}/location`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          latitude: trip.lastLocationLat,
          longitude: trip.lastLocationLng,
          speed_kph: 30,
          heading: 90,
          accuracy: 8,
        }),
      });
      if (response.ok) pushed += 1;
      else console.warn(`  ! Location push failed for trip ${trip.id}: ${response.status} ${await response.text()}`);
    }
    console.log(`Live map: pushed ${pushed}/${trips.length} bus locations to ${base}.`);
  } catch {
    console.log(
      `Live map: API not reachable at ${base}. Start the backend, then run "npm run prisma:seed:live" to show the ${trips.length} live buses.`,
    );
  }
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const admin = await ensureBeroyaAdmin();

  if (args.includes('--live')) {
    await pushLiveLocations();
    return;
  }
  if (args.includes('--reset') || process.env.SEED_RESET === 'true') {
    await resetSeedData();
  }

  const existing = await prisma.institution.findFirst({ where: { name: NAMES.school } });
  if (existing) {
    console.log('Demo data already exists. Run "npm run prisma:seed:reset" to recreate it.');
    await pushLiveLocations();
    return;
  }

  const beroya = await seedBeroyaResources();
  const schoolSeed = await seedSchool(admin.id, beroya);
  const universitySeed = await seedUniversity(admin.id);
  await seedCompany(admin.id, beroya);
  await seedInactiveCustomers(admin.id);
  await createAuditLogs([
    { actorUserId: admin.id, action: 'DRIVER_CREATED', entityType: 'DriverProfile', after: { name: beroya.drivers.samer.name, ownerType: 'BEROYA' }, createdAt: daysAgo(120) },
    { actorUserId: admin.id, action: 'VEHICLE_CREATED', entityType: 'ShuttleVehicle', entityId: beroya.vehicles.bus1.id, after: { plateNumber: beroya.vehicles.bus1.plate }, createdAt: daysAgo(120) },
    { actorUserId: admin.id, action: 'DRIVER_STATUS_CHANGED', entityType: 'DriverProfile', entityId: beroya.drivers.wassim.id, before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED' }, createdAt: daysAgo(9) },
    { actorUserId: admin.id, action: 'VEHICLE_STATUS_CHANGED', entityType: 'ShuttleVehicle', entityId: beroya.vehicles.bus3.id, before: { status: 'ACTIVE' }, after: { status: 'UNDER_MAINTENANCE' }, createdAt: daysAgo(7) },
  ]);

  console.log(`\nSign-in password for every demo account: ${DEMO_PASSWORD}`);
  console.log('\nFull scenario packs (same institution + shared live trip):');
  console.table([
    {
      pack: 'SCHOOL DEMO-S',
      role: 'DRIVER',
      name: schoolSeed.demoScenario.driver.name,
      email: schoolSeed.demoScenario.driver.email,
      phone: schoolSeed.demoScenario.driver.phone,
    },
    {
      pack: 'SCHOOL DEMO-S',
      role: 'ATTENDANT',
      name: schoolSeed.demoScenario.attendant.name,
      email: schoolSeed.demoScenario.attendant.email,
      phone: schoolSeed.demoScenario.attendant.phone,
    },
    {
      pack: 'SCHOOL DEMO-S',
      role: 'PARENT',
      name: schoolSeed.demoScenario.parent.name,
      email: schoolSeed.demoScenario.parent.email,
      phone: schoolSeed.demoScenario.parent.phone,
      note: `child: ${schoolSeed.demoScenario.studentName}`,
    },
    {
      pack: 'SCHOOL DEMO-F (الفرقان)',
      role: 'DRIVER',
      name: schoolSeed.furqanScenario.driver.name,
      email: schoolSeed.furqanScenario.driver.email,
      phone: schoolSeed.furqanScenario.driver.phone,
    },
    {
      pack: 'SCHOOL DEMO-F (الفرقان)',
      role: 'ATTENDANT',
      name: schoolSeed.furqanScenario.attendant.name,
      email: schoolSeed.furqanScenario.attendant.email,
      phone: schoolSeed.furqanScenario.attendant.phone,
    },
    {
      pack: 'SCHOOL DEMO-F (الفرقان)',
      role: 'PARENT',
      name: schoolSeed.furqanScenario.parent.name,
      email: schoolSeed.furqanScenario.parent.email,
      phone: schoolSeed.furqanScenario.parent.phone,
      note: `child: ${schoolSeed.furqanScenario.studentName}`,
    },
    {
      pack: 'UNI DEMO-U',
      role: 'DRIVER',
      name: universitySeed.demoScenario.driver.name,
      email: universitySeed.demoScenario.driver.email,
      phone: universitySeed.demoScenario.driver.phone,
    },
    {
      pack: 'UNI DEMO-U',
      role: 'ATTENDANT',
      name: universitySeed.demoScenario.attendant.name,
      email: universitySeed.demoScenario.attendant.email,
      phone: universitySeed.demoScenario.attendant.phone,
    },
    {
      pack: 'UNI DEMO-U',
      role: 'UNIVERSITY_STUDENT',
      name: universitySeed.demoScenario.student.name,
      email: universitySeed.demoScenario.student.email,
      phone: universitySeed.demoScenario.student.phone,
    },
  ]);

  const abs = schoolSeed.parentAbsenceLive;
  console.log('\nPARENT-ABSENCE-LIVE (تتبع الرحلة الآن → تسجيل غياب):');
  console.table([
    {
      email: abs.email,
      password: abs.password,
      studentId: abs.studentId,
      tripId: abs.tripId,
      tripStatus: abs.tripStatus,
      studentStatus: abs.studentStatus,
      child: abs.studentName,
      route: abs.routeCode,
    },
  ]);
  console.log(
    `  POST /parent/students/${abs.studentId}/trips/${abs.tripId}/absence`,
  );

  console.log('\nOther admin accounts:');
  console.table([
    { role: 'BEROYA_ADMIN', name: admin.fullName, email: admin.email },
    { role: 'INSTITUTION_ADMIN', name: 'ريم الأيوبي — مدرسة', email: 'reem@beroya.local' },
    { role: 'INSTITUTION_ADMIN', name: 'د. سليم حمدان — جامعة', email: 'saleem@beroya.local' },
    { role: 'INSTITUTION_ADMIN', name: 'مروان الشريف — شركة', email: 'marwan@beroya.local' },
  ]);

  await pushLiveLocations();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
