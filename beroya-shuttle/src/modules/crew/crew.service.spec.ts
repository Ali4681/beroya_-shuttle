jest.mock('../../infra/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../trips/trip-event.service', () => ({
  TripEventService: class TripEventService {},
}));
jest.mock('../tracking/live-location.store', () => ({
  LiveLocationStore: class LiveLocationStore {},
}));
jest.mock('../realtime/realtime.service', () => ({
  RealtimeService: class RealtimeService {},
}));
jest.mock('../shared/notifications/notification.service', () => ({
  NotificationService: class NotificationService {},
}));
jest.mock('../shared/audit/audit.service', () => ({
  AuditService: class AuditService {},
}));
jest.mock('../admin/platform-settings.service', () => ({
  PlatformSettingsService: class PlatformSettingsService {},
}));

import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  TripStatus,
  TripStopStatus,
  TripStudentStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PlatformSettingsService } from '../admin/platform-settings.service';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { AuditService } from '../shared/audit/audit.service';
import { NotificationService } from '../shared/notifications/notification.service';
import { LiveLocationStore } from '../tracking/live-location.store';
import { TripEventService } from '../trips/trip-event.service';
import { CrewService } from './crew.service';
import { DriverTripHistoryQueryDto } from './dto/driver-trip-history.query';

function makeCrewService(
  prisma: unknown,
  extras: {
    events?: unknown;
    live?: unknown;
    realtime?: unknown;
    notifications?: unknown;
    platform?: unknown;
    audit?: unknown;
  } = {},
) {
  return new CrewService(
    prisma as PrismaService,
    (extras.events ?? {}) as TripEventService,
    (extras.live ?? {
      readLocation: jest.fn().mockResolvedValue(null),
    }) as LiveLocationStore,
    (extras.realtime ?? {}) as RealtimeService,
    (extras.notifications ?? {}) as NotificationService,
    (extras.platform ?? {
      read: jest.fn(),
      trackingFor: jest.fn(),
      clientOps: jest.fn(),
      gpsStaleAfterSeconds: jest.fn().mockResolvedValue(180),
    }) as PlatformSettingsService,
    (extras.audit ?? { record: jest.fn() }) as AuditService,
  );
}

describe('CrewService arrive', () => {
  const prisma = {
    driverProfile: { findFirst: jest.fn() },
    shuttleTrip: { findUnique: jest.fn() },
    tripStop: { findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const events = { record: jest.fn() };
  const realtime = { emitTrip: jest.fn() };
  const service = makeCrewService(prisma, { events, realtime });

  const arrivedAt = new Date('2026-10-05T08:15:00.000Z');
  const pendingStop = {
    id: 'stop-1',
    tripId: 'trip-1',
    sequence: 2,
    label: 'مدرسة الأمل',
    status: TripStopStatus.PENDING,
    arrivedAt: null,
  };
  const arrivedStop = {
    ...pendingStop,
    status: TripStopStatus.ARRIVED,
    arrivedAt,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.driverProfile.findFirst.mockResolvedValue({
      id: 'driver-1',
      userId: 'u-driver',
      user: { id: 'u-driver', institutionId: 'inst-1' },
    });
    prisma.shuttleTrip.findUnique.mockResolvedValue({
      id: 'trip-1',
      institutionId: 'inst-1',
      routeId: 'route-1',
      driverId: 'driver-1',
      status: TripStatus.IN_PROGRESS,
      institution: { operationModel: 'INSTITUTION_OPERATED' },
    });
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    events.record.mockResolvedValue(undefined);
  });

  it('emits trip.stop.arrived after the first successful arrive', async () => {
    prisma.tripStop.findFirst.mockResolvedValue(pendingStop);
    prisma.tripStop.update.mockResolvedValue(arrivedStop);

    const result = await service.arrive('u-driver', 'trip-1', 'stop-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'stop-1',
        status: TripStopStatus.ARRIVED,
        arrivedAt,
      }),
    );
    expect(realtime.emitTrip).toHaveBeenCalledWith(
      REALTIME_EVENTS.TRIP_STOP_ARRIVED,
      {
        institutionId: 'inst-1',
        tripId: 'trip-1',
        routeId: 'route-1',
        operationModel: 'INSTITUTION_OPERATED',
      },
      {
        stop_id: 'stop-1',
        status: TripStopStatus.ARRIVED,
        arrived_at: arrivedAt,
      },
    );
  });

  it('does not emit when the stop is already arrived', async () => {
    prisma.tripStop.findFirst.mockResolvedValue(arrivedStop);

    const result = await service.arrive('u-driver', 'trip-1', 'stop-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'stop-1',
        status: TripStopStatus.ARRIVED,
        arrivedAt,
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(realtime.emitTrip).not.toHaveBeenCalled();
  });
});

