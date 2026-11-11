import {
  AttendantProfile,
  DriverProfile,
  InstitutionBranch,
  RouteStop,
  SchoolStudent,
  ShuttleRoute,
  ShuttleTrip,
  ShuttleUser,
  ShuttleVehicle,
  TripEvent,
  TripStop,
  TripStudent,
} from '../../generated/prisma/client';
import { mapStudent, mapUser } from '../auth/auth.mapper';

export function mapTrip(
  trip: ShuttleTrip & {
    route?: Pick<ShuttleRoute, 'id' | 'name' | 'status'> | null;
    branch?: Pick<InstitutionBranch, 'id' | 'name'> | null;
    driver?: (DriverProfile & { user: ShuttleUser }) | null;
    vehicle?: ShuttleVehicle | null;
    attendant?: (AttendantProfile & { user: ShuttleUser }) | null;
    _count?: { stops?: number; students?: number; events?: number };
  },
) {
  return {
    id: trip.id,
    institutionId: trip.institutionId,
    branchId: trip.branchId,
    routeId: trip.routeId,
    scheduleId: trip.scheduleId,
    direction: trip.direction,
    status: trip.status,
    serviceDate: trip.serviceDate,
    scheduledDepartureTime: trip.scheduledDepartureTime,
    originLabel: trip.originLabel,
    originLat: trip.originLat,
    originLng: trip.originLng,
    driverId: trip.driverId,
    vehicleId: trip.vehicleId,
    attendantId: trip.attendantId,
    startedAt: trip.startedAt,
    completedAt: trip.completedAt,
    cancelledAt: trip.cancelledAt,
    cancelReason: trip.cancelReason,
    delayThresholdMinutes: trip.delayThresholdMinutes,
    delayMinutes: trip.delayMinutes,
    delayed: trip.delayMinutes > 0 || trip.delayDetectedAt != null,
    route: trip.route
      ? { id: trip.route.id, name: trip.route.name, status: trip.route.status }
      : null,
    branch: trip.branch
      ? { id: trip.branch.id, name: trip.branch.name }
      : null,
    driver: trip.driver
      ? { id: trip.driver.id, user: mapUser(trip.driver.user) }
      : null,
    vehicle: trip.vehicle
      ? { id: trip.vehicle.id, plateNumber: trip.vehicle.plateNumber }
      : null,
    attendant: trip.attendant
      ? { id: trip.attendant.id, user: mapUser(trip.attendant.user) }
      : null,
    stopCount: trip._count?.stops,
    studentCount: trip._count?.students,
    eventCount: trip._count?.events,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

export function mapTripStop(stop: TripStop & { routeStop?: RouteStop | null }) {
  return {
    id: stop.id,
    tripId: stop.tripId,
    routeStopId: stop.routeStopId,
    sequence: stop.sequence,
    stopType: stop.stopType,
    label: stop.label,
    latitude: stop.latitude,
    longitude: stop.longitude,
    status: stop.status,
    plannedArrivalAt: stop.plannedArrivalAt,
    etaAt: stop.etaAt,
    arrivedAt: stop.arrivedAt,
  };
}

export function mapTripStudent(
  row: TripStudent & {
    student?: SchoolStudent;
    tripStop?: TripStop | null;
  },
) {
  return {
    id: row.id,
    tripId: row.tripId,
    studentId: row.studentId,
    tripStopId: row.tripStopId,
    status: row.status,
    isException: row.isException,
    boardedAt: row.boardedAt,
    droppedOffAt: row.droppedOffAt,
    notBoardedAt: row.notBoardedAt,
    correctedAt: row.correctedAt,
    student: row.student ? mapStudent(row.student) : null,
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

export function mapTripEvent(
  event: TripEvent & { actorUser?: ShuttleUser | null },
) {
  return {
    id: event.id,
    tripId: event.tripId,
    type: event.type,
    title: event.title,
    description: event.description,
    data: event.data,
    occurredAt: event.occurredAt,
    actor: event.actorUser
      ? { id: event.actorUser.id, fullName: event.actorUser.fullName }
      : null,
  };
}
