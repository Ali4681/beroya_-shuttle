import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { ReportIncidentDto } from './dto/report-incident.dto';
import { IncidentService } from './incident.service';

@ApiTags('driver-trips')
@ApiBearerAuth()
@Roles(ShuttleRole.DRIVER)
@Controller('driver/trips')
export class DriverIncidentsController {
  constructor(private readonly incidents: IncidentService) {}

  @Post(':id/breakdown')
  @ApiOperation({
    summary: 'Report a vehicle breakdown — trip stays in progress',
  })
  breakdown(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReportIncidentDto,
  ) {
    return this.incidents.reportBreakdown(userId, id, body);
  }

  @Post(':id/emergency')
  @ApiOperation({
    summary: 'Trigger emergency — institution admins only, never parents',
  })
  emergency(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReportIncidentDto,
  ) {
    return this.incidents.reportEmergency(userId, id, body, 'driver');
  }
}