describe('CrewService attendantHistory', () => {
  const prisma = {
    attendantProfile: { findFirst: jest.fn() },
    driverProfile: { findFirst: jest.fn() },
    shuttleTrip: { count: jest.fn(), findMany: jest.fn() },
    tripStudent: { groupBy: jest.fn() },
  };
  const service = makeCrewService(prisma);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.tripStudent.groupBy.mockResolvedValue([]);
  });

  it('filters trips by attendantId with status and pagination', async () => {
    prisma.attendantProfile.findFirst.mockResolvedValue({
      id: 'att-1',
      userId: 'u-att',
      institutionId: 'inst-1',
      user: { id: 'u-att', institutionId: 'inst-1' },
    });
    prisma.shuttleTrip.count.mockResolvedValue(1);
    prisma.shuttleTrip.findMany.mockResolvedValue([
      {
        id: 'trip-1',
        institutionId: 'inst-1',
        branchId: 'b1',
        routeId: 'r1',
        scheduleId: null,
        direction: 'OUTBOUND',
        status: TripStatus.COMPLETED,
        serviceDate: new Date('2026-10-03T00:00:00.000Z'),
        scheduledDepartureTime: '07:00',
        originLabel: null,
        originLat: 0,
        originLng: 0,
        driverId: 'd1',
        vehicleId: null,
        attendantId: 'att-1',
        attendantBoarded: false,
        attendantBoardedAt: null,
        attendantBoardedByUserId: null,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelReason: null,
        distanceKm: null,
        delayThresholdMinutes: 10,
        delayMinutes: 0,
        delayDetectedAt: null,
        delayAlertSentAt: null,
        lastLocationLat: null,
        lastLocationLng: null,
        lastLocationAt: null,
        etaToNextStopAt: null,
        etaToFinishAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        route: { id: 'r1', name: 'خط الحمدانية', status: 'ACTIVE', code: 'H1' },
        branch: null,
        driver: {
          id: 'd1',
          user: { id: 'u-d', fullName: 'محمد علي' },
        },
        vehicle: null,
        attendant: null,
        institution: { operationModel: 'INSTITUTION_OPERATED' },
        incidents: [{ id: 'em-1' }],
        _count: { stops: 4, students: 14 },
      },
    ]);

    const query = {
      from: '2026-10-01',
      to: '2026-10-05',
      status: [TripStatus.COMPLETED],
      page: 1,
      limit: 20,
    } as DriverTripHistoryQueryDto;

    const result = await service.attendantHistory('u-att', query);

    expect(prisma.shuttleTrip.count).toHaveBeenCalledWith({
      where: {
        attendantId: 'att-1',
        serviceDate: {
          gte: new Date('2026-10-01T00:00:00.000Z'),
          lte: new Date('2026-10-05T00:00:00.000Z'),
        },
        status: { in: [TripStatus.COMPLETED] },
      },
    });
    expect(prisma.shuttleTrip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ attendantId: 'att-1' }),
        skip: 0,
        take: 20,
        orderBy: [
          { serviceDate: 'desc' },
          { scheduledDepartureTime: 'desc' },
        ],
      }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'trip-1',
        hasEmergency: true,
        studentCount: 14,
        driver: { id: 'd1', name: 'محمد علي' },
      }),
    );
    expect(result.meta).toEqual(
      expect.objectContaining({ page: 1, limit: 20, total: 1 }),
    );
  });

  it('rejects a user without an attendant profile', async () => {
    prisma.attendantProfile.findFirst.mockResolvedValue(null);
    try {
      await service.attendantHistory('driver-user', {
        from: '2026-10-01',
        to: '2026-10-05',
        page: 1,
        limit: 20,
      } as DriverTripHistoryQueryDto);
      fail('expected ATTENDANT_NOT_FOUND');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });
});

