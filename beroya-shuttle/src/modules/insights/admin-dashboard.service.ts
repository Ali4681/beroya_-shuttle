import { Injectable } from '@nestjs/common';
import {
  InstitutionStatus,
  InstitutionType,
  OperationModel,
  OwnerType,
  SubscriptionStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { calendarDateKey, todayInTimezone } from '../../common/utils/timezone';
import { adminKpiCacheKey, asInt } from './insights.rules';
import { mapExpiringSubscription, mapRecentInstitution } from './insights.mapper';
import { KpiCacheService } from './kpi-cache.service';

type CountRow = { n: unknown };

type OperationRow = {
  id: string;
  name: string;
  displayName: string | null;
  type: InstitutionType;
  operationModel: OperationModel;
  status: InstitutionStatus;
  today_trips: unknown;
  in_progress: unknown;
  delayed: unknown;
  open_incidents: unknown;
};

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: KpiCacheService,
  ) {}

  async summary() {
    const today = todayInTimezone('Asia/Damascus');
    const key = adminKpiCacheKey('summary', calendarDateKey(today));
    return this.cache.remember(key, async () => {
      const [
        institutionsTotal,
        byStatus,
        byType,
        byModel,
        activeSubscriptions,
        pendingSubscriptions,
        expiringSubscriptions30d,
        beroyaDrivers,
        beroyaVehicles,
        tripRows,
      ] = await Promise.all([
        this.prisma.institution.count({ where: { archivedAt: null } }),
        this.prisma.institution.groupBy({
          by: ['status'],
          where: { archivedAt: null },
          _count: { _all: true },
        }),
        this.prisma.institution.groupBy({
          by: ['type'],
          where: { archivedAt: null },
          _count: { _all: true },
        }),
        this.prisma.institution.groupBy({
          by: ['operationModel'],
          where: { archivedAt: null },
          _count: { _all: true },
        }),
        this.prisma.institutionSubscription.count({
          where: { status: SubscriptionStatus.ACTIVE },
        }),
        this.prisma.institutionSubscription.count({
          where: { status: SubscriptionStatus.PENDING },
        }),
        this.prisma.institutionSubscription.count({
          where: {
            status: SubscriptionStatus.ACTIVE,
            endsAt: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        this.prisma.driverProfile.count({
          where: { ownerType: OwnerType.BEROYA, archivedAt: null },
        }),
        this.prisma.shuttleVehicle.count({
          where: {
            ownerType: { in: [OwnerType.BEROYA, OwnerType.DRIVER] },
            archivedAt: null,
          },
        }),
        this.prisma.$queryRaw<CountRow[]>`
          SELECT
            COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress
          FROM "ShuttleTrip"
          WHERE "serviceDate" = ${today}
        `,
      ]);

      const trip = tripRows[0] as CountRow & { in_progress?: unknown };
      return {
        institutionsTotal,
        institutionsByStatus: Object.fromEntries(
          (Object.values(InstitutionStatus) as InstitutionStatus[]).map(
            (status) => [
              status,
              byStatus.find((row) => row.status === status)?._count._all ?? 0,
            ],
          ),
        ),
        institutionsByType: Object.fromEntries(
          (Object.values(InstitutionType) as InstitutionType[]).map((type) => [
            type,
            byType.find((row) => row.type === type)?._count._all ?? 0,
          ]),
        ),
        institutionsByOperationModel: Object.fromEntries(
          (Object.values(OperationModel) as OperationModel[]).map((model) => [
            model,
            byModel.find((row) => row.operationModel === model)?._count._all ??
              0,
          ]),
        ),
        activeSubscriptions,
        pendingSubscriptions,
        expiringSubscriptions30d,
        beroyaDrivers,
        beroyaVehicles,
        tripsToday: asInt(trip?.n),
        tripsInProgress: asInt(trip?.in_progress),
      };
    });
  }

  async institutionsDistribution() {
    return this.cache.remember(adminKpiCacheKey('distribution'), async () => {
      const [byType, byOperationModel, byStatus] = await Promise.all([
        this.prisma.institution.groupBy({
          by: ['type'],
          where: { archivedAt: null },
          _count: { _all: true },
        }),
        this.prisma.institution.groupBy({
          by: ['operationModel'],
          where: { archivedAt: null },
          _count: { _all: true },
        }),
        this.prisma.institution.groupBy({
          by: ['status'],
          where: { archivedAt: null },
          _count: { _all: true },
        }),
      ]);

      return {
        byType: byType.map((row) => ({ key: row.type, count: row._count._all })),
        byOperationModel: byOperationModel.map((row) => ({
          key: row.operationModel,
          count: row._count._all,
        })),
        byStatus: byStatus.map((row) => ({
          key: row.status,
          count: row._count._all,
        })),
      };
    });
  }

  async recentInstitutions(limit: number) {
    const rows = await this.prisma.institution.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { primaryAdmin: true },
    });
    return rows.map(mapRecentInstitution);
  }

  async expiringSubscriptions(days: number) {
    const key = adminKpiCacheKey('expiring', String(days));
    return this.cache.remember(key, async () => {
      const now = new Date();
      const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const rows = await this.prisma.institutionSubscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          endsAt: { gte: now, lte: until },
        },
        include: { institution: true },
        orderBy: { endsAt: 'asc' },
      });
      return rows.map(mapExpiringSubscription);
    });
  }

  async operations() {
    const today = todayInTimezone('Asia/Damascus');
    const key = adminKpiCacheKey('operations', calendarDateKey(today));
    return this.cache.remember(key, async () => {
      const rows = await this.prisma.$queryRaw<OperationRow[]>`
        SELECT
          i.id,
          i.name,
          i."displayName",
          i.type,
          i."operationModel",
          i.status,
          COUNT(t.id)::int AS today_trips,
          COUNT(t.id) FILTER (WHERE t.status = 'IN_PROGRESS')::int AS in_progress,
          COUNT(t.id) FILTER (
            WHERE t."delayMinutes" > 0 OR t."delayDetectedAt" IS NOT NULL
          )::int AS delayed,
          (
            SELECT COUNT(*)::int
            FROM "TripIncident" inc
            JOIN "ShuttleTrip" tt ON tt.id = inc."tripId"
            WHERE tt."institutionId" = i.id
              AND inc.status = 'OPEN'
          ) AS open_incidents
        FROM "Institution" i
        LEFT JOIN "ShuttleTrip" t
          ON t."institutionId" = i.id
         AND t."serviceDate" = ${today}
        WHERE i."archivedAt" IS NULL
          AND i."operationModel" = 'BEROYA_OPERATED'
        GROUP BY i.id
        ORDER BY i.name ASC
      `;

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        type: row.type,
        operationModel: row.operationModel,
        status: row.status,
        todayTrips: asInt(row.today_trips),
        inProgress: asInt(row.in_progress),
        delayed: asInt(row.delayed),
        openIncidents: asInt(row.open_incidents),
      }));
    });
  }
}
