import { HttpStatus, Injectable } from '@nestjs/common';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { todayInTimezone } from '../../common/utils/timezone';
import {
  OperationModel,
  OwnerType,
  PickupType,
  Prisma,
  ResourceStatus,
  RouteStatus,
  StopType,
  StudentStatus,
  TripDirection,
  TripStatus,
  VehicleStatus,
} from '../../generated/prisma/client';
import {
  nearestNeighborOrder,
  twoOptImprove,
} from '../../infra/routing/haversine';
import { RoutingService } from '../../infra/routing/routing.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../admin/admin.constants';
import { AuditService } from '../shared/audit/audit.service';
import { NotificationService } from '../shared/notifications/notification.service';
import { canSeeBeroyaResources } from '../shared/resources/resource.rules';
import { AssignRouteStudentsDto } from './dto/assign-route-students.dto';
import { CreateCustomStopDto } from './dto/create-custom-stop.dto';
import { CreateRouteDto } from './dto/create-route.dto';
import { CreateRouteScheduleDto } from './dto/create-route-schedule.dto';
import { DefaultAssignmentDto } from './dto/default-assignment.dto';
import { ListRoutesQueryDto } from './dto/list-routes.query';
import { OptimizeStopsDto } from './dto/optimize-stops.dto';
import { StopOrderDto } from './dto/stop-order.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { UpdateRouteScheduleDto } from './dto/update-route-schedule.dto';
import { UpdateRouteStatusDto } from './dto/update-route-status.dto';
import { UpdateRouteStopDto } from './dto/update-route-stop.dto';
import { PeopleUsersService } from './people-users.service';
import {
  mapRouteDetail,
  mapRouteStop,
  mapRouteSummary,
  mapSchedule,
} from './route.mapper';
import { refreshShuttleRoutePolylines } from './route-polyline';
import {
  assertCompleteStopOrder,
  assertSchoolScheduleLimit,
  inboundPickupOrder,
  normalizeDaysOfWeek,
  sequencesAreContiguous,
} from './route.rules';

const routeListInclude = {
  defaultDriver: { include: { user: true } },
  defaultVehicle: true,
  defaultAttendant: { include: { user: true } },
  stops: {
    include: {
      students: {
        include: { student: { include: { pickupConfig: true } } },
      },
    },
  },
  _count: {
    select: {
      schedules: true,
      stops: true,
      studentAssignments: { where: { isActive: true } },
    },
  },
} as const;

const routeDetailInclude = {
  ...routeListInclude,
  schedules: true,
  studentAssignments: {
    where: { isActive: true },
    include: {
      student: {
        include: {
          guardianUser: true,
          pickupConfig: { include: { meetingPoint: true } },
        },
      },
    },
  },
} as const;