describe('CrewService setAttendantBoarded', () => {
  const prisma = {
    driverProfile: { findFirst: jest.fn() },
    shuttleTrip: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const events = { record: jest.fn() };
  const realtime = { emitTrip: jest.fn() };
  const audit = { record: jest.fn() };
  const service = makeCrewService(prisma, { events, realtime, audit });

  const boardedAt = new Date('2026-10-10T08:15:00.000Z');
  const baseTrip = {
    id: 'trip-1',
    institutionId: 'inst-1',
    routeId: 'route-1',
    driverId: 'driver-1',
    attendantId: 'att-1',
    status: TripStatus.SCHEDULED,
    attendantBoarded: false,
    attendantBoardedAt: null,
    attendantBoardedByUserId: null,
    institution: { operationModel: 'INSTITUTION_OPERATED' },
    attendant: {
      id: 'att-1',
      userId: 'u-att',
      user: { id: 'u-att', fullName: 'لينا داوود' },
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.driverProfile.findFirst.mockResolvedValue({
      id: 'driver-1',
      userId: 'u-driver',
      user: { id: 'u-driver', institutionId: 'inst-1' },
    });
    prisma.shuttleTrip.findUnique.mockResolvedValue(baseTrip);
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    events.record.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
  });

  it('confirms boarding, audits, and emits realtime', async () => {
    const updated = {
      ...baseTrip,
      attendantBoarded: true,
      attendantBoardedAt: boardedAt,
      attendantBoardedByUserId: 'u-driver',
    };
    prisma.shuttleTrip.update.mockResolvedValue(updated);

    const result = await service.setAttendantBoarded('u-driver', 'trip-1', {
      boarded: true,
    });

    expect(result).toEqual({
      id: 'trip-1',
      attendantBoarded: true,
      attendantBoardedAt: boardedAt,
      attendant: { id: 'att-1', name: 'لينا داوود' },
    });
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ATTENDANT_BOARDED' }),
      prisma,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'trip.attendant_boarded' }),
      prisma,
    );
    expect(realtime.emitTrip).toHaveBeenCalledWith(
      REALTIME_EVENTS.TRIP_ATTENDANT_BOARDED,
      expect.objectContaining({ tripId: 'trip-1' }),
      expect.objectContaining({ attendant_boarded: true }),
    );
  });

  it('is idempotent when already boarded', async () => {
    prisma.shuttleTrip.findUnique.mockResolvedValue({
      ...baseTrip,
      attendantBoarded: true,
      attendantBoardedAt: boardedAt,
      attendantBoardedByUserId: 'u-driver',
    });

    const result = await service.setAttendantBoarded('u-driver', 'trip-1', {});

    expect(result.attendantBoarded).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(realtime.emitTrip).not.toHaveBeenCalled();
  });

  it('rejects when no attendant is assigned', async () => {
    prisma.shuttleTrip.findUnique.mockResolvedValue({
      ...baseTrip,
      attendantId: null,
      attendant: null,
    });

    await expect(
      service.setAttendantBoarded('u-driver', 'trip-1', { boarded: true }),
    ).rejects.toMatchObject({
      response: { code: 'ATTENDANT_NOT_ASSIGNED' },
    });
  });
});

