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
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { ArrivalPreferenceDto } from './dto/arrival-preference.dto';
import { DateRangeQueryDto } from './dto/date-range.query';
import { RecordAbsenceDto } from './dto/record-absence.dto';
import { RecordDateAbsenceDto } from './dto/record-date-absence.dto';
import { PassengerService } from './passenger.service';
import { assertParentReadOnly } from './passenger.rules';

@ApiTags('parent')
@ApiBearerAuth()
@Roles(ShuttleRole.PARENT)
@Controller('parent')
export class ParentAppController {
  constructor(private readonly passenger: PassengerService) {}

  @Get('me')
  @ApiOperation({ summary: 'Parent profile, children, and institution branding' })
  me(@CurrentUser('sub') userId: string) {
    return this.passenger.parentMe(userId);
  }

  @Get('students')
  @ApiOperation({ summary: 'Children linked to this parent phone' })
  students(@CurrentUser('sub') userId: string) {
    return this.passenger.parentStudents(userId);
  }

  @Get('students/:id')
  @ApiOperation({ summary: 'One child owned by this parent' })
  student(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.passenger.parentStudent(userId, id);
  }

  @Get('students/:id/active-trip')
  @ApiOperation({ summary: 'Current trip, location, ETA, and student status' })
  activeTrip(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.passenger.activeTrip(userId, id);
  }

  @Get('students/:id/trips')
  @ApiOperation({ summary: 'Trips that include this child' })
  trips(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.passenger.studentTrips(userId, id, query);
  }

  @Get('students/:id/boarding-history')
  @ApiOperation({ summary: 'Boarded / not-boarded / dropped-off history' })
  boarding(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.passenger.boardingHistory(userId, id);
  }

  @Get('students/:studentId/non-school-days')
  @ApiOperation({
    summary:
      'Weekend + institution holidays (+ planned absences) for parent calendar',
  })
  nonSchoolDays(
    @CurrentUser('sub') userId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.passenger.studentNonSchoolDays(userId, studentId, query);
  }

  @Post('students/:studentId/absence')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Record absence by date (planned if no trip yet; applies when trip exists)',
  })
  absenceByDate(
    @CurrentUser('sub') userId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() body: RecordDateAbsenceDto,
  ) {
    return this.passenger.recordAbsenceByDate(userId, studentId, body);
  }

  @Post('students/:studentId/trips/:tripId/absence')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Record child absence on a specific trip (live trip) — optional reason; notifies crew once; idempotent',
  })
  absence(
    @CurrentUser('sub') userId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body() body: RecordAbsenceDto = {},
  ) {
    return this.passenger.recordAbsence(userId, studentId, tripId, body);
  }

  @Patch('students/:id/arrival-preference')
  @ApiOperation({ summary: 'Parent write: 5 / 10 / 15 minute arrival alert' })
  preference(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ArrivalPreferenceDto,
  ) {
    return this.passenger.updateArrivalPreference(userId, id, body);
  }

  @Patch('students/:id')
  @ApiOperation({ summary: 'Parents cannot edit student data' })
  rejectStudentPatch() {
    assertParentReadOnly();
  }

  @Patch('students/:id/pickup')
  @ApiOperation({ summary: 'Parents cannot edit pickup' })
  rejectPickupPatch() {
    assertParentReadOnly();
  }

  @Get('trips/:tripId/live')
  @ApiOperation({ summary: 'Live location for a trip that includes a child' })
  live(
    @CurrentUser('sub') userId: string,
    @Param('tripId', ParseUUIDPipe) tripId: string,
  ) {
    return this.passenger.parentLive(userId, tripId);
  }
}
