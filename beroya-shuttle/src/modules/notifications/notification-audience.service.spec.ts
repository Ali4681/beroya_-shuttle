jest.mock('../../infra/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { NotificationAudience } from '../../generated/prisma/client';
import { NotificationAudienceService } from './notification-audience.service';

describe('NotificationAudienceService', () => {
  const prisma = {
    studentRouteAssignment: { findMany: jest.fn() },
    schoolStudent: { findMany: jest.fn() },
    universityStudentProfile: { findMany: jest.fn() },
    shuttleRoute: { findFirst: jest.fn(), findMany: jest.fn() },
    shuttleTrip: { findMany: jest.fn() },
    driverProfile: { findMany: jest.fn() },
    attendantProfile: { findMany: jest.fn() },
  };
  const service = new NotificationAudienceService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects a route audience without route_id', async () => {
    try {
      await service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ROUTE_PARENTS,
      });
      fail('expected ROUTE_REQUIRED');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it('dedupes parent ids for ALL_PARENTS', async () => {
    prisma.schoolStudent.findMany.mockResolvedValue([
      { guardianUserId: 'p1' },
      { guardianUserId: 'p1' },
      { guardianUserId: 'p2' },
    ]);
    await expect(
      service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ALL_PARENTS,
      }),
    ).resolves.toEqual(['p1', 'p2']);
  });

  it('resolves ROUTE_PARENTS from active assignments', async () => {
    prisma.shuttleRoute.findFirst.mockResolvedValue({
      id: 'r1',
      branchId: 'b1',
    });
    prisma.studentRouteAssignment.findMany.mockResolvedValue([
      { student: { guardianUserId: 'p9' } },
    ]);
    await expect(
      service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ROUTE_PARENTS,
        routeId: 'r1',
      }),
    ).resolves.toEqual(['p9']);
  });

  it('uses the route branch for university students', async () => {
    prisma.shuttleRoute.findFirst.mockResolvedValue({
      id: 'r1',
      branchId: 'b1',
    });
    prisma.universityStudentProfile.findMany.mockResolvedValue([
      { userId: 'u1' },
    ]);
    await expect(
      service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ROUTE_UNIVERSITY_STUDENTS,
        routeId: 'r1',
      }),
    ).resolves.toEqual(['u1']);
    expect(prisma.universityStudentProfile.findMany).toHaveBeenCalled();
  });

  it('resolves all university students without a route', async () => {
    prisma.universityStudentProfile.findMany.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u1' },
    ]);
    await expect(
      service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ALL_UNIVERSITY_STUDENTS,
      }),
    ).resolves.toEqual(['u1']);
  });

  it('rejects a missing route', async () => {
    prisma.shuttleRoute.findFirst.mockResolvedValue(null);
    try {
      await service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ROUTE_PARENTS,
        routeId: 'missing',
      });
      fail('expected ROUTE_NOT_FOUND');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it('resolves ALL_DRIVERS from owned and route-default drivers', async () => {
    prisma.driverProfile.findMany.mockResolvedValue([
      { userId: 'd1' },
      { userId: 'd1' },
    ]);
    prisma.shuttleRoute.findMany.mockResolvedValue([
      { defaultDriver: { userId: 'd2' } },
      { defaultDriver: { userId: 'd1' } },
    ]);
    await expect(
      service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ALL_DRIVERS,
      }),
    ).resolves.toEqual(['d1', 'd2']);
  });

  it('resolves ROUTE_DRIVERS from default and trip drivers', async () => {
    prisma.shuttleRoute.findFirst
      .mockResolvedValueOnce({ id: 'r1', branchId: 'b1' })
      .mockResolvedValueOnce({
        defaultDriver: {
          userId: 'd1',
          archivedAt: null,
          status: 'ACTIVE',
          user: { archivedAt: null, status: 'ACTIVE' },
        },
      });
    prisma.shuttleTrip.findMany.mockResolvedValue([
      { driver: { userId: 'd2' } },
      { driver: { userId: 'd1' } },
    ]);
    await expect(
      service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ROUTE_DRIVERS,
        routeId: 'r1',
      }),
    ).resolves.toEqual(['d1', 'd2']);
  });

  it('rejects ROUTE_DRIVERS without route_id', async () => {
    try {
      await service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ROUTE_DRIVERS,
      });
      fail('expected ROUTE_REQUIRED');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it('resolves ALL_ATTENDANTS from owned and route-default attendants', async () => {
    prisma.attendantProfile.findMany.mockResolvedValue([
      { userId: 'a1' },
      { userId: 'a1' },
    ]);
    prisma.shuttleRoute.findMany.mockResolvedValue([
      { defaultAttendant: { userId: 'a2' } },
      { defaultAttendant: { userId: 'a1' } },
    ]);
    await expect(
      service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ALL_ATTENDANTS,
      }),
    ).resolves.toEqual(['a1', 'a2']);
  });

  it('resolves ROUTE_ATTENDANTS from default and trip attendants', async () => {
    prisma.shuttleRoute.findFirst
      .mockResolvedValueOnce({ id: 'r1', branchId: 'b1' })
      .mockResolvedValueOnce({
        defaultAttendant: {
          userId: 'a1',
          archivedAt: null,
          status: 'ACTIVE',
          user: { archivedAt: null, status: 'ACTIVE' },
        },
      });
    prisma.shuttleTrip.findMany.mockResolvedValue([
      { attendant: { userId: 'a2' } },
      { attendant: { userId: 'a1' } },
    ]);
    await expect(
      service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ROUTE_ATTENDANTS,
        routeId: 'r1',
      }),
    ).resolves.toEqual(['a1', 'a2']);
  });

  it('rejects ROUTE_ATTENDANTS without route_id', async () => {
    try {
      await service.resolve({
        institutionId: 'inst',
        audience: NotificationAudience.ROUTE_ATTENDANTS,
      });
      fail('expected ROUTE_REQUIRED');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});
