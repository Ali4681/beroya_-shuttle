import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { ListIncidentsQueryDto } from './dto/list-incidents.query';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';
import { IncidentService } from './incident.service';

@ApiTags('institution-incidents')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution')
export class InstitutionIncidentsController {
  constructor(private readonly incidents: IncidentService) {}

  @Get('incidents')
  @ApiOperation({ summary: 'List incidents for the institution' })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: ListIncidentsQueryDto,
  ) {
    return this.incidents.list(institutionId, query);
  }

  @Get('incidents/stats')
  @ApiOperation({ summary: 'Open / resolved incident totals' })
  stats(@CurrentUser('institutionId') institutionId: string) {
    return this.incidents.stats(institutionId);
  }

  @Get('incidents/:id')
  @ApiOperation({ summary: 'Get one incident' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.incidents.getById(institutionId, id);
  }

  @Post('incidents/:id/resolve')
  @ApiOperation({ summary: 'Resolve an open incident' })
  resolve(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResolveIncidentDto,
  ) {
    return this.incidents.resolve(
      actorUserId,
      institutionId,
      id,
      body.resolutionNotes,
    );
  }

  @Get('dashboard/attention')
  @ApiOperation({
    summary: 'Delays, open incidents, and GPS-stale trips that need attention',
  })
  attention(@CurrentUser('institutionId') institutionId: string) {
    return this.incidents.attention(institutionId);
  }
}
