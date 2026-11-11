import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  NotificationAudience,
  ResourceStatus,
  StudentStatus,
  UserStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  routeAudienceRequiresRoute,
  uniqueIds,
} from './notification-audience.rules';

@Injectable()
export class NotificationAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(input: {
    institutionId: string;
    audience: NotificationAudience;
    routeId?: string;
  }): Promise<string[]> {
    if (routeAudienceRequiresRoute(input.audience) && !input.routeId) {
      throw new AppException(
        'ROUTE_REQUIRED',
        'route_id is required for this audience',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      input.audience === NotificationAudience.ALL_PARENTS ||
      input.audience === NotificationAudience.ROUTE_PARENTS
    ) {
      return this.parentIds(input.institutionId, input.routeId);
    }
    if (
      input.audience === NotificationAudience.ALL_UNIVERSITY_STUDENTS ||
      input.audience === NotificationAudience.ROUTE_UNIVERSITY_STUDENTS
    ) {
      return this.universityStudentIds(input.institutionId, input.routeId);
    }
    if (
      input.audience === NotificationAudience.ALL_DRIVERS ||
      input.audience === NotificationAudience.ROUTE_DRIVERS
    ) {
      return this.driverIds(input.institutionId, input.routeId);
    }
    return this.attendantIds(input.institutionId, input.routeId);
  }

  private async parentIds(
    institutionId: string,
    routeId?: string,
  ): Promise<string[]> {
    if (routeId) {
      await this.requireRoute(institutionId, routeId);
      const rows = await this.prisma.studentRouteAssignment.findMany({
        where: {
          routeId,
          isActive: true,
          student: {
            institutionId,
            archivedAt: null,
            status: StudentStatus.ACTIVE,
            guardianUser: {
              archivedAt: null,
              status: UserStatus.ACTIVE,
            },
          },
        },
        select: { student: { select: { guardianUserId: true } } },
      });
      return uniqueIds(rows.map((row) => row.student.guardianUserId));
    }

    const rows = await this.prisma.schoolStudent.findMany({
      where: {
        institutionId,
        archivedAt: null,
        status: StudentStatus.ACTIVE,
        guardianUser: { archivedAt: null, status: UserStatus.ACTIVE },
      },
      select: { guardianUserId: true },
    });
    return uniqueIds(rows.map((row) => row.guardianUserId));
  }

  private async universityStudentIds(
    institutionId: string,
    routeId?: string,
  ): Promise<string[]> {
    let branchId: string | undefined;
    if (routeId) {
      const route = await this.requireRoute(institutionId, routeId);
      branchId = route.branchId;
    }
    const rows = await this.prisma.universityStudentProfile.findMany({
      where: {
        institutionId,
        archivedAt: null,
        status: StudentStatus.ACTIVE,
        ...(branchId ? { branchId } : {}),
        user: { archivedAt: null, status: UserStatus.ACTIVE },
      },
      select: { userId: true },
    });
    return uniqueIds(rows.map((row) => row.userId));
  }

  private async driverIds(
    institutionId: string,
    routeId?: string,
  ): Promise<string[]> {
    if (routeId) {
      await this.requireRoute(institutionId, routeId);
      const route = await this.prisma.shuttleRoute.findFirst({
        where: { id: routeId, institutionId, archivedAt: null },
        select: {
          defaultDriver: {
            select: {
              userId: true,
              archivedAt: true,
              status: true,
              user: { select: { archivedAt: true, status: true } },
            },
          },
        },
      });
      const tripDrivers = await this.prisma.shuttleTrip.findMany({
        where: {
          routeId,
          institutionId,
          driverId: { not: null },
          driver: {
            archivedAt: null,
            status: ResourceStatus.ACTIVE,
            user: { archivedAt: null, status: UserStatus.ACTIVE },
          },
        },
        select: { driver: { select: { userId: true } } },
        distinct: ['driverId'],
      });
      const fromDefault = this.activeDriverUserId(route?.defaultDriver);
      return uniqueIds([
        ...(fromDefault ? [fromDefault] : []),
        ...tripDrivers.map((row) => row.driver!.userId),
      ]);
    }

    const owned = await this.prisma.driverProfile.findMany({
      where: {
        institutionId,
        archivedAt: null,
        status: ResourceStatus.ACTIVE,
        user: { archivedAt: null, status: UserStatus.ACTIVE },
      },
      select: { userId: true },
    });
    const routeDefaults = await this.prisma.shuttleRoute.findMany({
      where: {
        institutionId,
        archivedAt: null,
        defaultDriverId: { not: null },
        defaultDriver: {
          archivedAt: null,
          status: ResourceStatus.ACTIVE,
          user: { archivedAt: null, status: UserStatus.ACTIVE },
        },
      },
      select: { defaultDriver: { select: { userId: true } } },
    });
    return uniqueIds([
      ...owned.map((row) => row.userId),
      ...routeDefaults.map((row) => row.defaultDriver!.userId),
    ]);
  }

  private async attendantIds(
    institutionId: string,
    routeId?: string,
  ): Promise<string[]> {
    if (routeId) {
      await this.requireRoute(institutionId, routeId);
      const route = await this.prisma.shuttleRoute.findFirst({
        where: { id: routeId, institutionId, archivedAt: null },
        select: {
          defaultAttendant: {
            select: {
              userId: true,
              archivedAt: true,
              status: true,
              user: { select: { archivedAt: true, status: true } },
            },
          },
        },
      });
      const tripAttendants = await this.prisma.shuttleTrip.findMany({
        where: {
          routeId,
          institutionId,
          attendantId: { not: null },
          attendant: {
            archivedAt: null,
            status: ResourceStatus.ACTIVE,
            user: { archivedAt: null, status: UserStatus.ACTIVE },
          },
        },
        select: { attendant: { select: { userId: true } } },
        distinct: ['attendantId'],
      });
      const fromDefault = this.activeCrewUserId(route?.defaultAttendant);
      return uniqueIds([
        ...(fromDefault ? [fromDefault] : []),
        ...tripAttendants.map((row) => row.attendant!.userId),
      ]);
    }

    const owned = await this.prisma.attendantProfile.findMany({
      where: {
        institutionId,
        archivedAt: null,
        status: ResourceStatus.ACTIVE,
        user: { archivedAt: null, status: UserStatus.ACTIVE },
      },
      select: { userId: true },
    });
    const routeDefaults = await this.prisma.shuttleRoute.findMany({
      where: {
        institutionId,
        archivedAt: null,
        defaultAttendantId: { not: null },
        defaultAttendant: {
          archivedAt: null,
          status: ResourceStatus.ACTIVE,
          user: { archivedAt: null, status: UserStatus.ACTIVE },
        },
      },
      select: { defaultAttendant: { select: { userId: true } } },
    });
    return uniqueIds([
      ...owned.map((row) => row.userId),
      ...routeDefaults.map((row) => row.defaultAttendant!.userId),
    ]);
  }

  private activeDriverUserId(
    driver:
      | {
          userId: string;
          archivedAt: Date | null;
          status: ResourceStatus;
          user: { archivedAt: Date | null; status: UserStatus };
        }
      | null
      | undefined,
  ): string | null {
    return this.activeCrewUserId(driver);
  }

  private activeCrewUserId(
    profile:
      | {
          userId: string;
          archivedAt: Date | null;
          status: ResourceStatus;
          user: { archivedAt: Date | null; status: UserStatus };
        }
      | null
      | undefined,
  ): string | null {
    if (
      !profile ||
      profile.archivedAt ||
      profile.status !== ResourceStatus.ACTIVE
    ) {
      return null;
    }
    if (
      profile.user.archivedAt ||
      profile.user.status !== UserStatus.ACTIVE
    ) {
      return null;
    }
    return profile.userId;
  }

  private async requireRoute(institutionId: string, routeId: string) {
    const route = await this.prisma.shuttleRoute.findFirst({
      where: { id: routeId, institutionId, archivedAt: null },
      select: { id: true, branchId: true },
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
}
