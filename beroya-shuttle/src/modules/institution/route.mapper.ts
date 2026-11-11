import {
  AttendantProfile,
  DriverProfile,
  InstitutionBranch,
  MeetingPoint,
  RouteSchedule,
  RouteStop,
  RouteStopStudent,
  SchoolStudent,
  ShuttleRoute,
  ShuttleUser,
  ShuttleVehicle,
  StudentPickupConfig,
  StudentRouteAssignment,
} from '../../generated/prisma/client';
import { mapStudent, mapUser } from '../auth/auth.mapper';
import { mapPickup } from './people.mapper';
import { mapRoutePolylineFields } from './route-polyline';
import { computeStopsOrderStale } from './route.rules';

export function mapSchedule(schedule: RouteSchedule) {
  return {
    id: schedule.id,
    routeId: schedule.routeId,
    direction: schedule.direction,
    departureTime: schedule.departureTime,
    daysOfWeek: schedule.daysOfWeek,
    isActive: schedule.isActive,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

export function mapRouteStop(
  stop: RouteStop & {
    meetingPoint?: MeetingPoint | null;
    students?: Array<RouteStopStudent & { student?: SchoolStudent }>;
  },
) {
  return {
    id: stop.id,
    routeId: stop.routeId,
    direction: stop.direction,
    sequence: stop.sequence,
    stopType: stop.stopType,
    label: stop.label,
    latitude: stop.latitude,
    longitude: stop.longitude,
    meetingPointId: stop.meetingPointId,
    meetingPoint: stop.meetingPoint
      ? {
          id: stop.meetingPoint.id,
          name: stop.meetingPoint.name,
        }
      : null,
    etaOffsetMinutes: stop.etaOffsetMinutes,
    studentIds: (stop.students ?? []).map((link) => link.studentId),
    students: (stop.students ?? [])
      .map((link) => link.student)
      .filter((student): student is SchoolStudent => Boolean(student))
      .map(mapStudent),
    createdAt: stop.createdAt,
    updatedAt: stop.updatedAt,
  };
}

export function mapRouteSummary(
  route: ShuttleRoute & {
    branch?: InstitutionBranch;
    defaultDriver?: (DriverProfile & { user: ShuttleUser }) | null;
    defaultVehicle?: ShuttleVehicle | null;
    defaultAttendant?: (AttendantProfile & { user: ShuttleUser }) | null;
    schedules?: RouteSchedule[];
    stops?: Array<
      RouteStop & {
        students?: Array<
          RouteStopStudent & {
            student?: SchoolStudent & {
              pickupConfig?: StudentPickupConfig | null;
            };
          }
        >;
      }
    >;
    _count?: { studentAssignments?: number; stops?: number; schedules?: number };
  },
) {
  return {
    id: route.id,
    institutionId: route.institutionId,
    branchId: route.branchId,
    name: route.name,
    code: route.code,
    status: route.status,
    originLabel: route.originLabel,
    originLat: route.originLat,
    originLng: route.originLng,
    delayThresholdMinutes: route.delayThresholdMinutes,
    defaultDriverId: route.defaultDriverId,
    defaultVehicleId: route.defaultVehicleId,
    defaultAttendantId: route.defaultAttendantId,
    defaultDriver: route.defaultDriver
      ? { id: route.defaultDriver.id, user: mapUser(route.defaultDriver.user) }
      : null,
    defaultVehicle: route.defaultVehicle
      ? {
          id: route.defaultVehicle.id,
          plateNumber: route.defaultVehicle.plateNumber,
        }
      : null,
    defaultAttendant: route.defaultAttendant
      ? {
          id: route.defaultAttendant.id,
          user: mapUser(route.defaultAttendant.user),
        }
      : null,
    studentCount:
      route._count?.studentAssignments ??
      route.stops
        ?.flatMap((stop) => stop.students ?? [])
        .filter((link, index, rows) =>
          rows.findIndex((item) => item.studentId === link.studentId) === index,
        ).length ??
      0,
    scheduleCount: route._count?.schedules ?? route.schedules?.length ?? 0,
    stopCount: route._count?.stops ?? route.stops?.length ?? 0,
    stopsOrderStale: computeStopsOrderStale(
      (route.stops ?? []).map((stop) => ({
        stopType: stop.stopType,
        etaOffsetMinutes: stop.etaOffsetMinutes,
        updatedAt: stop.updatedAt,
        students: (stop.students ?? []).map((link) => ({
          pickupUpdatedAt: link.student?.pickupConfig?.updatedAt ?? null,
        })),
      })),
    ),
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
    ...mapRoutePolylineFields(route),
  };
}

export function mapRouteDetail(
  route: ShuttleRoute & {
    branch?: InstitutionBranch;
    defaultDriver?: (DriverProfile & { user: ShuttleUser }) | null;
    defaultVehicle?: ShuttleVehicle | null;
    defaultAttendant?: (AttendantProfile & { user: ShuttleUser }) | null;
    schedules?: RouteSchedule[];
    stops?: Array<
      RouteStop & {
        meetingPoint?: MeetingPoint | null;
        students?: Array<
          RouteStopStudent & {
            student?: SchoolStudent & {
              pickupConfig?: StudentPickupConfig | null;
            };
          }
        >;
      }
    >;
    studentAssignments?: Array<
      StudentRouteAssignment & {
        student: SchoolStudent & {
          guardianUser: ShuttleUser;
          pickupConfig?:
            | (StudentPickupConfig & { meetingPoint?: MeetingPoint | null })
            | null;
        };
      }
    >;
  },
) {
  return {
    ...mapRouteSummary(route),
    schedules: (route.schedules ?? [])
      .slice()
      .sort((a, b) => a.departureTime.localeCompare(b.departureTime))
      .map(mapSchedule),
    stops: (route.stops ?? [])
      .slice()
      .sort((a, b) => a.direction.localeCompare(b.direction) || a.sequence - b.sequence)
      .map(mapRouteStop),
    students: (route.studentAssignments ?? [])
      .filter((assignment) => assignment.isActive)
      .map((assignment) => ({
        assignmentId: assignment.id,
        startedAt: assignment.startedAt,
        ...mapStudent(assignment.student),
        guardian: mapUser(assignment.student.guardianUser),
        pickup: mapPickup(assignment.student.pickupConfig ?? null),
      })),
  };
}
