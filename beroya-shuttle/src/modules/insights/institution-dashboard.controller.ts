import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { InstitutionSummaryQueryDto } from './dto/institution-summary.query';
import { InstitutionDashboardService } from './institution-dashboard.service';

@ApiTags('institution-dashboard')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/dashboard')
export class InstitutionDashboardController {
  constructor(private readonly dashboard: InstitutionDashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Today trip KPIs and open incidents (one grouped query, Redis cached 30s)',
  })
  summary(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: InstitutionSummaryQueryDto,
  ) {
    return this.dashboard.summary(institutionId, query.branchId);
  }
}
