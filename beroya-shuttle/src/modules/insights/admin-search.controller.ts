import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { AdminSearchQueryDto } from './dto/search.query';
import { SearchService } from './search.service';

@ApiTags('admin-search')
@ApiBearerAuth()
@Roles(ShuttleRole.BEROYA_ADMIN)
@Controller('admin')
export class AdminSearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search institutions, drivers, and vehicles (ILIKE + pg_trgm)',
  })
  adminSearch(@Query() query: AdminSearchQueryDto) {
    return this.search.adminSearch(query.q, query.limit);
  }
}
