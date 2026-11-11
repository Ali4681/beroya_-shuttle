import { Injectable } from '@nestjs/common';
import {
  DeliveryStatus,
  NotificationAudience,
  NotificationOrigin,
  Prisma,
  ShuttleRole,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { NotificationAudienceService } from '../../notifications/notification-audience.service';
import { NotificationDispatchService } from '../../notifications/notification-dispatch.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: NotificationAudienceService,
    private readonly dispatch: NotificationDispatchService,
  ) {}

  async notifyRouteParents(
    input: {
      actorUserId: string;
      institutionId: string;
      routeId: string;
      branchId?: string | null;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    },
    db: Db = this.prisma,
  ) {
    const parentIds = await this.audience.resolve({
      institutionId: input.institutionId,
      audience: NotificationAudience.ROUTE_PARENTS,
      routeId: input.routeId,
    });
    return this.createSystemNotification(
      {
        institutionId: input.institutionId,
        branchId: input.branchId,
        routeId: input.routeId,
        audience: NotificationAudience.ROUTE_PARENTS,
        title: input.title,
        body: input.body,
        data: input.data,
        sentByUserId: input.actorUserId,
        userIds: parentIds,
      },
      db,
    );
  }

  async notifyAssignedDriver(
    input: {
      actorUserId: string;
      institutionId: string;
      routeId: string;
      branchId?: string | null;
      driverUserId: string;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    },
    db: Db = this.prisma,
  ) {
    return this.createSystemNotification(
      {
        institutionId: input.institutionId,
        branchId: input.branchId,
        routeId: input.routeId,
        audience: NotificationAudience.ROUTE_DRIVERS,
        title: input.title,
        body: input.body,
        data: input.data,
        sentByUserId: input.actorUserId,
        userIds: [input.driverUserId],
      },
      db,
    );
  }

  /** Notify a single parent/guardian user (inbox + FCM). */
  async notifyGuardian(
    input: {
      actorUserId: string;
      institutionId: string;
      routeId: string;
      branchId?: string | null;
      guardianUserId: string;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    },
    db: Db = this.prisma,
  ) {
    return this.createSystemNotification(
      {
        institutionId: input.institutionId,
        branchId: input.branchId,
        routeId: input.routeId,
        audience: NotificationAudience.ROUTE_PARENTS,
        title: input.title,
        body: input.body,
        data: input.data,
        sentByUserId: input.actorUserId,
        userIds: [input.guardianUserId],
      },
      db,
    );
  }

  async notifyAssignedAttendant(
    input: {
      actorUserId: string;
      institutionId: string;
      routeId: string;
      branchId?: string | null;
      attendantUserId: string;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    },
    db: Db = this.prisma,
  ) {
    return this.createSystemNotification(
      {
        institutionId: input.institutionId,
        branchId: input.branchId,
        routeId: input.routeId,
        audience: NotificationAudience.ROUTE_ATTENDANTS,
        title: input.title,
        body: input.body,
        data: input.data,
        sentByUserId: input.actorUserId,
        userIds: [input.attendantUserId],
      },
      db,
    );
  }

  async notifyRouteAttendants(
    input: {
      actorUserId: string;
      institutionId: string;
      routeId: string;
      branchId?: string | null;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    },
    db: Db = this.prisma,
  ) {
    const attendantIds = await this.audience.resolve({
      institutionId: input.institutionId,
      audience: NotificationAudience.ROUTE_ATTENDANTS,
      routeId: input.routeId,
    });
    return this.createSystemNotification(
      {
        institutionId: input.institutionId,
        branchId: input.branchId,
        routeId: input.routeId,
        audience: NotificationAudience.ROUTE_ATTENDANTS,
        title: input.title,
        body: input.body,
        data: input.data,
        sentByUserId: input.actorUserId,
        userIds: attendantIds,
      },
      db,
    );
  }

  async notifyInstitutionAdmins(
    input: {
      actorUserId: string;
      institutionId: string;
      branchId?: string | null;
      routeId?: string | null;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    },
    db: Db = this.prisma,
  ) {
    const admins = await db.shuttleUser.findMany({
      where: {
        institutionId: input.institutionId,
        role: ShuttleRole.INSTITUTION_ADMIN,
        archivedAt: null,
      },
      select: { id: true },
    });
    const adminIds = [...new Set(admins.map((row) => row.id))];
    return this.createSystemNotification(
      {
        institutionId: input.institutionId,
        branchId: input.branchId,
        routeId: input.routeId,
        audience: NotificationAudience.ROUTE_PARENTS,
        title: input.title,
        body: input.body,
        data: {
          internalAudience: 'institution_admins',
          ...(input.data ?? {}),
        },
        sentByUserId: input.actorUserId,
        userIds: adminIds,
      },
      db,
    );
  }

  private async createSystemNotification(
    input: {
      institutionId: string;
      branchId?: string | null;
      routeId?: string | null;
      audience: NotificationAudience;
      title: string;
      body: string;
      data?: Record<string, unknown>;
      sentByUserId: string;
      userIds: string[];
    },
    db: Db,
  ) {
    const userIds = [...new Set(input.userIds.filter(Boolean))];
    const created = await db.shuttleNotification.create({
      data: {
        institutionId: input.institutionId,
        branchId: input.branchId,
        routeId: input.routeId,
        audience: input.audience,
        origin: NotificationOrigin.SYSTEM,
        title: input.title,
        body: input.body,
        data: input.data as Prisma.InputJsonValue | undefined,
        recipientsCount: userIds.length,
        sentByUserId: input.sentByUserId,
        recipients: {
          create: userIds.map((userId) => ({
            userId,
            status: DeliveryStatus.PENDING,
          })),
        },
      },
    });
    if (db === this.prisma) {
      await this.dispatch.enqueue(created.id);
    }
    return created;
  }
}
