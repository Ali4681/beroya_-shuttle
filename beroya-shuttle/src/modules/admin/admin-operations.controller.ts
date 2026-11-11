import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { AdminOperationsService } from './admin-operations.service';
import {
  AdminIncidentsQueryDto,
  AdminTripStatsQueryDto,
  AdminTripsQueryDto,
} from './dto/admin-operations.query';

@ApiTags('admin-operations')
@ApiBearerAuth()
@Roles(ShuttleRole.BEROYA_ADMIN)
@Controller('admin/operations')
export class AdminOperationsController {
  constructor(private readonly operations: AdminOperationsService) {}

  @Get('trips')
  @ApiOperation({
    summary: 'Trips operated by Beroya across institutions (one service date)',
  })
  trips(@Query() query: AdminTripsQueryDto) {
    return this.operations.listTrips(query);
  }

  @Get('trips/stats')
  @ApiOperation({
    summary: 'Status counts of Beroya-operated trips for a service date',
  })
  tripStats(@Query() query: AdminTripStatsQueryDto) {
    return this.operations.tripStats(query.date);
  }

  @Get('trips/:id')
  @ApiOperation({
    summary:
      'Beroya-operated trip with stops, events, incidents, and live position',
  })
  trip(@Param('id', ParseUUIDPipe) id: string) {
    return this.operations.getTrip(id);
  }

  @Get('live-map')
  @ApiOperation({
    summary: 'In-progress Beroya-operated trips with their live positions',
  })
  liveMap() {
    return this.operations.liveMap();
  }

  @Get('incidents')
  @ApiOperation({ summary: 'Incidents reported on Beroya-operated trips' })
  incidents(@Query() query: AdminIncidentsQueryDto) {
    return this.operations.listIncidents(query);
  }

  @Get('incidents/stats')
  @ApiOperation({
    summary: 'Open and resolved incident counts on Beroya-operated trips',
  })
  incidentStats() {
    return this.operations.incidentStats();
  }
}
