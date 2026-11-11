import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { calendarDateKey, todayInTimezone } from '../../common/utils/timezone';
import { asInt, institutionSummaryCacheKey } from './insights.rules';
import { KpiCacheService } from './kpi-cache.service';

type TripKpiRow = {
  today_trips: unknown;
  scheduled: unknown;
  in_progress: unknown;
  completed: unknown;
  delayed: unknown;
};

type CountRow = { open_incidents: unknown };

@Injectable()
export class InstitutionDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: KpiCacheService,
  ) {}

  async summary(institutionId: string, branchId?: string) {
    const settings = await this.prisma.institutionSettings.findUnique({
      where: { institutionId },
    });
    const timeZone = settings?.timezone ?? 'Asia/Damascus';
    const today = todayInTimezone(timeZone);
    const dateKey = calendarDateKey(today);
    const key = institutionSummaryCacheKey(institutionId, dateKey, branchId);

    return this.cache.remember(key, async () => {
      const branchFilter = branchId
        ? Prisma.sql`AND t."branchId" = ${branchId}`
        : Prisma.sql``;

      const [tripRows, incidentRows] = await Promise.all([
        this.prisma.$queryRaw<TripKpiRow[]>`
          SELECT
            COUNT(*)::int AS today_trips,
            COUNT(*) FILTER (WHERE t.status = 'SCHEDULED')::int AS scheduled,
            COUNT(*) FILTER (WHERE t.status = 'IN_PROGRESS')::int AS in_progress,
            COUNT(*) FILTER (WHERE t.status = 'COMPLETED')::int AS completed,
            COUNT(*) FILTER (
              WHERE t."delayMinutes" > 0 OR t."delayDetectedAt" IS NOT NULL
            )::int AS delayed
          FROM "ShuttleTrip" t
          WHERE t."institutionId" = ${institutionId}
            AND t."serviceDate" = ${today}
            ${branchFilter}
        `,
        this.prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(*)::int AS open_incidents
          FROM "TripIncident" i
          JOIN "ShuttleTrip" t ON t.id = i."tripId"
          WHERE t."institutionId" = ${institutionId}
            AND i.status = 'OPEN'
            ${branchFilter}
        `,
      ]);

      const trips = tripRows[0];
      return {
        todayTrips: asInt(trips?.today_trips),
        scheduled: asInt(trips?.scheduled),
        inProgress: asInt(trips?.in_progress),
        completed: asInt(trips?.completed),
        delayed: asInt(trips?.delayed),
        openIncidents: asInt(incidentRows[0]?.open_incidents),
      };
    });
  }
}
