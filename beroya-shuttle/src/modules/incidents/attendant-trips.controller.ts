import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { ReportIncidentDto } from './dto/report-incident.dto';
import { IncidentService } from './incident.service';

@ApiTags('attendant-trips')
@ApiBearerAuth()
@Roles(ShuttleRole.ATTENDANT)
@Controller('attendant/trips')
export class AttendantTripsController {
  constructor(private readonly incidents: IncidentService) {}

  @Post(':id/emergency')
  @ApiOperation({
    summary: 'Attendant emergency button — institution admins only',
  })
  emergency(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReportIncidentDto,
  ) {
    return this.incidents.reportEmergency(userId, id, body, 'attendant');
  }
}
