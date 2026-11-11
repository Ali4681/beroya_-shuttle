import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole, TripStudentStatus } from '../../generated/prisma/client';
import { CrewService } from './crew.service';
import { DriverTripHistoryQueryDto } from './dto/driver-trip-history.query';

@ApiTags('attendant')
@ApiBearerAuth()
@Roles(ShuttleRole.ATTENDANT)
@Controller('attendant')
export class AttendantMeController {
  constructor(private readonly crew: CrewService) {}

  @Get('me')
  @ApiOperation({ summary: 'Attendant profile for the crew app' })
  me(@CurrentUser('sub') userId: string) {
    return this.crew.attendantMe(userId);
  }
}

@ApiTags('attendant-trips')
@ApiBearerAuth()
@Roles(ShuttleRole.ATTENDANT)
@Controller('attendant/trips')
export class AttendantAppController {
  constructor(private readonly crew: CrewService) {}

  @Get('today')
  @ApiOperation({ summary: "Today's trips assigned to this attendant" })
  today(@CurrentUser('sub') userId: string) {
    return this.crew.attendantToday(userId);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Attendant activity log — trips in a service-date range',
  })
  history(
    @CurrentUser('sub') userId: string,
    @Query() query: DriverTripHistoryQueryDto,
  ) {
    return this.crew.attendantHistory(userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Trip detail for the assigned attendant (includes last_location for map)',
  })
  getById(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crew.attendantTrip(userId, id);
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
    return this.crew.attendantTripLocation(userId, id);
  }

  @Get(':id/stops')
  @ApiOperation({ summary: 'Trip stops for the attendant' })
  stops(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crew.attendantStops(userId, id);
  }

  @Get(':id/students')
  @ApiOperation({ summary: 'Students on this trip — names only, no parents' })
  students(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crew.attendantStudents(userId, id);
  }

  @Patch(':id/students/:tripStudentId/board')
  @HttpCode(200)
  @Idempotent()
  @ApiOperation({
    summary:
      'Mark a student as boarded (PENDING or NOT_BOARDED → BOARDED while trip is in progress)',
  })
  board(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tripStudentId', ParseUUIDPipe) tripStudentId: string,
  ) {
    return this.crew.markStudent(
      userId,
      id,
      tripStudentId,
      TripStudentStatus.BOARDED,
    );
  }

  @Patch(':id/students/:tripStudentId/not-boarded')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a student as not boarded — no wait or reason' })
  notBoarded(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tripStudentId', ParseUUIDPipe) tripStudentId: string,
  ) {
    return this.crew.markStudent(
      userId,
      id,
      tripStudentId,
      TripStudentStatus.NOT_BOARDED,
    );
  }

  @Patch(':id/students/:tripStudentId/drop-off')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a boarded student as dropped off' })
  dropOff(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tripStudentId', ParseUUIDPipe) tripStudentId: string,
  ) {
    return this.crew.markStudent(
      userId,
      id,
      tripStudentId,
      TripStudentStatus.DROPPED_OFF,
    );
  }
}
