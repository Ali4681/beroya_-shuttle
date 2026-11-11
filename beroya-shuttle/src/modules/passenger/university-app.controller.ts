import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { UniversityRoutesQueryDto } from './dto/university-routes.query';
import { UniversityTripsQueryDto } from './dto/university-trips.query';
import { PassengerService } from './passenger.service';

@ApiTags('university')
@ApiBearerAuth()
@Roles(ShuttleRole.UNIVERSITY_STUDENT)
@Controller('university')
export class UniversityAppController {
  constructor(private readonly passenger: PassengerService) {}

  @Get('me')
  @ApiOperation({ summary: 'University student profile and branding' })
  me(@CurrentUser('sub') userId: string) {
    return this.passenger.universityMe(userId);
  }

  @Get('routes')
  @ApiOperation({ summary: 'All institution routes — no fixed assignment' })
  routes(
    @CurrentUser('sub') userId: string,
    @Query() query: UniversityRoutesQueryDto,
  ) {
    return this.passenger.universityRoutes(userId, query);
  }

  @Get('routes/:id')
  @ApiOperation({
    summary:
      'Route detail with stops + stored road polyline (polyline / polylines.OUTBOUND|INBOUND)',
  })
  route(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.passenger.universityRoute(userId, id);
  }

  @Get('routes/:id/schedules')
  @ApiOperation({ summary: 'Outbound and inbound departure times' })
  schedules(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.passenger.universitySchedules(userId, id);
  }

  @Get('trips/today')
  @ApiOperation({
    summary:
      'Trips for a service date (default today). Filters: date, direction, route_id, lat/lng, max_distance_meters, max_eta_minutes, min_eta_minutes, crowd',
  })
  today(
    @CurrentUser('sub') userId: string,
    @Query() query: UniversityTripsQueryDto,
  ) {
    return this.passenger.universityToday(userId, query);
  }

  @Get('trips/:id/live')
  @ApiOperation({ summary: 'Live trip for any route at this university' })
  live(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.passenger.universityLive(userId, id);
  }
}
