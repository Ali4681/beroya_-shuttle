import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { AdminDashboardService } from './admin-dashboard.service';
import { ExpiringSubscriptionsQueryDto } from './dto/expiring-subscriptions.query';
import { RecentInstitutionsQueryDto } from './dto/recent-institutions.query';

@ApiTags('admin-dashboard')
@ApiBearerAuth()
@Roles(ShuttleRole.BEROYA_ADMIN)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Beroya KPI summary (Redis cached 30s)' })
  summary() {
    return this.dashboard.summary();
  }

  @Get('institutions-distribution')
  @ApiOperation({ summary: 'Institutions by type, operation model, and status' })
  institutionsDistribution() {
    return this.dashboard.institutionsDistribution();
  }

  @Get('recent-institutions')
  @ApiOperation({ summary: 'Most recently created institutions' })
  recentInstitutions(@Query() query: RecentInstitutionsQueryDto) {
    return this.dashboard.recentInstitutions(query.limit);
  }

  @Get('expiring-subscriptions')
  @ApiOperation({ summary: 'Active subscriptions ending within N days' })
  expiringSubscriptions(@Query() query: ExpiringSubscriptionsQueryDto) {
    return this.dashboard.expiringSubscriptions(query.days);
  }

  @Get('operations')
  @ApiOperation({
    summary: 'Operational KPIs for BEROYA_OPERATED institutions only',
  })
  operations() {
    return this.dashboard.operations();
  }
}
