import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { zonedDateTime } from '../../common/utils/timezone';
import {
  OperationModel,
  OwnerType,
  Prisma,
  ResourceStatus,
  TripAssignmentField,
  TripEventType,
  TripStatus,
  TripStudentStatus,
  VehicleStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../admin/admin.constants';
import { AuditService } from '../shared/audit/audit.service';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationService } from '../shared/notifications/notification.service';
import { canSeeBeroyaResources } from '../shared/resources/resource.rules';
import { TrackingService } from '../tracking/tracking.service';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { OverrideTripDto } from './dto/override-trip.dto';
import { ReassignTripDto } from './dto/reassign-trip.dto';
import { TripEventService } from './trip-event.service';
import { mapTrip, mapTripStudent } from './trip.mapper';
import {
  assertIncidentMatchesTrip,
  assertIncidentOpen,
} from '../incidents/incident.rules';
import {
  studentStatusCountsWire,
  tallyStudentStatusCounts,
} from '../crew/crew.rules';
import {
  assertCancelAllowed,
  assertOverrideAllowed,
  assertReassignAllowed,
} from './trip.rules';
import { TripsService } from './trips.service';

@Injectable()
export class TripOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trips: TripsService,
    private readonly events: TripEventService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly realtime: RealtimeService,
    private readonly tracking: TrackingService,
  ) {}

  async override(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: OverrideTripDto,
  ) {
    const trip = await this.trips.findOwned(institutionId, id);
    assertOverrideAllowed(trip.status);
    const institution = await this.requireInstitution(institutionId);
    await this.assertAssignmentTargets(
      institutionId,
      institution.operationModel,
      dto,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.shuttleTrip.update({
        where: { id },
        data: {
          driverId: dto.driverId === undefined ? undefined : dto.driverId,
          vehicleId: dto.vehicleId === undefined ? undefined : dto.vehicleId,
          attendantId:
            dto.attendantId === undefined ? undefined : dto.attendantId,
          scheduledDepartureTime: dto.departureTime,
          originLat: dto.originLat,
          originLng: dto.originLng,
          originLabel: dto.originLabel,
        },
        include: {
          route: { select: { id: true, name: true, status: true } },
          branch: { select: { id: true, name: true } },
          driver: { include: { user: true } },
          vehicle: true,
          attendant: { include: { user: true } },
          _count: { select: { stops: true, students: true, events: true } },
        },
      });

      if (dto.departureTime && dto.departureTime !== trip.scheduledDepartureTime) {
        await this.shiftPlannedArrivals(
          tx,
          id,
          trip.serviceDate,
          trip.scheduledDepartureTime,
          dto.departureTime,
          await this.timezone(institutionId),
        );
        await this.events.record(
          {
            tripId: id,
            type: TripEventType.TIME_OVERRIDDEN,
            actorUserId,
            title: 'Departure time overridden',
            data: {
              previous: trip.scheduledDepartureTime,
              next: dto.departureTime,
            },
          },
          tx,
        );
      }
      if (dto.originLat != null || dto.originLng != null || dto.originLabel) {
        await this.events.record(
          {
            tripId: id,
            type: TripEventType.ORIGIN_OVERRIDDEN,
            actorUserId,
            title: 'Origin overridden',
            data: {
              previous: {
                label: trip.originLabel,
                latitude: trip.originLat,
                longitude: trip.originLng,
              },
              next: {
                label: next.originLabel,
                latitude: next.originLat,
                longitude: next.originLng,
              },
            },
          },
          tx,
        );
      }
      await this.recordAssignmentChanges(
        tx,
        actorUserId,
        trip,
        next,
        'Trip assignment overridden',
      );
      if (dto.notifyUsers) {
        await this.notifications.notifyRouteParents(
          {
            actorUserId,
            institutionId,
            routeId: trip.routeId,
            branchId: trip.branchId,
            title: `Trip ${trip.scheduledDepartureTime} updated`,
            body: 'The institution updated this trip without changing the route.',
            data: {
              tripId: id,
              routeId: trip.routeId,
              type: 'ROUTE_CHANGE',
            },
          },
          tx,
        );
        await this.notifications.notifyRouteAttendants(
          {
            actorUserId,
            institutionId,
            routeId: trip.routeId,
            branchId: trip.branchId,
            title: `Trip ${trip.scheduledDepartureTime} updated`,
            body: 'The institution updated this trip without changing the route.',
            data: {
              tripId: id,
              routeId: trip.routeId,
              type: 'ROUTE_CHANGE',
            },
          },
          tx,
        );
      }
      return next;
    });
    this.emitAssignmentChanges(institution.operationModel, trip, updated);
    await this.notifyDriverAssignment(
      actorUserId,
      institutionId,
      trip,
      updated,
    );
    await this.notifyAttendantAssignment(
      actorUserId,
      institutionId,
      trip,
      updated,
    );
    return mapTrip(updated);
  }

  async reassign(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: ReassignTripDto,
  ) {
    const trip = await this.trips.findOwned(institutionId, id);
    assertReassignAllowed(trip.status);
    const institution = await this.requireInstitution(institutionId);
    await this.assertAssignmentTargets(
      institutionId,
      institution.operationModel,
      dto,
    );
    if (
      dto.driverId === undefined &&
      dto.vehicleId === undefined &&
      dto.attendantId === undefined
    ) {
      throw new AppException(
        'REASSIGN_EMPTY',
        'Provide a driver, vehicle, or attendant to reassign',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.incidentId) {
      const incident = await this.prisma.tripIncident.findFirst({
        where: { id: dto.incidentId, trip: { institutionId } },
      });
      if (!incident) {
        throw new AppException(
          'INCIDENT_NOT_FOUND',
          'Incident not found',
          HttpStatus.NOT_FOUND,
        );
      }
      assertIncidentMatchesTrip(incident.tripId, id);
      assertIncidentOpen(incident.status);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.shuttleTrip.update({
        where: { id },
        data: {
          driverId: dto.driverId === undefined ? undefined : dto.driverId,
          vehicleId: dto.vehicleId === undefined ? undefined : dto.vehicleId,
          attendantId:
            dto.attendantId === undefined ? undefined : dto.attendantId,
        },
        include: {
          route: { select: { id: true, name: true, status: true } },
          branch: { select: { id: true, name: true } },
          driver: { include: { user: true } },
          vehicle: true,
          attendant: { include: { user: true } },
          _count: { select: { stops: true, students: true, events: true } },
        },
      });
      await this.recordAssignmentChanges(
        tx,
        actorUserId,
        trip,
        next,
        dto.reason ?? 'Trip reassigned',
        dto.incidentId,
      );
      if (dto.notifyUsers) {
        await this.notifications.notifyRouteParents(
          {
            actorUserId,
            institutionId,
            routeId: trip.routeId,
            branchId: trip.branchId,
            title: 'Trip crew changed',
            body: dto.reason ?? 'The institution reassigned this trip.',
            data: {
              tripId: id,
              routeId: trip.routeId,
              type: 'ROUTE_CHANGE',
            },
          },
          tx,
        );
      }
      return next;
    });
    this.emitAssignmentChanges(institution.operationModel, trip, updated);
    await this.notifyDriverAssignment(
      actorUserId,
      institutionId,
      trip,
      updated,
    );
    await this.notifyAttendantAssignment(
      actorUserId,
      institutionId,
      trip,
      updated,
    );
    return mapTrip(updated);
  }

  async cancel(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: CancelTripDto,
  ) {
    const trip = await this.trips.findOwned(institutionId, id);
    assertCancelAllowed(trip.status);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.shuttleTrip.update({
        where: { id },
        data: {
          status: TripStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.reason,
        },
        include: {
          route: { select: { id: true, name: true, status: true } },
          branch: { select: { id: true, name: true } },
          driver: { include: { user: true } },
          vehicle: true,
          attendant: { include: { user: true } },
          _count: { select: { stops: true, students: true, events: true } },
        },
      });
      await this.events.record(
        {
          tripId: id,
          type: TripEventType.TRIP_CANCELLED,
          actorUserId,
          title: 'Trip cancelled',
          description: dto.reason,
          data: { reason: dto.reason },
        },
        tx,
      );
      if (dto.notifyUsers) {
        await this.notifications.notifyRouteParents(
          {
            actorUserId,
            institutionId,
            routeId: trip.routeId,
            branchId: trip.branchId,
            title: 'Trip cancelled',
            body: dto.reason,
            data: {
              tripId: id,
              routeId: trip.routeId,
              type: 'TRIP_CANCELLED',
            },
          },
          tx,
        );
      }
      return next;
    });
    await this.tracking.dropLiveTrip(institutionId, id);
    this.realtime.emitTrip(REALTIME_EVENTS.TRIP_CANCELLED, {
      institutionId,
      tripId: id,
      routeId: trip.routeId,
      operationModel: (await this.requireInstitution(institutionId))
        .operationModel,
    });
    if (trip.driver?.userId) {
      await this.notifications.notifyAssignedDriver({
        actorUserId,
        institutionId,
        routeId: trip.routeId,
        branchId: trip.branchId,
        driverUserId: trip.driver.userId,
        title: 'Trip cancelled',
        body: dto.reason,
        data: {
          tripId: id,
          routeId: trip.routeId,
          type: 'TRIP_CANCELLED',
        },
      });
    }
    if (trip.attendant?.userId) {
      await this.notifications.notifyAssignedAttendant({
        actorUserId,
        institutionId,
        routeId: trip.routeId,
        branchId: trip.branchId,
        attendantUserId: trip.attendant.userId,
        title: 'Trip cancelled',
        body: dto.reason,
        data: {
          tripId: id,
          routeId: trip.routeId,
          type: 'TRIP_CANCELLED',
        },
      });
    }
    return mapTrip(updated);
  }

  async updateStudentStatus(
    actorUserId: string,
    institutionId: string,
    tripId: string,
    tripStudentId: string,
    status: TripStudentStatus,
  ) {
    const owned = await this.trips.findOwned(institutionId, tripId);
    const row = await this.prisma.tripStudent.findFirst({
      where: { id: tripStudentId, tripId },
    });
    if (!row) {
      throw new AppException(
        'TRIP_STUDENT_NOT_FOUND',
        'Trip student not found',
        HttpStatus.NOT_FOUND,
      );
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tripStudent.update({
        where: { id: tripStudentId },
        data: {
          status,
          correctedAt: now,
          markedByUserId: actorUserId,
          boardedAt:
            status === TripStudentStatus.BOARDED ||
            status === TripStudentStatus.DROPPED_OFF
              ? (row.boardedAt ?? now)
              : row.boardedAt,
          notBoardedAt:
            status === TripStudentStatus.NOT_BOARDED ||
            status === TripStudentStatus.ABSENT
              ? (row.notBoardedAt ?? now)
              : row.notBoardedAt,
          droppedOffAt:
            status === TripStudentStatus.DROPPED_OFF
              ? (row.droppedOffAt ?? now)
              : row.droppedOffAt,
        },
        include: { student: true, tripStop: true },
      });
      await this.events.record(
        {
          tripId,
          type: TripEventType.STUDENT_STATUS_CORRECTED,
          actorUserId,
          title: 'Student status corrected',
          data: {
            tripStudentId,
            studentId: row.studentId,
            previous: row.status,
            next: status,
          },
        },
        tx,
      );
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.TRIP_STUDENT_STATUS_CORRECTED,
          entityType: ENTITY.TRIP_STUDENT,
          entityId: tripStudentId,
          before: { status: row.status },
          after: { status },
        },
        tx,
      );
      return next;
    });
    const countRows = await this.prisma.tripStudent.groupBy({
      by: ['status'],
      where: { tripId },
      _count: { _all: true },
    });
    const studentCounts = tallyStudentStatusCounts(
      countRows.map((row) => ({ status: row.status, _count: row._count })),
    );
    this.realtime.emitTrip(
      REALTIME_EVENTS.TRIP_STUDENT_STATUS_CHANGED,
      {
        institutionId,
        tripId,
        routeId: owned.routeId,
      },
      {
        trip_student_id: tripStudentId,
        student_id: row.studentId,
        status,
        trip_stop_id: updated.tripStopId ?? row.tripStopId ?? null,
        source: 'INSTITUTION',
        student_counts: studentStatusCountsWire(studentCounts),
      },
    );
    return mapTripStudent(updated);
  }

  private async notifyDriverAssignment(
    actorUserId: string,
    institutionId: string,
    before: {
      id: string;
      routeId: string;
      branchId: string | null;
      driverId: string | null;
      scheduledDepartureTime: string;
      route?: { name: string } | null;
    },
    after: {
      driverId: string | null;
      driver?: { userId: string } | null;
    },
  ) {
    if (
      !after.driverId ||
      after.driverId === before.driverId ||
      !after.driver?.userId
    ) {
      return;
    }
    const routeName = before.route?.name ?? 'route';
    await this.notifications.notifyAssignedDriver({
      actorUserId,
      institutionId,
      routeId: before.routeId,
      branchId: before.branchId,
      driverUserId: after.driver.userId,
      title: 'رحلة جديدة مجدولة',
      body: `تمت إضافة خط ${routeName} — مغادرة ${before.scheduledDepartureTime}`,
      data: {
        tripId: before.id,
        routeId: before.routeId,
        type: 'TRIP_ASSIGNED',
      },
    });
  }

  private async notifyAttendantAssignment(
    actorUserId: string,
    institutionId: string,
    before: {
      id: string;
      routeId: string;
      branchId: string | null;
      attendantId: string | null;
      scheduledDepartureTime: string;
      route?: { name: string } | null;
    },
    after: {
      attendantId: string | null;
      attendant?: { userId: string } | null;
    },
  ) {
    if (
      !after.attendantId ||
      after.attendantId === before.attendantId ||
      !after.attendant?.userId
    ) {
      return;
    }
    const routeName = before.route?.name ?? 'route';
    await this.notifications.notifyAssignedAttendant({
      actorUserId,
      institutionId,
      routeId: before.routeId,
      branchId: before.branchId,
      attendantUserId: after.attendant.userId,
      title: 'رحلة جديدة مجدولة',
      body: `تمت إضافة خط ${routeName} — مغادرة ${before.scheduledDepartureTime}`,
      data: {
        tripId: before.id,
        routeId: before.routeId,
        type: 'TRIP_ASSIGNED',
      },
    });
  }

  private emitAssignmentChanges(
    operationModel: OperationModel,
    before: {
      id: string;
      institutionId: string;
      routeId: string;
      driverId: string | null;
      vehicleId: string | null;
      attendantId: string | null;
    },
    after: {
      driverId: string | null;
      vehicleId: string | null;
      attendantId: string | null;
    },
  ) {
    const payload = {
      institutionId: before.institutionId,
      tripId: before.id,
      routeId: before.routeId,
      operationModel,
    };
    if (before.driverId !== after.driverId) {
      this.realtime.emitTrip(REALTIME_EVENTS.TRIP_DRIVER_CHANGED, payload);
    }
    if (before.vehicleId !== after.vehicleId) {
      this.realtime.emitTrip(REALTIME_EVENTS.TRIP_VEHICLE_CHANGED, payload);
    }
    if (before.attendantId !== after.attendantId) {
      this.realtime.emitTrip(REALTIME_EVENTS.TRIP_ATTENDANT_CHANGED, payload);
    }
  }

  private async recordAssignmentChanges(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    before: {
      id: string;
      driverId: string | null;
      vehicleId: string | null;
      attendantId: string | null;
      driver?: { user: { fullName: string } } | null;
      vehicle?: { plateNumber: string } | null;
      attendant?: { user: { fullName: string } } | null;
    },
    after: {
      driverId: string | null;
      vehicleId: string | null;
      attendantId: string | null;
      driver?: { user: { fullName: string } } | null;
      vehicle?: { plateNumber: string } | null;
      attendant?: { user: { fullName: string } } | null;
    },
    reason: string,
    incidentId?: string,
  ) {
    const changes: Array<{
      field: TripAssignmentField;
      type: TripEventType;
      previousId: string | null;
      previousLabel: string | null;
      newId: string | null;
      newLabel: string | null;
      title: string;
    }> = [];
    if (before.driverId !== after.driverId) {
      changes.push({
        field: TripAssignmentField.DRIVER,
        type: TripEventType.DRIVER_CHANGED,
        previousId: before.driverId,
        previousLabel: before.driver?.user.fullName ?? null,
        newId: after.driverId,
        newLabel: after.driver?.user.fullName ?? null,
        title: 'Driver changed',
      });
    }
    if (before.vehicleId !== after.vehicleId) {
      changes.push({
        field: TripAssignmentField.VEHICLE,
        type: TripEventType.VEHICLE_CHANGED,
        previousId: before.vehicleId,
        previousLabel: before.vehicle?.plateNumber ?? null,
        newId: after.vehicleId,
        newLabel: after.vehicle?.plateNumber ?? null,
        title: 'Vehicle changed',
      });
    }
    if (before.attendantId !== after.attendantId) {
      changes.push({
        field: TripAssignmentField.ATTENDANT,
        type: TripEventType.ATTENDANT_CHANGED,
        previousId: before.attendantId,
        previousLabel: before.attendant?.user.fullName ?? null,
        newId: after.attendantId,
        newLabel: after.attendant?.user.fullName ?? null,
        title: 'Attendant changed',
      });
    }
    for (const change of changes) {
      await tx.tripAssignmentHistory.create({
        data: {
          tripId: before.id,
          field: change.field,
          previousId: change.previousId,
          previousLabel: change.previousLabel,
          newId: change.newId,
          newLabel: change.newLabel,
          reason,
          incidentId,
          changedByUserId: actorUserId,
        },
      });
      await this.events.record(
        {
          tripId: before.id,
          type: change.type,
          actorUserId,
          title: change.title,
          description: reason,
          data: {
            previousId: change.previousId,
            previousLabel: change.previousLabel,
            newId: change.newId,
            newLabel: change.newLabel,
          },
        },
        tx,
      );
    }
  }

  private async shiftPlannedArrivals(
    tx: Prisma.TransactionClient,
    tripId: string,
    serviceDate: Date,
    previousTime: string,
    nextTime: string,
    timeZone: string,
  ) {
    const previousStart = zonedDateTime(serviceDate, previousTime, timeZone);
    const nextStart = zonedDateTime(serviceDate, nextTime, timeZone);
    const delta = nextStart.getTime() - previousStart.getTime();
    const stops = await tx.tripStop.findMany({ where: { tripId } });
    for (const stop of stops) {
      if (!stop.plannedArrivalAt) {
        continue;
      }
      await tx.tripStop.update({
        where: { id: stop.id },
        data: {
          plannedArrivalAt: new Date(stop.plannedArrivalAt.getTime() + delta),
        },
      });
    }
  }

  private async assertAssignmentTargets(
    institutionId: string,
    operationModel: OperationModel,
    dto: { driverId?: string | null; vehicleId?: string | null; attendantId?: string | null },
  ) {
    if (dto.driverId) {
      const driver = await this.prisma.driverProfile.findFirst({
        where: { id: dto.driverId, archivedAt: null, status: ResourceStatus.ACTIVE },
      });
      if (!driver) {
        throw new AppException('DRIVER_NOT_FOUND', 'Driver not found', HttpStatus.NOT_FOUND);
      }
      const own =
        driver.ownerType === OwnerType.INSTITUTION &&
        driver.institutionId === institutionId;
      const beroya =
        driver.ownerType === OwnerType.BEROYA &&
        canSeeBeroyaResources(operationModel) &&
        (driver.institutionId === null || driver.institutionId === institutionId);
      if (!own && !beroya) {
        throw new AppException(
          'DRIVER_NOT_AVAILABLE',
          'This driver cannot be assigned to the institution',
          HttpStatus.FORBIDDEN,
        );
      }
    }
    if (dto.vehicleId) {
      const vehicle = await this.prisma.shuttleVehicle.findFirst({
        where: { id: dto.vehicleId, archivedAt: null, status: VehicleStatus.ACTIVE },
      });
      if (!vehicle) {
        throw new AppException('VEHICLE_NOT_FOUND', 'Vehicle not found', HttpStatus.NOT_FOUND);
      }
      const own =
        vehicle.ownerType === OwnerType.INSTITUTION &&
        vehicle.institutionId === institutionId;
      const beroya =
        (vehicle.ownerType === OwnerType.BEROYA || vehicle.ownerType === OwnerType.DRIVER) &&
        canSeeBeroyaResources(operationModel) &&
        (vehicle.institutionId === null || vehicle.institutionId === institutionId);
      if (!own && !beroya) {
        throw new AppException(
          'VEHICLE_NOT_AVAILABLE',
          'This vehicle cannot be assigned to the institution',
          HttpStatus.FORBIDDEN,
        );
      }
    }
    if (dto.attendantId) {
      const attendant = await this.prisma.attendantProfile.findFirst({
        where: {
          id: dto.attendantId,
          institutionId,
          archivedAt: null,
          status: ResourceStatus.ACTIVE,
        },
      });
      if (!attendant) {
        throw new AppException(
          'ATTENDANT_NOT_FOUND',
          'Attendant not found',
          HttpStatus.NOT_FOUND,
        );
      }
    }
  }

  private async requireInstitution(institutionId: string) {
    const institution = await this.prisma.institution.findFirst({
      where: { id: institutionId, archivedAt: null },
      select: { operationModel: true },
    });
    if (!institution) {
      throw new AppException(
        'INSTITUTION_NOT_FOUND',
        'Institution not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return institution;
  }

  private async timezone(institutionId: string): Promise<string> {
    const settings = await this.prisma.institutionSettings.findUnique({
      where: { institutionId },
    });
    return settings?.timezone ?? 'Asia/Damascus';
  }
}