const stopInclude = {
  meetingPoint: true,
  students: { include: { student: true } },
} as const;

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly people: PeopleUsersService,
    private readonly routing: RoutingService,
    private readonly notifications: NotificationService,
  ) {}

  async list(institutionId: string, query: ListRoutesQueryDto) {
    const where: Prisma.ShuttleRouteWhereInput = {
      institutionId,
      archivedAt: null,
    };
    if (query.branchId) {
      where.branchId = query.branchId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.driverId) {
      where.defaultDriverId = query.driverId;
    }
    if (query.vehicleId) {
      where.defaultVehicleId = query.vehicleId;
    }
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    const total = await this.prisma.shuttleRoute.count({ where });
    const rows = await this.prisma.shuttleRoute.findMany({
      where,
      include: routeListInclude,
      orderBy: { name: 'asc' },
      skip: paginationOffset(query.page, query.limit),
      take: query.limit,
    });
    return {
      data: rows.map(mapRouteSummary),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async stats(institutionId: string) {
    const base = { institutionId, archivedAt: null };
    const [total, active, suspended, stoppedToday, unavailable, underEdit] =
      await Promise.all([
        this.prisma.shuttleRoute.count({ where: base }),
        this.prisma.shuttleRoute.count({
          where: { ...base, status: RouteStatus.ACTIVE },
        }),
        this.prisma.shuttleRoute.count({
          where: { ...base, status: RouteStatus.SUSPENDED },
        }),
        this.prisma.shuttleRoute.count({
          where: { ...base, status: RouteStatus.STOPPED_TODAY },
        }),
        this.prisma.shuttleRoute.count({
          where: { ...base, status: RouteStatus.TEMPORARILY_UNAVAILABLE },
        }),
        this.prisma.shuttleRoute.count({
          where: { ...base, status: RouteStatus.UNDER_EDIT },
        }),
      ]);
    return { total, active, suspended, stoppedToday, unavailable, underEdit };
  }

  async create(
    actorUserId: string,
    institutionId: string,
    dto: CreateRouteDto,
  ) {
    await this.people.requireBranch(institutionId, dto.branchId);
    await this.assertNameFree(institutionId, dto.name);
    const created = await this.prisma.$transaction(async (tx) => {
      const route = await tx.shuttleRoute.create({
        data: {
          institutionId,
          branchId: dto.branchId,
          name: dto.name,
          code: dto.code,
          originLabel: dto.originLabel,
          originLat: dto.originLat,
          originLng: dto.originLng,
          delayThresholdMinutes: dto.delayThresholdMinutes,
        },
        include: routeDetailInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ROUTE_CREATED,
          entityType: ENTITY.SHUTTLE_ROUTE,
          entityId: route.id,
          after: mapRouteSummary(route),
        },
        tx,
      );
      return route;
    });
    return mapRouteDetail(created);
  }

  async getById(institutionId: string, id: string) {
    return mapRouteDetail(await this.findOwned(institutionId, id));
  }

  async update(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: UpdateRouteDto,
  ) {
    const current = await this.findOwned(institutionId, id);
    if (dto.branchId) {
      await this.people.requireBranch(institutionId, dto.branchId);
    }
    if (dto.name && dto.name !== current.name) {
      await this.assertNameFree(institutionId, dto.name, id);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.shuttleRoute.update({
        where: { id },
        data: {
          name: dto.name,
          branchId: dto.branchId,
          code: dto.code,
          originLabel: dto.originLabel,
          originLat: dto.originLat,
          originLng: dto.originLng,
          delayThresholdMinutes: dto.delayThresholdMinutes,
        },
        include: routeDetailInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ROUTE_UPDATED,
          entityType: ENTITY.SHUTTLE_ROUTE,
          entityId: id,
          before: mapRouteSummary(current),
          after: mapRouteSummary(next),
        },
        tx,
      );
      return next;
    });
    return mapRouteDetail(updated);
  }

  async updateStatus(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: UpdateRouteStatusDto,
  ) {
    const current = await this.findOwned(institutionId, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.shuttleRoute.update({
        where: { id },
        data: { status: dto.status },
        include: routeDetailInclude,
      });
      if (dto.notifyUsers) {
        await this.notifications.notifyRouteParents(
          {
            actorUserId,
            institutionId,
            routeId: id,
            branchId: next.branchId,
            title: `Route ${next.name} status changed`,
            body: `Route ${next.name} is now ${next.status}`,
            data: { routeId: id, status: next.status, type: 'ROUTE_CHANGE' },
          },
          tx,
        );
        await this.notifications.notifyRouteAttendants(
          {
            actorUserId,
            institutionId,
            routeId: id,
            branchId: next.branchId,
            title: `Route ${next.name} status changed`,
            body: `Route ${next.name} is now ${next.status}`,
            data: { routeId: id, status: next.status, type: 'ROUTE_CHANGE' },
          },
          tx,
        );
      }
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ROUTE_STATUS_CHANGED,
          entityType: ENTITY.SHUTTLE_ROUTE,
          entityId: id,
          before: { status: current.status },
          after: { status: next.status, notifyUsers: Boolean(dto.notifyUsers) },
        },
        tx,
      );
      return next;
    });
    return mapRouteDetail(updated);
  }

  async updateDefaultAssignment(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: DefaultAssignmentDto,
  ) {
    const current = await this.findOwned(institutionId, id);
    const institution = await this.requireInstitution(institutionId);
    if (dto.driverId) {
      await this.requireAssignableDriver(
        institutionId,
        institution.operationModel,
        dto.driverId,
      );
    }
    if (dto.vehicleId) {
      await this.requireAssignableVehicle(
        institutionId,
        institution.operationModel,
        dto.vehicleId,
      );
    }
    if (dto.attendantId) {
      await this.requireAssignableAttendant(institutionId, dto.attendantId, id);
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.shuttleRoute.update({
          where: { id },
          data: {
            defaultDriverId:
              dto.driverId === undefined ? undefined : dto.driverId,
            defaultVehicleId:
              dto.vehicleId === undefined ? undefined : dto.vehicleId,
            defaultAttendantId:
              dto.attendantId === undefined ? undefined : dto.attendantId,
          },
          include: routeDetailInclude,
        });
        await this.applyAssignmentToFutureTrips(
          institutionId,
          id,
          {
            driverId: dto.driverId,
            vehicleId: dto.vehicleId,
            attendantId: dto.attendantId,
          },
          tx,
        );
        await this.audit.record(
          {
            actorUserId,
            institutionId,
            action: AUDIT.ROUTE_DEFAULT_ASSIGNMENT_CHANGED,
            entityType: ENTITY.SHUTTLE_ROUTE,
            entityId: id,
            before: {
              defaultDriverId: current.defaultDriverId,
              defaultVehicleId: current.defaultVehicleId,
              defaultAttendantId: current.defaultAttendantId,
            },
            after: {
              defaultDriverId: next.defaultDriverId,
              defaultVehicleId: next.defaultVehicleId,
              defaultAttendantId: next.defaultAttendantId,
            },
          },
          tx,
        );
        return next;
      });
      if (
        updated.defaultAttendantId &&
        updated.defaultAttendantId !== current.defaultAttendantId &&
        updated.defaultAttendant?.userId
      ) {
        await this.notifications.notifyAssignedAttendant({
          actorUserId,
          institutionId,
          routeId: id,
          branchId: updated.branchId,
          attendantUserId: updated.defaultAttendant.userId,
          title: 'تم تعيينك على خط',
          body: `تم تعيينك كمشرفة على خط ${updated.name}`,
          data: { routeId: id, type: 'ATTENDANT_ASSIGNED' },
        });
      }
      return mapRouteDetail(updated);
    } catch (error) {
      this.throwIfAttendantTaken(error);
      throw error;
    }
  }

  async listStudents(institutionId: string, id: string) {
    const route = await this.findOwned(institutionId, id);
    return mapRouteDetail(route).students;
  }

  async assignStudents(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: AssignRouteStudentsDto,
  ) {
    await this.findOwned(institutionId, id);
    const uniqueIds = [...new Set(dto.studentIds)];
    await this.prisma.$transaction(async (tx) => {
      const route = await tx.shuttleRoute.findFirstOrThrow({
        where: { id, institutionId, archivedAt: null },
        include: { branch: true },
      });
      await this.ensureInstitutionStops(tx, route);
      for (const studentId of uniqueIds) {
        await this.assignOneStudent(tx, route, studentId);
      }
      await this.resequenceStops(tx, route.id);
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ROUTE_STUDENTS_ASSIGNED,
          entityType: ENTITY.SHUTTLE_ROUTE,
          entityId: id,
          after: { studentIds: uniqueIds },
        },
        tx,
      );
    });
    return this.getById(institutionId, id);
  }

  async removeStudent(
    actorUserId: string,
    institutionId: string,
    routeId: string,
    studentId: string,
  ) {
    await this.findOwned(institutionId, routeId);
    await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.studentRouteAssignment.findFirst({
        where: { routeId, studentId, isActive: true },
      });
      if (!assignment) {
        throw new AppException(
          'STUDENT_NOT_ON_ROUTE',
          'Student is not assigned to this route',
          HttpStatus.NOT_FOUND,
        );
      }
      await tx.studentRouteAssignment.update({
        where: { id: assignment.id },
        data: { isActive: false, endedAt: new Date() },
      });
      const links = await tx.routeStopStudent.findMany({
        where: { studentId, routeStop: { routeId } },
        include: { routeStop: { include: { students: true } } },
      });
      for (const link of links) {
        await tx.routeStopStudent.delete({ where: { id: link.id } });
        const remaining = link.routeStop.students.filter(
          (row) => row.studentId !== studentId,
        ).length;
        if (
          remaining === 0 &&
          link.routeStop.stopType !== StopType.INSTITUTION &&
          link.routeStop.stopType !== StopType.CUSTOM
        ) {
          await tx.routeStop.delete({ where: { id: link.routeStopId } });
        }
      }
      await this.resequenceStops(tx, routeId);
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ROUTE_STUDENT_REMOVED,
          entityType: ENTITY.SHUTTLE_ROUTE,
          entityId: routeId,
          after: { studentId },
        },
        tx,
      );
    });
    return this.getById(institutionId, routeId);
  }

  async listSchedules(institutionId: string, id: string) {
    await this.findOwned(institutionId, id);
    const rows = await this.prisma.routeSchedule.findMany({
      where: { routeId: id },
      orderBy: [{ direction: 'asc' }, { departureTime: 'asc' }],
    });
    return rows.map(mapSchedule);
  }

  async createSchedule(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: CreateRouteScheduleDto,
  ) {
    await this.findOwned(institutionId, id);
    const institution = await this.requireInstitution(institutionId);
    const daysOfWeek = normalizeDaysOfWeek(dto.daysOfWeek);
    const existing = await this.prisma.routeSchedule.count({
      where: { routeId: id, direction: dto.direction },
    });
    assertSchoolScheduleLimit(institution.type, existing);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const schedule = await tx.routeSchedule.create({
          data: {
            routeId: id,
            direction: dto.direction,
            departureTime: dto.departureTime,
            daysOfWeek,
          },
        });
        await this.audit.record(
          {
            actorUserId,
            institutionId,
            action: AUDIT.ROUTE_SCHEDULE_CREATED,
            entityType: ENTITY.ROUTE_SCHEDULE,
            entityId: schedule.id,
            after: mapSchedule(schedule),
          },
          tx,
        );
        return schedule;
      });
      return mapSchedule(created);
    } catch (error) {
      this.throwIfScheduleClash(error);
      throw error;
    }
  }

  async updateSchedule(
    actorUserId: string,
    institutionId: string,
    routeId: string,
    scheduleId: string,
    dto: UpdateRouteScheduleDto,
  ) {
    await this.findOwned(institutionId, routeId);
    const current = await this.requireSchedule(routeId, scheduleId);
    const institution = await this.requireInstitution(institutionId);
    if (dto.direction && dto.direction !== current.direction) {
      const existing = await this.prisma.routeSchedule.count({
        where: { routeId, direction: dto.direction, id: { not: scheduleId } },
      });
      assertSchoolScheduleLimit(institution.type, existing);
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.routeSchedule.update({
          where: { id: scheduleId },
          data: {
            direction: dto.direction,
            departureTime: dto.departureTime,
            daysOfWeek: dto.daysOfWeek
              ? normalizeDaysOfWeek(dto.daysOfWeek)
              : undefined,
            isActive: dto.isActive,
          },
        });
        await this.audit.record(
          {
            actorUserId,
            institutionId,
            action: AUDIT.ROUTE_SCHEDULE_UPDATED,
            entityType: ENTITY.ROUTE_SCHEDULE,
            entityId: scheduleId,
            before: mapSchedule(current),
            after: mapSchedule(next),
          },
          tx,
        );
        return next;
      });
      return mapSchedule(updated);
    } catch (error) {
      this.throwIfScheduleClash(error);
      throw error;
    }
  }

  async deleteSchedule(
    actorUserId: string,
    institutionId: string,
    routeId: string,
    scheduleId: string,
  ) {
    await this.findOwned(institutionId, routeId);
    const current = await this.requireSchedule(routeId, scheduleId);
    await this.prisma.$transaction(async (tx) => {
      await tx.routeSchedule.delete({ where: { id: scheduleId } });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ROUTE_SCHEDULE_DELETED,
          entityType: ENTITY.ROUTE_SCHEDULE,
          entityId: scheduleId,
          before: mapSchedule(current),
        },
        tx,
      );
    });
    return { success: true };
  }

  async listStops(
    institutionId: string,
    id: string,
    direction: TripDirection = TripDirection.OUTBOUND,
  ) {
    await this.findOwned(institutionId, id);
    const rows = await this.prisma.routeStop.findMany({
      where: { routeId: id, direction },
      include: stopInclude,
      orderBy: { sequence: 'asc' },
    });
    return rows.map(mapRouteStop);
  }

  async createCustomStop(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: CreateCustomStopDto,
  ) {
    const route = await this.findOwned(institutionId, id);
    const created = await this.prisma.$transaction(async (tx) => {
      await this.ensureInstitutionStops(tx, {
        ...route,
        branch: await tx.institutionBranch.findFirstOrThrow({
          where: { id: route.branchId },
        }),
      });
      const stop = await tx.routeStop.create({
        data: {
          routeId: id,
          direction: dto.direction,
          sequence: await this.nextStopSequence(tx, id, dto.direction),
          stopType: StopType.CUSTOM,
          label: dto.label ?? 'Custom stop',
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
        include: stopInclude,
      });
      await this.resequenceStops(tx, id);
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ROUTE_STOP_CREATED,
          entityType: ENTITY.ROUTE_STOP,
          entityId: stop.id,
          after: mapRouteStop(stop),
        },
        tx,
      );
      return tx.routeStop.findFirstOrThrow({
        where: { id: stop.id },
        include: stopInclude,
      });
    });
    await this.queuePolylineRefresh(id);
    return mapRouteStop(created);
  }

  async updateStop(
    actorUserId: string,
    institutionId: string,
    routeId: string,
    stopId: string,
    dto: UpdateRouteStopDto,
  ) {
    await this.findOwned(institutionId, routeId);
    const current = await this.requireStop(routeId, stopId);
    if (
      current.stopType === StopType.INSTITUTION &&
      (dto.latitude || dto.longitude)
    ) {
      throw new AppException(
        'INSTITUTION_STOP_FIXED',
        'Institution stop coordinates come from the branch',
        HttpStatus.BAD_REQUEST,
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.routeStop.update({
        where: { id: stopId },
        data: {
          label: dto.label,
          latitude: dto.latitude,
          longitude: dto.longitude,
          etaOffsetMinutes: null,
        },
        include: stopInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ROUTE_STOP_UPDATED,
          entityType: ENTITY.ROUTE_STOP,
          entityId: stopId,
          before: mapRouteStop(current),
          after: mapRouteStop(next),
        },
        tx,
      );
      return next;
    });
    await this.queuePolylineRefresh(routeId);
    return mapRouteStop(updated);
  }

  async deleteStop(
    actorUserId: string,
    institutionId: string,
    routeId: string,
    stopId: string,
  ) {
    await this.findOwned(institutionId, routeId);
    const current = await this.requireStop(routeId, stopId);
    if (current.stopType === StopType.INSTITUTION) {
      throw new AppException(
        'INSTITUTION_STOP_FIXED',
        'The institution stop cannot be deleted',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (current.students.length > 0) {
      throw new AppException(
        'STOP_HAS_STUDENTS',
        'Remove assigned students before deleting this stop',
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.routeStop.delete({ where: { id: stopId } });
      await this.resequenceStops(tx, routeId);
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ROUTE_STOP_DELETED,
          entityType: ENTITY.ROUTE_STOP,
          entityId: stopId,
          before: mapRouteStop(current),
        },
        tx,
      );
    });
    await this.queuePolylineRefresh(routeId);
    return { success: true };
  }

  async optimizeStops(
    institutionId: string,
    id: string,
    dto: OptimizeStopsDto,
  ) {
    const route = await this.findOwned(institutionId, id);
    const direction = dto.direction ?? TripDirection.OUTBOUND;
    const stops = route.stops
      .filter((stop) => stop.direction === direction)
      .sort((a, b) => a.sequence - b.sequence);
    const institutionStop = stops.find(
      (stop) => stop.stopType === StopType.INSTITUTION,
    );
    const movable = stops.filter(
      (stop) => stop.stopType !== StopType.INSTITUTION,
    );
    const origin = {
      lat: route.originLat,
      lng: route.originLng,
    };
    const start =
      direction === TripDirection.INBOUND && institutionStop
        ? { lat: institutionStop.latitude, lng: institutionStop.longitude }
        : origin;
    const ordered = twoOptImprove(
      nearestNeighborOrder(
        start,
        movable.map((stop) => ({
          id: stop.id,
          point: { lat: stop.latitude, lng: stop.longitude },
          stop,
        })),
      ),
    ).map((item) => item.stop);

    const proposed = this.buildDirectedStops(
      direction,
      ordered,
      institutionStop,
    );
    const currentOrdered = this.buildDirectedStops(
      direction,
      movable,
      institutionStop,
    );
    const [proposedMetrics, currentMetrics, addresses] = await Promise.all([
      this.measurePath(start, proposed),
      this.measurePath(start, currentOrdered),
      this.homeStopAddresses(proposed.map((stop) => stop.id)),
    ]);

    return {
      direction,
      persisted: false,
      origin: {
        label: route.originLabel,
        latitude: route.originLat,
        longitude: route.originLng,
      },
      stops: proposedMetrics.stops.map((stop) => ({
        ...stop,
        address: addresses.get(stop.stopId) ?? null,
      })),
      totalDistanceMeters: proposedMetrics.totalDistanceMeters,
      totalDurationSeconds: proposedMetrics.totalDurationSeconds,
      current: {
        stopIds: currentOrdered.map((stop) => stop.id),
        totalDistanceMeters: currentMetrics.totalDistanceMeters,
        totalDurationSeconds: currentMetrics.totalDurationSeconds,
      },
      improved:
        proposedMetrics.totalDistanceMeters + 1e-6 <
        currentMetrics.totalDistanceMeters,
    };
  }

  async saveStopOrder(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: StopOrderDto,
  ) {
    const route = await this.findOwned(institutionId, id);
    const existing = route.stops.filter(
      (stop) => stop.direction === dto.direction,
    );
    assertCompleteStopOrder(
      existing.map((stop) => stop.id),
      dto.stops.map((item) => item.stopId),
    );
    if (!sequencesAreContiguous(dto.stops.map((item) => item.sequence))) {
      throw new AppException(
        'STOP_ORDER_MISMATCH',
        'sequences must be contiguous starting at 1',
        HttpStatus.BAD_REQUEST,
      );
    }
    const ordered = [...dto.stops]
      .sort((a, b) => a.sequence - b.sequence)
      .map((item) => existing.find((stop) => stop.id === item.stopId)!);
    this.assertInstitutionAnchor(dto.direction, ordered);

    const start =
      dto.direction === TripDirection.INBOUND
        ? ordered[0]
          ? { lat: ordered[0].latitude, lng: ordered[0].longitude }
          : { lat: route.originLat, lng: route.originLng }
        : { lat: route.originLat, lng: route.originLng };
    const metrics = await this.measurePath(start, ordered);
    const inboundMirror = await this.defaultInboundMirror(
      route,
      dto.direction,
      ordered,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.persistMeasuredOrder(tx, metrics.stops);
      if (inboundMirror) {
        await this.persistMeasuredOrder(tx, inboundMirror.stops);
      }
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ROUTE_STOP_ORDER_SAVED,
          entityType: ENTITY.SHUTTLE_ROUTE,
          entityId: id,
          after: {
            direction: dto.direction,
            stops: metrics.stops,
            inboundMirrored: Boolean(inboundMirror),
          },
        },
        tx,
      );
      return tx.shuttleRoute.findFirstOrThrow({
        where: { id },
        include: routeDetailInclude,
      });
    });
    await this.queuePolylineRefresh(id);
    return mapRouteDetail(updated);
  }

  private async queuePolylineRefresh(routeId: string): Promise<void> {
    try {
      await refreshShuttleRoutePolylines(this.prisma, this.routing, routeId);
    } catch {
      // Non-blocking: detail endpoints can retry lazy refresh
    }
  }

  private async defaultInboundMirror(
    route: {
      originLat: number;
      originLng: number;
      stops: Array<{
        id: string;
        direction: TripDirection;
        stopType: StopType;
        sequence: number;
        latitude: number;
        longitude: number;
        label: string | null;
        meetingPointId: string | null;
        etaOffsetMinutes: number | null;
        students: Array<{ studentId: string }>;
      }>;
    },
    savedDirection: TripDirection,
    outboundOrdered: Array<{
      id: string;
      stopType: StopType;
      meetingPointId: string | null;
      students: Array<{ studentId: string }>;
      latitude: number;
      longitude: number;
      label: string | null;
    }>,
  ) {
    if (savedDirection !== TripDirection.OUTBOUND) {
      return null;
    }
    const inbound = route.stops.filter(
      (stop) => stop.direction === TripDirection.INBOUND,
    );
    const inboundPickups = inbound.filter(
      (stop) => stop.stopType !== StopType.INSTITUTION,
    );
    if (
      inboundPickups.length === 0 ||
      inboundPickups.some((stop) => stop.etaOffsetMinutes != null)
    ) {
      return null;
    }
    const outboundPickups = outboundOrdered.filter(
      (stop) => stop.stopType !== StopType.INSTITUTION,
    );
    const mirrored = inboundPickupOrder(
      outboundPickups
        .map((outbound) =>
          inboundPickups.find((inboundStop) =>
            this.samePickupStop(outbound, inboundStop),
          ),
        )
        .filter((stop): stop is (typeof inboundPickups)[number] =>
          Boolean(stop),
        ),
    );
    const institutionStop = inbound.find(
      (stop) => stop.stopType === StopType.INSTITUTION,
    );
    const ordered = this.buildDirectedStops(
      TripDirection.INBOUND,
      mirrored,
      institutionStop,
    );
    const start = institutionStop
      ? { lat: institutionStop.latitude, lng: institutionStop.longitude }
      : { lat: route.originLat, lng: route.originLng };
    return this.measurePath(start, ordered);
  }

  private async persistMeasuredOrder(
    tx: Prisma.TransactionClient,
    stops: Array<{
      stopId: string;
      sequence: number;
      etaOffsetMinutes: number;
    }>,
  ) {
    for (const item of stops) {
      await tx.routeStop.update({
        where: { id: item.stopId },
        data: { sequence: item.sequence + 1000 },
      });
    }
    for (const item of stops) {
      await tx.routeStop.update({
        where: { id: item.stopId },
        data: {
          sequence: item.sequence,
          etaOffsetMinutes: item.etaOffsetMinutes,
        },
      });
    }
  }

  private async assignOneStudent(
    tx: Prisma.TransactionClient,
    route: { id: string; institutionId: string; branchId: string },
    studentId: string,
  ) {
    const student = await tx.schoolStudent.findFirst({
      where: {
        id: studentId,
        institutionId: route.institutionId,
        archivedAt: null,
        status: StudentStatus.ACTIVE,
      },
      include: { pickupConfig: { include: { meetingPoint: true } } },
    });
    if (!student) {
      throw new AppException(
        'STUDENT_NOT_FOUND',
        'Student not found',
        HttpStatus.NOT_FOUND,
        { studentId },
      );
    }
    if (!student.pickupConfig) {
      throw new AppException(
        'PICKUP_REQUIRED',
        'Student must have a pickup configuration before route assignment',
        HttpStatus.BAD_REQUEST,
        { studentId },
      );
    }
    const alreadyHere = await tx.studentRouteAssignment.findFirst({
      where: { studentId, routeId: route.id, isActive: true },
    });
    if (alreadyHere) {
      return;
    }
    await tx.studentRouteAssignment.updateMany({
      where: { studentId, isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });
    await tx.studentRouteAssignment.create({
      data: { studentId, routeId: route.id },
    });
    await this.attachPickupStops(tx, route.id, {
      id: student.id,
      fullName: student.fullName,
      pickupConfig: student.pickupConfig,
    });
  }

  private async attachPickupStops(
    tx: Prisma.TransactionClient,
    routeId: string,
    student: {
      id: string;
      fullName: string;
      pickupConfig: {
        pickupType: PickupType;
        meetingPointId: string | null;
        latitude: number | null;
        longitude: number | null;
        meetingPoint: {
          id: string;
          name: string;
          latitude: number;
          longitude: number;
        } | null;
      };
    },
  ) {
    const pickup = student.pickupConfig;
    for (const direction of [TripDirection.OUTBOUND, TripDirection.INBOUND]) {
      if (pickup.pickupType === PickupType.HOME) {
        if (pickup.latitude == null || pickup.longitude == null) {
          throw new AppException(
            'PICKUP_HOME_LOCATION_REQUIRED',
            'Home pickup requires latitude and longitude',
            HttpStatus.BAD_REQUEST,
          );
        }
        const existing = await tx.routeStop.findFirst({
          where: {
            routeId,
            direction,
            stopType: StopType.STUDENT_HOME,
            students: { some: { studentId: student.id } },
          },
        });
        if (existing) {
          continue;
        }
        await tx.routeStop.create({
          data: {
            routeId,
            direction,
            sequence: await this.nextStopSequence(tx, routeId, direction),
            stopType: StopType.STUDENT_HOME,
            label: student.fullName,
            latitude: pickup.latitude,
            longitude: pickup.longitude,
            students: { create: { studentId: student.id } },
          },
        });
        continue;
      }

      if (!pickup.meetingPointId || !pickup.meetingPoint) {
        throw new AppException(
          'PICKUP_MEETING_POINT_REQUIRED',
          'Meeting-point pickup requires meeting_point_id',
          HttpStatus.BAD_REQUEST,
        );
      }
      const existing = await tx.routeStop.findFirst({
        where: {
          routeId,
          direction,
          stopType: StopType.MEETING_POINT,
          meetingPointId: pickup.meetingPointId,
        },
      });
      if (existing) {
        await tx.routeStopStudent.upsert({
          where: {
            routeStopId_studentId: {
              routeStopId: existing.id,
              studentId: student.id,
            },
          },
          create: { routeStopId: existing.id, studentId: student.id },
          update: {},
        });
        continue;
      }
      await tx.routeStop.create({
        data: {
          routeId,
          direction,
          sequence: await this.nextStopSequence(tx, routeId, direction),
          stopType: StopType.MEETING_POINT,
          meetingPointId: pickup.meetingPointId,
          label: pickup.meetingPoint.name,
          latitude: pickup.meetingPoint.latitude,
          longitude: pickup.meetingPoint.longitude,
          students: { create: { studentId: student.id } },
        },
      });
    }
  }

  private async ensureInstitutionStops(
    tx: Prisma.TransactionClient,
    route: {
      id: string;
      branchId: string;
      branch?: {
        name: string;
        latitude: number | null;
        longitude: number | null;
      };
    },
  ) {
    const branch =
      route.branch ??
      (await tx.institutionBranch.findFirst({
        where: { id: route.branchId, archivedAt: null },
      }));
    if (!branch || branch.latitude == null || branch.longitude == null) {
      throw new AppException(
        'BRANCH_LOCATION_REQUIRED',
        'Branch latitude and longitude are required before adding route stops',
        HttpStatus.BAD_REQUEST,
      );
    }
    for (const direction of [TripDirection.OUTBOUND, TripDirection.INBOUND]) {
      const existing = await tx.routeStop.findFirst({
        where: { routeId: route.id, direction, stopType: StopType.INSTITUTION },
      });
      if (existing) {
        continue;
      }
      await tx.routeStop.create({
        data: {
          routeId: route.id,
          direction,
          sequence: await this.nextStopSequence(tx, route.id, direction),
          stopType: StopType.INSTITUTION,
          label: branch.name,
          latitude: branch.latitude,
          longitude: branch.longitude,
        },
      });
    }
  }

  private async resequenceStops(tx: Prisma.TransactionClient, routeId: string) {
    const stops = await tx.routeStop.findMany({
      where: { routeId },
      include: { students: true },
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    });
    const outboundPickups = stops.filter(
      (stop) =>
        stop.direction === TripDirection.OUTBOUND &&
        stop.stopType !== StopType.INSTITUTION,
    );
    const inboundPickups = stops.filter(
      (stop) =>
        stop.direction === TripDirection.INBOUND &&
        stop.stopType !== StopType.INSTITUTION,
    );
    const inboundSaved = inboundPickups.some(
      (stop) => stop.etaOffsetMinutes != null,
    );
    const inboundOrdered = inboundSaved
      ? inboundPickups
      : inboundPickupOrder(
          outboundPickups
            .map((outbound) =>
              inboundPickups.find((inbound) =>
                this.samePickupStop(outbound, inbound),
              ),
            )
            .filter((stop): stop is (typeof inboundPickups)[number] =>
              Boolean(stop),
            )
            .concat(
              inboundPickups.filter(
                (inbound) =>
                  !outboundPickups.some((outbound) =>
                    this.samePickupStop(outbound, inbound),
                  ),
              ),
            ),
        );

    await this.writeSequences(
      tx,
      TripDirection.OUTBOUND,
      outboundPickups,
      stops.find(
        (stop) =>
          stop.direction === TripDirection.OUTBOUND &&
          stop.stopType === StopType.INSTITUTION,
      )?.id,
    );
    await this.writeSequences(
      tx,
      TripDirection.INBOUND,
      inboundOrdered,
      stops.find(
        (stop) =>
          stop.direction === TripDirection.INBOUND &&
          stop.stopType === StopType.INSTITUTION,
      )?.id,
    );
  }

  private samePickupStop(
    left: {
      stopType: StopType;
      meetingPointId: string | null;
      students: Array<{ studentId: string }>;
    },
    right: {
      stopType: StopType;
      meetingPointId: string | null;
      students: Array<{ studentId: string }>;
    },
  ): boolean {
    if (left.stopType !== right.stopType) {
      return false;
    }
    if (left.stopType === StopType.MEETING_POINT) {
      return left.meetingPointId === right.meetingPointId;
    }
    if (left.stopType === StopType.STUDENT_HOME) {
      return left.students.some((link) =>
        right.students.some((other) => other.studentId === link.studentId),
      );
    }
    return false;
  }

  private async nextStopSequence(
    tx: Prisma.TransactionClient,
    routeId: string,
    direction: TripDirection,
  ): Promise<number> {
    const max = await tx.routeStop.aggregate({
      where: { routeId, direction },
      _max: { sequence: true },
    });
    return (max._max.sequence ?? 0) + 1;
  }

  private async writeSequences(
    tx: Prisma.TransactionClient,
    direction: TripDirection,
    pickups: Array<{ id: string }>,
    institutionId?: string,
  ) {
    const ordered: Array<{ id: string; sequence: number }> = [];
    if (direction === TripDirection.INBOUND && institutionId) {
      ordered.push({ id: institutionId, sequence: 1 });
      pickups.forEach((stop, index) => {
        ordered.push({ id: stop.id, sequence: index + 2 });
      });
    } else {
      pickups.forEach((stop, index) => {
        ordered.push({ id: stop.id, sequence: index + 1 });
      });
      if (institutionId) {
        ordered.push({
          id: institutionId,
          sequence: pickups.length + 1,
        });
      }
    }
    for (const item of ordered) {
      await tx.routeStop.update({
        where: { id: item.id },
        data: { sequence: item.sequence + 1000 },
      });
    }
    for (const item of ordered) {
      await tx.routeStop.update({
        where: { id: item.id },
        data: { sequence: item.sequence },
      });
    }
  }

  private buildDirectedStops<T extends { stopType: StopType }>(
    direction: TripDirection,
    pickups: T[],
    institutionStop?: T,
  ): T[] {
    if (!institutionStop) {
      return pickups;
    }
    return direction === TripDirection.INBOUND
      ? [institutionStop, ...pickups]
      : [...pickups, institutionStop];
  }

  private assertInstitutionAnchor(
    direction: TripDirection,
    ordered: Array<{ stopType: StopType }>,
  ) {
    const index = ordered.findIndex(
      (stop) => stop.stopType === StopType.INSTITUTION,
    );
    if (index < 0) {
      return;
    }
    const valid =
      direction === TripDirection.OUTBOUND
        ? index === ordered.length - 1
        : index === 0;
    if (!valid) {
      throw new AppException(
        'INSTITUTION_STOP_FIXED',
        'Institution stop must stay last on OUTBOUND and first on INBOUND',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Home-stop labels hold the student name; the street address lives on the pickup config. */
  private async homeStopAddresses(stopIds: string[]) {
    const links = await this.prisma.routeStopStudent.findMany({
      where: {
        routeStopId: { in: stopIds },
        routeStop: { stopType: StopType.STUDENT_HOME },
      },
      select: {
        routeStopId: true,
        student: {
          select: { pickupConfig: { select: { addressLabel: true } } },
        },
      },
    });
    const addresses = new Map<string, string>();
    for (const link of links) {
      const address = link.student.pickupConfig?.addressLabel;
      if (address) {
        addresses.set(link.routeStopId, address);
      }
    }
    return addresses;
  }

  private async measurePath(
    start: { lat: number; lng: number },
    stops: Array<{
      id: string;
      latitude: number;
      longitude: number;
      label: string | null;
      stopType: StopType;
    }>,
  ) {
    const points = [
      start,
      ...stops.map((stop) => ({ lat: stop.latitude, lng: stop.longitude })),
    ];
    const legs = await this.routing.getPathLegs(points);
    let duration = 0;
    let distance = 0;
    const mapped = stops.map((stop, index) => {
      const leg = legs[index];
      duration += leg?.durationSeconds ?? 0;
      distance += leg?.distanceMeters ?? 0;
      return {
        stopId: stop.id,
        sequence: index + 1,
        stopType: stop.stopType,
        label: stop.label,
        latitude: stop.latitude,
        longitude: stop.longitude,
        etaOffsetMinutes: Math.round(duration / 60),
      };
    });
    return {
      stops: mapped,
      totalDistanceMeters: distance,
      totalDurationSeconds: duration,
    };
  }

  private async applyAssignmentToFutureTrips(
    institutionId: string,
    routeId: string,
    assignment: {
      driverId?: string | null;
      vehicleId?: string | null;
      attendantId?: string | null;
    },
    tx: Prisma.TransactionClient,
  ) {
    const settings = await tx.institutionSettings.findUnique({
      where: { institutionId },
    });
    const today = todayInTimezone(settings?.timezone ?? 'Asia/Damascus');
    await tx.shuttleTrip.updateMany({
      where: {
        routeId,
        status: TripStatus.SCHEDULED,
        serviceDate: { gt: today },
      },
      data: {
        driverId:
          assignment.driverId === undefined ? undefined : assignment.driverId,
        vehicleId:
          assignment.vehicleId === undefined ? undefined : assignment.vehicleId,
        attendantId:
          assignment.attendantId === undefined
            ? undefined
            : assignment.attendantId,
      },
    });
  }

  private async findOwned(institutionId: string, id: string) {
    const route = await this.prisma.shuttleRoute.findFirst({
      where: { id, institutionId, archivedAt: null },
      include: routeDetailInclude,
    });
    if (!route) {
      throw new AppException(
        'ROUTE_NOT_FOUND',
        'Route not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return route;
  }

  private async requireSchedule(routeId: string, scheduleId: string) {
    const schedule = await this.prisma.routeSchedule.findFirst({
      where: { id: scheduleId, routeId },
    });
    if (!schedule) {
      throw new AppException(
        'SCHEDULE_NOT_FOUND',
        'Schedule not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return schedule;
  }

  private async requireStop(routeId: string, stopId: string) {
    const stop = await this.prisma.routeStop.findFirst({
      where: { id: stopId, routeId },
      include: stopInclude,
    });
    if (!stop) {
      throw new AppException(
        'STOP_NOT_FOUND',
        'Stop not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return stop;
  }

  private async requireInstitution(institutionId: string) {
    const institution = await this.prisma.institution.findFirst({
      where: { id: institutionId, archivedAt: null },
      select: { id: true, type: true, operationModel: true },
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

  private async requireAssignableDriver(
    institutionId: string,
    operationModel: OperationModel,
    driverId: string,
  ) {
    const driver = await this.prisma.driverProfile.findFirst({
      where: { id: driverId, archivedAt: null, status: ResourceStatus.ACTIVE },
    });
    if (!driver) {
      throw new AppException(
        'DRIVER_NOT_FOUND',
        'Driver not found',
        HttpStatus.NOT_FOUND,
      );
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
    return driver;
  }

  private async requireAssignableVehicle(
    institutionId: string,
    operationModel: OperationModel,
    vehicleId: string,
  ) {
    const vehicle = await this.prisma.shuttleVehicle.findFirst({
      where: { id: vehicleId, archivedAt: null, status: VehicleStatus.ACTIVE },
    });
    if (!vehicle) {
      throw new AppException(
        'VEHICLE_NOT_FOUND',
        'Vehicle not found',
        HttpStatus.NOT_FOUND,
      );
    }
    const own =
      vehicle.ownerType === OwnerType.INSTITUTION &&
      vehicle.institutionId === institutionId;
    const beroya =
      (vehicle.ownerType === OwnerType.BEROYA ||
        vehicle.ownerType === OwnerType.DRIVER) &&
      canSeeBeroyaResources(operationModel) &&
      (vehicle.institutionId === null || vehicle.institutionId === institutionId);
    if (!own && !beroya) {
      throw new AppException(
        'VEHICLE_NOT_AVAILABLE',
        'This vehicle cannot be assigned to the institution',
        HttpStatus.FORBIDDEN,
      );
    }
    return vehicle;
  }

  private async requireAssignableAttendant(
    institutionId: string,
    attendantId: string,
    routeId: string,
  ) {
    const attendant = await this.prisma.attendantProfile.findFirst({
      where: {
        id: attendantId,
        institutionId,
        archivedAt: null,
        status: ResourceStatus.ACTIVE,
      },
      include: { defaultForRoute: true },
    });
    if (!attendant) {
      throw new AppException(
        'ATTENDANT_NOT_FOUND',
        'Attendant not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (attendant.defaultForRoute && attendant.defaultForRoute.id !== routeId) {
      throw new AppException(
        'ATTENDANT_ALREADY_ASSIGNED',
        'This attendant is already assigned to another route',
        HttpStatus.CONFLICT,
      );
    }
    return attendant;
  }

  private async assertNameFree(
    institutionId: string,
    name: string,
    exceptId?: string,
  ) {
    const clash = await this.prisma.shuttleRoute.findFirst({
      where: {
        institutionId,
        name,
        archivedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (clash) {
      throw new AppException(
        'ROUTE_NAME_IN_USE',
        'A route with this name already exists',
        HttpStatus.CONFLICT,
      );
    }
  }

  private throwIfAttendantTaken(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppException(
        'ATTENDANT_ALREADY_ASSIGNED',
        'This attendant is already assigned to another route',
        HttpStatus.CONFLICT,
      );
    }
  }

  private throwIfScheduleClash(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppException(
        'SCHEDULE_TIME_IN_USE',
        'This direction already has a schedule at that time',
        HttpStatus.CONFLICT,
      );
    }
  }
}
