import {
  MeetingPoint,
  SchoolStudent,
  StudentPickupConfig,
  StudentRouteAssignment,
  ShuttleRoute,
  ShuttleTrip,
  ShuttleUser,
  TripStudent,
  UniversityStudentProfile,
} from '../../generated/prisma/client';
import { mapStudent, mapUser } from '../auth/auth.mapper';

export function mapPickup(
  pickup: (StudentPickupConfig & { meetingPoint?: MeetingPoint | null }) | null,
) {
  if (!pickup) {
    return null;
  }
  return {
    pickupType: pickup.pickupType,
    meetingPointId: pickup.meetingPointId,
    meetingPoint: pickup.meetingPoint
      ? mapMeetingPoint(pickup.meetingPoint)
      : null,
    latitude: pickup.latitude,
    longitude: pickup.longitude,
    addressLabel: pickup.addressLabel,
  };
}

export function mapMeetingPoint(point: MeetingPoint) {
  return {
    id: point.id,
    name: point.name,
    latitude: point.latitude,
    longitude: point.longitude,
    addressLabel: point.addressLabel,
    branchId: point.branchId,
    status: point.status,
    createdAt: point.createdAt,
    updatedAt: point.updatedAt,
  };
}

export function mapStudentDetail(
  student: SchoolStudent & {
    guardianUser: ShuttleUser;
    pickupConfig?:
      | (StudentPickupConfig & { meetingPoint?: MeetingPoint | null })
      | null;
    routeAssignments?: Array<
      StudentRouteAssignment & { route: Pick<ShuttleRoute, 'id' | 'name' | 'status'> }
    >;
  },
) {
  const activeAssignment = student.routeAssignments?.find(
    (item) => item.isActive,
  );
  return {
    ...mapStudent(student),
    guardian: mapUser(student.guardianUser),
    pickup: mapPickup(student.pickupConfig ?? null),
    currentRoute: activeAssignment
      ? {
          id: activeAssignment.route.id,
          name: activeAssignment.route.name,
          status: activeAssignment.route.status,
        }
      : null,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

export function mapUniversityStudent(
  profile: UniversityStudentProfile & { user: ShuttleUser },
) {
  return {
    id: profile.id,
    userId: profile.userId,
    institutionId: profile.institutionId,
    branchId: profile.branchId,
    studentNumber: profile.studentNumber,
    faculty: profile.faculty,
    status: profile.status,
    user: mapUser(profile.user),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function mapParentDetail(
  parent: ShuttleUser & { guardedStudents?: SchoolStudent[] },
) {
  return {
    ...mapUser(parent),
    students: (parent.guardedStudents ?? []).map(mapStudent),
  };
}

export function mapStudentTrip(
  row: TripStudent & { trip: ShuttleTrip },
) {
  return {
    id: row.id,
    status: row.status,
    isException: row.isException,
    boardedAt: row.boardedAt,
    droppedOffAt: row.droppedOffAt,
    notBoardedAt: row.notBoardedAt,
    trip: {
      id: row.trip.id,
      serviceDate: row.trip.serviceDate,
      direction: row.trip.direction,
      status: row.trip.status,
      scheduledDepartureTime: row.trip.scheduledDepartureTime,
      routeId: row.trip.routeId,
    },
  };
}

export function boardingTimestamp(row: TripStudent): Date {
  return (
    row.droppedOffAt ??
    row.boardedAt ??
    row.notBoardedAt ??
    row.correctedAt ??
    row.createdAt
  );
}
