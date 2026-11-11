import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryStatus,
  NotificationAudience,
  NotificationOrigin,
  Prisma,
  TripAlertType,
  TripStudentStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationDispatchService } from './notification-dispatch.service';
import { PlatformSettingsService } from '../admin/platform-settings.service';
import { packNotice, withNoticeI18n } from '../admin/platform-settings';
import {
  normalizeArrivalMinutes,
  shouldSendArrivalAlert,
} from './arrival-alert.rules';

@Injectable()
export class ArrivalAlertService {
  private readonly logger = new Logger(ArrivalAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: NotificationDispatchService,
    private readonly platform: PlatformSettingsService,
  ) {}

  async evaluate(tripId: string, now = new Date()): Promise<number> {
    const trip = await this.prisma.shuttleTrip.findUnique({
      where: { id: tripId },
      include: {
        institution: { include: { settings: true } },
        students: {
          where: { status: TripStudentStatus.PENDING },
          include: {
            student: {
              include: {
                guardianUser: true,
                arrivalPreferences: true,
              },
            },
            tripStop: true,
          },
        },
      },
    });
    if (!trip) {
      return 0;
    }

    const defaultMinutes = normalizeArrivalMinutes(
      trip.institution.settings?.defaultParentArrivalAlertMinutes,
    );
    let sent = 0;
    for (const row of trip.students) {
      const preference = row.student.arrivalPreferences.find(
        (pref) => pref.parentUserId === row.student.guardianUserId,
      );
      if (preference && preference.soundEnabled === false) {
        continue;
      }
      const minutes = normalizeArrivalMinutes(
        preference?.minutesBefore ?? defaultMinutes,
      );
      const etaAt = row.tripStop?.etaAt;
      if (!shouldSendArrivalAlert(etaAt, minutes, now)) {
        continue;
      }

      const existing = await this.prisma.tripAlertDelivery.findFirst({
        where: {
          tripId,
          userId: row.student.guardianUserId,
          type: TripAlertType.ARRIVAL_SOON,
          studentId: row.studentId,
        },
      });
      if (existing) {
        continue;
      }

      const notice = packNotice((await this.platform.read()).templates.arrivalSoon, {
        minutes,
        studentName: row.student.fullName,
      });

      let notification;
      try {
        notification = await this.prisma.$transaction(async (tx) => {
          await tx.tripAlertDelivery.create({
            data: {
              tripId,
              userId: row.student.guardianUserId,
              studentId: row.studentId,
              type: TripAlertType.ARRIVAL_SOON,
              status: DeliveryStatus.PENDING,
              sentAt: now,
            },
          });
          return tx.shuttleNotification.create({
            data: {
              institutionId: trip.institutionId,
              branchId: trip.branchId,
              routeId: trip.routeId,
              audience: NotificationAudience.ROUTE_PARENTS,
              origin: NotificationOrigin.SYSTEM,
              title: notice.title,
              body: notice.body,
              data: withNoticeI18n(
                {
                  kind: 'ARRIVAL_SOON',
                  tripId,
                  studentId: row.studentId,
                  channel: 'shuttle_arrival',
                },
                notice,
              ) as Prisma.InputJsonValue,
              recipientsCount: 1,
              recipients: {
                create: {
                  userId: row.student.guardianUserId,
                  status: DeliveryStatus.PENDING,
                },
              },
            },
          });
        });
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code: string }).code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
      await this.dispatch.enqueue(notification.id, true);
      sent += 1;
    }
    if (sent > 0) {
      this.logger.debug(`Arrival alerts sent: ${sent} for trip ${tripId}`);
    }
    return sent;
  }
}
