import { Injectable } from '@nestjs/common';
import { RouteStatus, TripStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArrivalAlertService } from '../../modules/notifications/arrival-alert.service';
import { TrackingService } from '../../modules/tracking/tracking.service';
import { isResetStoppedTodayWindow, localJobClock } from './job-windows';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly arrival: ArrivalAlertService,
    private readonly tracking: TrackingService,
  ) {}

  async resetStoppedTodayDue(now = new Date()): Promise<number> {
    const institutions = await this.prisma.institution.findMany({
      where: { archivedAt: null },
      include: { settings: true },
    });
    let reset = 0;
    for (const institution of institutions) {
      const timeZone = institution.settings?.timezone ?? 'Asia/Damascus';
      if (!isResetStoppedTodayWindow(localJobClock(now, timeZone))) {
        continue;
      }
      const result = await this.prisma.shuttleRoute.updateMany({
        where: {
          institutionId: institution.id,
          status: RouteStatus.STOPPED_TODAY,
          archivedAt: null,
        },
        data: { status: RouteStatus.ACTIVE },
      });
      reset += result.count;
    }
    return reset;
  }

  async cleanupExpiredSessions(now = new Date()): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return result.count;
  }

  async scanArrivalAlerts(now = new Date()): Promise<{
    checked: number;
    sent: number;
  }> {
    const trips = await this.prisma.shuttleTrip.findMany({
      where: { status: TripStatus.IN_PROGRESS },
      select: { id: true },
    });
    let sent = 0;
    for (const trip of trips) {
      sent += await this.arrival.evaluate(trip.id, now);
    }
    return { checked: trips.length, sent };
  }

  async flushLocationPings(): Promise<number> {
    const trips = await this.prisma.shuttleTrip.findMany({
      where: { status: TripStatus.IN_PROGRESS },
      select: { id: true },
    });
    let flushed = 0;
    for (const trip of trips) {
      flushed += await this.tracking.flushLiveLocation(trip.id);
    }
    return flushed;
  }
}
