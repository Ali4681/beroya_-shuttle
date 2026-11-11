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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { GenerateTripsDto } from './dto/generate-trips.dto';
import { ListTripsQueryDto } from './dto/list-trips.query';
import { OverrideTripDto } from './dto/override-trip.dto';
import { ReassignTripDto } from './dto/reassign-trip.dto';
import { UpdateTripStudentStatusDto } from './dto/update-trip-student-status.dto';
import { TripOpsService } from './trip-ops.service';
import { TripsService } from './trips.service';

@ApiTags('institution-trips')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/trips')
export class TripsController {
  constructor(
    private readonly trips: TripsService,
    private readonly ops: TripOpsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List trips for a service date' })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: ListTripsQueryDto,
  ) {
    return this.trips.list(institutionId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Trip totals for a service date' })
  stats(
    @CurrentUser('institutionId') institutionId: string,
    @Query('date') date?: string,
  ) {
    return this.trips.stats(institutionId, date);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generate or backfill trips for a date (idempotent upsert)',
  })
  generate(
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: GenerateTripsDto,
  ) {
    return this.trips.generate(institutionId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one trip' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trips.getById(institutionId, id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Trip assignment plus student and stop counts' })
  summary(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trips.summary(institutionId, id);
  }

  @Get(':id/stops')
  @ApiOperation({ summary: 'Trip stops in sequence' })
  listStops(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trips.listStops(institutionId, id);
  }

  @Get(':id/students')
  @ApiOperation({ summary: 'Students on this trip' })
  listStudents(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trips.listStudents(institutionId, id);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Chronological trip timeline from TripEvent' })
  listEvents(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trips.listEvents(institutionId, id);
  }

  @Patch(':id/override')
  @ApiOperation({
    summary: 'Override a scheduled trip only — does not change the route',
  })
  override(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: OverrideTripDto,
  ) {
    return this.ops.override(actorUserId, institutionId, id, body);
  }

  @Post(':id/reassign')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reassign crew on a scheduled or in-progress trip',
  })
  reassign(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReassignTripDto,
  ) {
    return this.ops.reassign(actorUserId, institutionId, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a trip that is not completed' })
  cancel(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelTripDto,
  ) {
    return this.ops.cancel(actorUserId, institutionId, id, body);
  }

  @Patch(':tripId/students/:tripStudentId/status')
  @ApiOperation({
    summary: 'Correct a student boarding status (institution admin only)',
  })
  updateStudentStatus(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('tripStudentId', ParseUUIDPipe) tripStudentId: string,
    @Body() body: UpdateTripStudentStatusDto,
  ) {
    return this.ops.updateStudentStatus(
      actorUserId,
      institutionId,
      tripId,
      tripStudentId,
      body.status,
    );
  }
}
