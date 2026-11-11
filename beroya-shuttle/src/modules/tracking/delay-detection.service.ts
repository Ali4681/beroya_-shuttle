import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryStatus,
  InstitutionType,
  NotificationAudience,
  NotificationOrigin,
  Prisma,
  ShuttleRole,
  TripAlertType,
  TripEventType,
  TripStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { PlatformSettingsService } from '../admin/platform-settings.service';
import { packNotice, withNoticeI18n } from '../admin/platform-settings';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { TripEventService } from '../trips/trip-event.service';
import {
  delayMinutesFromEta,
  shouldSendDelayAlert,
} from './tracking.rules';

@Injectable()
export class DelayDetectionService {
  private readonly logger = new Logger(DelayDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: TripEventService,
    private readonly realtime: RealtimeService,
    private readonly platform: PlatformSettingsService,
    private readonly dispatch: NotificationDispatchService,
  ) {}

  async scan(): Promise<{ checked: number; alerts: number }> {
    const trips = await this.prisma.shuttleTrip.findMany({
      where: { status: TripStatus.IN_PROGRESS },
      select: { id: true },
    });
    let alerts = 0;
    for (const trip of trips) {
      const result = await this.evaluate(trip.id);
      if (result.alerted) {
        alerts += 1;
      }
    }
    return { checked: trips.length, alerts };
  }

  async evaluate(tripId: string): Promise<{
    delayMinutes: number;
    alerted: boolean;
  }> {
    const trip = await this.prisma.shuttleTrip.findUnique({
      where: { id: tripId },
      include: {
        institution: { select: { type: true, operationModel: true } },
        stops: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!trip || trip.status !== TripStatus.IN_PROGRESS) {
      return { delayMinutes: 0, alerted: false };
    }

    const plannedFinishAt =
      [...trip.stops]
        .reverse()
        .find((stop) => stop.plannedArrivalAt)?.plannedArrivalAt ?? null;
    const delayMinutes = delayMinutesFromEta(
      trip.etaToFinishAt,
      plannedFinishAt,
    );

    await this.prisma.shuttleTrip.update({
      where: { id: tripId },
      data: { delayMinutes },
    });

    if (
      !shouldSendDelayAlert(
        delayMinutes,
        trip.delayThresholdMinutes,
        trip.delayAlertSentAt != null,
      )
    ) {
      return { delayMinutes, alerted: false };
    }

    const recipients = await this.delayRecipients({
      tripId,
      institutionId: trip.institutionId,
      type: trip.institution.type,
    });
    const notice = packNotice((await this.platform.read()).templates.delay, {
      minutes: delayMinutes,
    });
    const now = new Date();
    let notificationId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      await tx.shuttleTrip.update({
        where: { id: tripId },
        data: {
          delayMinutes,
          delayDetectedAt: trip.delayDetectedAt ?? now,
          delayAlertSentAt: now,
        },
      });
      await this.events.record(
        {
          tripId,
          type: TripEventType.DELAY_DETECTED,
          title: 'Trip delay detected',
          data: {
            delayMinutes,
            thresholdMinutes: trip.delayThresholdMinutes,
          },
        },
        tx,
      );
      if (recipients.length > 0) {
        const created = await tx.shuttleNotification.create({
          data: {
            institutionId: trip.institutionId,
            branchId: trip.branchId,
            routeId: trip.routeId,
            audience:
              trip.institution.type === InstitutionType.UNIVERSITY
                ? NotificationAudience.ROUTE_UNIVERSITY_STUDENTS
                : NotificationAudience.ROUTE_PARENTS,
            origin: NotificationOrigin.SYSTEM,
            title: notice.title,
            body: notice.body,
            data: withNoticeI18n(
              { tripId, delayMinutes, kind: 'DELAY' },
              notice,
            ) as Prisma.InputJsonValue,
            recipientsCount: recipients.length,
            recipients: {
              create: recipients.map((userId) => ({
                userId,
                status: DeliveryStatus.PENDING,
              })),
            },
          },
        });
        notificationId = created.id;
      }
      await tx.tripAlertDelivery.createMany({
        data: recipients.map((userId) => ({
          tripId,
          userId,
          type: TripAlertType.DELAY,
          status: DeliveryStatus.PENDING,
          sentAt: now,
        })),
        skipDuplicates: true,
      });
    });

    if (notificationId) {
      await this.dispatch.enqueue(notificationId);
    }

    this.realtime.emitTrip(
      REALTIME_EVENTS.TRIP_DELAY_DETECTED,
      {
        institutionId: trip.institutionId,
        tripId,
        routeId: trip.routeId,
        operationModel: trip.institution.operationModel,
      },
      { delay_minutes: delayMinutes },
    );
    this.logger.debug(`Delay alert sent for trip ${tripId}`);

    return { delayMinutes, alerted: true };
  }

  private async delayRecipients(input: {
    tripId: string;
    institutionId: string;
    type: InstitutionType;
  }): Promise<string[]> {
    const admins = await this.prisma.shuttleUser.findMany({
      where: {
        institutionId: input.institutionId,
        role: ShuttleRole.INSTITUTION_ADMIN,
        archivedAt: null,
      },
      select: { id: true },
    });
    const ids = admins.map((row) => row.id);

    if (input.type === InstitutionType.UNIVERSITY) {
      const students = await this.prisma.universityStudentProfile.findMany({
        where: { institutionId: input.institutionId, archivedAt: null },
        select: { userId: true },
      });
      return [...new Set([...ids, ...students.map((row) => row.userId)])];
    }

    const parents = await this.prisma.tripStudent.findMany({
      where: { tripId: input.tripId },
      select: { student: { select: { guardianUserId: true } } },
    });
    return [
      ...new Set([...ids, ...parents.map((row) => row.student.guardianUserId)]),
    ];
  }
}
