import {
  AttendantProfile,
  DriverProfile,
  InstitutionBranch,
  SchoolStudent,
  ShuttleRoute,
  ShuttleTrip,
  ShuttleUser,
  ShuttleVehicle,
  TripStop,
  TripStudent,
} from '../../generated/prisma/client';
import { LiveLocation } from '../tracking/live-location.store';
import { isGpsStale } from '../tracking/tracking.rules';
import { mapTripStop } from '../trips/trip.mapper';
import {
  emptyStudentStatusCounts,
  StudentStatusCounts,
  tripDisplayCode,
  tripDurationMinutes,
} from './crew.rules';

function nameOnly(user: ShuttleUser) {
  return { id: user.id, fullName: user.fullName };
}

export type CrewLastLocation = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speedKph: number | null;
  recordedAt: string;
  isStale: boolean;
};

/** Prefer Redis live cache; fall back to trip.lastLocation*. null if none. */
export function mapCrewLastLocation(input: {
  live: LiveLocation | null;
  trip: Pick<
    ShuttleTrip,
    'lastLocationLat' | 'lastLocationLng' | 'lastLocationAt'
  >;
  staleAfterSeconds: number;
  now?: Date;
}): CrewLastLocation | null {
  let latitude: number;
  let longitude: number;
  let heading: number | null = null;
  let speedKph: number | null = null;
  let recordedAt: string | null = null;

  if (input.live) {
    latitude = input.live.latitude;
    longitude = input.live.longitude;
    heading = input.live.heading ?? null;
    speedKph = input.live.speedKph ?? null;
    recordedAt = input.live.recordedAt;
  } else if (
    input.trip.lastLocationLat != null &&
    input.trip.lastLocationLng != null
  ) {
    latitude = input.trip.lastLocationLat;
    longitude = input.trip.lastLocationLng;
    recordedAt = input.trip.lastLocationAt?.toISOString() ?? null;
  } else {
    return null;
  }

  if (!recordedAt) {
    return null;
  }

  return {
    latitude,
    longitude,
    heading,
    speedKph,
    recordedAt,
    isStale: isGpsStale(
      new Date(recordedAt),
      input.staleAfterSeconds,
      input.now,
    ),
  };
}

export function mapCrewTrip(
  trip: ShuttleTrip & {
    route?: Pick<ShuttleRoute, 'id' | 'name' | 'status' | 'code'> | null;
    branch?: Pick<InstitutionBranch, 'id' | 'name'> | null;
    driver?: (DriverProfile & { user: ShuttleUser }) | null;
    vehicle?: ShuttleVehicle | null;
    attendant?: (AttendantProfile & { user: ShuttleUser }) | null;
    incidents?: Array<{ id: string }>;
    _count?: { stops?: number; students?: number };
  },
  studentCounts: StudentStatusCounts = emptyStudentStatusCounts(),
  lastLocation: CrewLastLocation | null = null,
) {
  return {
    id: trip.id,
    institutionId: trip.institutionId,
    branchId: trip.branchId,
    routeId: trip.routeId,
    direction: trip.direction,
    status: trip.status,
    serviceDate: trip.serviceDate,
    scheduledDepartureTime: trip.scheduledDepartureTime,
    originLabel: trip.originLabel,
    startedAt: trip.startedAt,
    completedAt: trip.completedAt,
    delayMinutes: trip.delayMinutes,
    distanceKm: trip.distanceKm,
    durationMinutes: tripDurationMinutes(trip.startedAt, trip.completedAt),
    code: tripDisplayCode(trip.id, trip.route?.code),
    route: trip.route
      ? {
          id: trip.route.id,
          name: trip.route.name,
          status: trip.route.status,
          code: trip.route.code,
        }
      : null,
    branch: trip.branch
      ? { id: trip.branch.id, name: trip.branch.name }
      : null,
    driver: trip.driver
      ? { id: trip.driver.id, name: trip.driver.user.fullName }
      : null,
    vehicle: trip.vehicle
      ? { id: trip.vehicle.id, plateNumber: trip.vehicle.plateNumber }
      : null,
    attendant: trip.attendant
      ? { id: trip.attendant.id, name: trip.attendant.user.fullName }
      : null,
    attendantBoarded: trip.attendantBoarded,
    attendantBoardedAt: trip.attendantBoardedAt,
    stopCount: trip._count?.stops,
    studentCount: trip._count?.students,
    studentCounts,
    lastLocation,
    hasEmergency: (trip.incidents?.length ?? 0) > 0,
  };
}

export function mapAttendantBoarded(trip: {
  id: string;
  attendantBoarded: boolean;
  attendantBoardedAt: Date | null;
  attendant?: (AttendantProfile & { user: ShuttleUser }) | null;
}) {
  return {
    id: trip.id,
    attendantBoarded: trip.attendantBoarded,
    attendantBoardedAt: trip.attendantBoardedAt,
    attendant: trip.attendant
      ? {
          id: trip.attendant.id,
          name: trip.attendant.user.fullName,
        }
      : null,
  };
}

export function mapCrewStops(stops: TripStop[]) {
  return stops.map(mapTripStop);
}

export function crewStudentGradeLabel(
  grade?: string | null,
  section?: string | null,
): string | null {
  const g = grade?.trim() || '';
  const s = section?.trim() || '';
  if (g && s) return `${g} — ${s}`;
  if (g) return g;
  if (s) return s;
  return null;
}

export function mapCrewStudent(
  row: TripStudent & {
    student: Pick<SchoolStudent, 'id' | 'fullName' | 'grade' | 'section'>;
    tripStop?: Pick<TripStop, 'id' | 'sequence' | 'label' | 'stopType'> | null;
  },
) {
  return {
    id: row.id,
    tripId: row.tripId,
    studentId: row.studentId,
    tripStopId: row.tripStopId,
    status: row.status,
    boardedAt: row.boardedAt,
    droppedOffAt: row.droppedOffAt,
    notBoardedAt: row.notBoardedAt,
    student: {
      id: row.student.id,
      fullName: row.student.fullName,
      grade: row.student.grade,
      section: row.student.section,
      gradeLabel: crewStudentGradeLabel(row.student.grade, row.student.section),
    },
    stop: row.tripStop
      ? {
          id: row.tripStop.id,
          sequence: row.tripStop.sequence,
          label: row.tripStop.label,
          stopType: row.tripStop.stopType,
        }
      : null,
  };
}

export function mapDriverMe(
  user: ShuttleUser,
  driver: DriverProfile,
) {
  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      institutionId: user.institutionId,
      branchId: user.branchId,
    },
    driver: {
      id: driver.id,
      licenseNumber: driver.licenseNumber,
      status: driver.status,
    },
  };
}

export function mapAttendantMe(user: ShuttleUser, attendant: AttendantProfile) {
  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      institutionId: user.institutionId,
      branchId: user.branchId,
    },
    attendant: {
      id: attendant.id,
      status: attendant.status,
    },
  };
}

export { nameOnly };