describe('CrewService markStudent parent notify', () => {
  const prisma = {
    attendantProfile: { findFirst: jest.fn() },
    shuttleTrip: { findUnique: jest.fn() },
    tripStudent: {
      findFirst: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const events = { record: jest.fn() };
  const realtime = { emitTrip: jest.fn() };
  const notifications = { notifyGuardian: jest.fn() };
  const service = makeCrewService(prisma, { events, realtime, notifications });

  const pendingRow = {
    id: 'ts-1',
    tripId: 'trip-1',
    studentId: 'stu-1',
    tripStopId: 'stop-1',
    status: TripStudentStatus.PENDING,
    boardedAt: null,
    notBoardedAt: null,
    droppedOffAt: null,
    student: {
      id: 'stu-1',
      fullName: 'عمر خالد',
      grade: 'الصف الرابع',
      section: 'أ',
      guardianUserId: 'parent-1',
    },
    tripStop: {
      id: 'stop-1',
      sequence: 1,
      label: 'محطة',
      stopType: 'MEETING_POINT',
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.attendantProfile.findFirst.mockResolvedValue({
      id: 'att-1',
      userId: 'u-att',
      user: { id: 'u-att', institutionId: 'inst-1' },
    });
    prisma.shuttleTrip.findUnique.mockResolvedValue({
      id: 'trip-1',
      institutionId: 'inst-1',
      branchId: 'b1',
      routeId: 'route-1',
      attendantId: 'att-1',
      status: TripStatus.IN_PROGRESS,
      institution: { operationModel: 'INSTITUTION_OPERATED' },
    });
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    prisma.tripStudent.groupBy.mockResolvedValue([
      {
        tripId: 'trip-1',
        status: TripStudentStatus.BOARDED,
        _count: { _all: 6 },
      },
      {
        tripId: 'trip-1',
        status: TripStudentStatus.PENDING,
        _count: { _all: 4 },
      },
    ]);
    events.record.mockResolvedValue(undefined);
    notifications.notifyGuardian.mockResolvedValue({ id: 'n1' });
  });

  it('notifies the guardian on board with STUDENT_BOARDED', async () => {
    prisma.tripStudent.findFirst.mockResolvedValue(pendingRow);
    prisma.tripStudent.update.mockResolvedValue({
      ...pendingRow,
      status: TripStudentStatus.BOARDED,
      boardedAt: new Date(),
    });

    await service.markStudent(
      'u-att',
      'trip-1',
      'ts-1',
      TripStudentStatus.BOARDED,
    );

    expect(notifications.notifyGuardian).toHaveBeenCalledWith(
      expect.objectContaining({
        guardianUserId: 'parent-1',
        title: 'صعد الطالب',
        data: expect.objectContaining({
          type: 'STUDENT_BOARDED',
          source: 'ATTENDANT',
          studentId: 'stu-1',
        }),
      }),
    );
    expect(realtime.emitTrip).toHaveBeenCalledWith(
      REALTIME_EVENTS.TRIP_STUDENT_STATUS_CHANGED,
      expect.any(Object),
      expect.objectContaining({
        status: TripStudentStatus.BOARDED,
        source: 'ATTENDANT',
        trip_stop_id: 'stop-1',
        student_counts: expect.objectContaining({
          pending: 4,
          boarded: 6,
          not_boarded: 0,
        }),
      }),
    );
  });

  it('allows NOT_BOARDED → BOARDED and notifies STUDENT_BOARDED', async () => {
    const notBoarded = {
      ...pendingRow,
      status: TripStudentStatus.NOT_BOARDED,
      notBoardedAt: new Date('2026-10-10T08:00:00.000Z'),
    };
    prisma.tripStudent.findFirst.mockResolvedValue(notBoarded);
    prisma.tripStudent.update.mockResolvedValue({
      ...notBoarded,
      status: TripStudentStatus.BOARDED,
      boardedAt: new Date(),
    });

    await service.markStudent(
      'u-att',
      'trip-1',
      'ts-1',
      TripStudentStatus.BOARDED,
    );

    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STUDENT_BOARDED',
        data: expect.objectContaining({
          status: TripStudentStatus.BOARDED,
          source: 'ATTENDANT',
        }),
      }),
      prisma,
    );
    expect(notifications.notifyGuardian).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'STUDENT_BOARDED' }),
      }),
    );
  });

  it('skips guardian notify on idempotent re-mark', async () => {
    prisma.tripStudent.findFirst.mockResolvedValue({
      ...pendingRow,
      status: TripStudentStatus.BOARDED,
    });

    await service.markStudent(
      'u-att',
      'trip-1',
      'ts-1',
      TripStudentStatus.BOARDED,
    );

    expect(notifications.notifyGuardian).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
