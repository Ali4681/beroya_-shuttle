import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { InstitutionSearchQueryDto } from './dto/search.query';
import { SearchService } from './search.service';

@ApiTags('institution-search')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution')
export class InstitutionSearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search students, parents, routes, drivers, and vehicles',
  })
  institutionSearch(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: InstitutionSearchQueryDto,
  ) {
    return this.search.institutionSearch(
      institutionId,
      query.q,
      query.branchId,
      query.limit,
    );
  }
}
