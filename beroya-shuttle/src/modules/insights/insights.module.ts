import { Module } from '@nestjs/common';
import { AdminAuditLogsController } from './admin-audit-logs.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminSearchController } from './admin-search.controller';
import { AuditLogsService } from './audit-logs.service';
import { InstitutionAuditLogsController } from './institution-audit-logs.controller';
import { InstitutionDashboardController } from './institution-dashboard.controller';
import { InstitutionDashboardService } from './institution-dashboard.service';
import { InstitutionSearchController } from './institution-search.controller';
import { KpiCacheService } from './kpi-cache.service';
import { SearchService } from './search.service';

@Module({
  controllers: [
    AdminDashboardController,
    InstitutionDashboardController,
    AdminSearchController,
    InstitutionSearchController,
    AdminAuditLogsController,
    InstitutionAuditLogsController,
  ],
  providers: [
    KpiCacheService,
    AdminDashboardService,
    InstitutionDashboardService,
    SearchService,
    AuditLogsService,
  ],
})
export class InsightsModule {}

