import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { CrewService } from './crew.service';
import { AttendantBoardedDto } from './dto/attendant-boarded.dto';
import { DriverTripHistoryQueryDto } from './dto/driver-trip-history.query';
import { DriverWeeklyStatsQueryDto } from './dto/driver-weekly-stats.query';

@ApiTags('driver')
@ApiBearerAuth()
@Roles(ShuttleRole.DRIVER)
@Controller('driver')
export class DriverMeController {
  constructor(private readonly crew: CrewService) {}

  @Get('me')
  @ApiOperation({ summary: 'Driver profile for the crew app' })
  me(@CurrentUser('sub') userId: string) {
    return this.crew.driverMe(userId);
  }
}

@ApiTags('driver-trips')
@ApiBearerAuth()
@Roles(ShuttleRole.DRIVER)
@Controller('driver/trips')
export class DriverAppController {
  constructor(private readonly crew: CrewService) {}

  @Get('today')
  @ApiOperation({ summary: "Today's trips assigned to this driver" })
  today(@CurrentUser('sub') userId: string) {
    return this.crew.driverToday(userId);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Driver activity log — trips in a service-date range',
  })
  history(
    @CurrentUser('sub') userId: string,
    @Query() query: DriverTripHistoryQueryDto,
  ) {
    return this.crew.driverHistory(userId, query);
  }

  @Get('stats/weekly')
  @ApiOperation({
    summary:
      'Weekly driver stats (Sunday–Saturday in institution timezone): completed count and distance',
  })
  weeklyStats(
    @CurrentUser('sub') userId: string,
    @Query() query: DriverWeeklyStatsQueryDto,
  ) {
    return this.crew.driverWeeklyStats(userId, query.weekStart);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Trip detail with student_counts and last_location (bus marker seed)',
  })
  getById(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crew.driverTrip(userId, id);
  }

  @Get(':id/location')
  @ApiOperation({
    summary:
      'Last known bus location for this trip (null if none). Same object as trip.last_location.',
  })
  location(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crew.driverTripLocation(userId, id);
  }

  @Get(':id/stops')
  @ApiOperation({ summary: 'Trip stops for the driver' })
  stops(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crew.driverStops(userId, id);
  }

  @Get(':id/students')
  @ApiOperation({
    summary:
      'Students on this trip (read-only) — same shape as attendant list, names only',
  })
  students(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crew.driverStudents(userId, id);
  }

  @Patch(':id/attendant-boarded')
  @HttpCode(200)
  @Idempotent()
  @ApiOperation({
    summary: 'Confirm or clear that the assigned attendant boarded the bus',
  })
  attendantBoarded(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AttendantBoardedDto = {},
  ) {
    return this.crew.setAttendantBoarded(userId, id, body);
  }

  @Post(':id/start')
  @HttpCode(200)
  @Idempotent()
  @ApiOperation({ summary: 'Start the trip — driver only' })
  start(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crew.start(userId, id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete the trip — driver only' })
  complete(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crew.complete(userId, id);
  }

  @Post(':id/stops/:stopId/arrive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a stop as arrived' })
  arrive(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stopId', ParseUUIDPipe) stopId: string,
  ) {
    return this.crew.arrive(userId, id, stopId);
  }
}
