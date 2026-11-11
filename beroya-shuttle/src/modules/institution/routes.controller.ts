import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole, TripDirection } from '../../generated/prisma/client';
import { AssignRouteStudentsDto } from './dto/assign-route-students.dto';
import { CreateCustomStopDto } from './dto/create-custom-stop.dto';
import { CreateRouteDto } from './dto/create-route.dto';
import { CreateRouteScheduleDto } from './dto/create-route-schedule.dto';
import { DefaultAssignmentDto } from './dto/default-assignment.dto';
import { ListRouteStopsQueryDto } from './dto/list-route-stops.query';
import { ListRoutesQueryDto } from './dto/list-routes.query';
import { OptimizeStopsDto } from './dto/optimize-stops.dto';
import { StopOrderDto } from './dto/stop-order.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { UpdateRouteScheduleDto } from './dto/update-route-schedule.dto';
import { UpdateRouteStatusDto } from './dto/update-route-status.dto';
import { UpdateRouteStopDto } from './dto/update-route-stop.dto';
import { RoutesService } from './routes.service';

@ApiTags('institution-routes')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get()
  @ApiOperation({ summary: 'List institution routes' })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: ListRoutesQueryDto,
  ) {
    return this.routes.list(institutionId, query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Route totals: active, suspended, stopped today, unavailable',
  })
  stats(@CurrentUser('institutionId') institutionId: string) {
    return this.routes.stats(institutionId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a route with an origin point' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: CreateRouteDto,
  ) {
    return this.routes.create(actorUserId, institutionId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one route with students, schedules, and stops' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.routes.getById(institutionId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update route name, origin, or branch' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRouteDto,
  ) {
    return this.routes.update(actorUserId, institutionId, id, body);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Change route status; notify_users emails/pushes parents later',
  })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRouteStatusDto,
  ) {
    return this.routes.updateStatus(actorUserId, institutionId, id, body);
  }

  @Patch(':id/default-assignment')
  @ApiOperation({
    summary: 'Assign default driver, vehicle, and attendant',
  })
  updateDefaultAssignment(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DefaultAssignmentDto,
  ) {
    return this.routes.updateDefaultAssignment(
      actorUserId,
      institutionId,
      id,
      body,
    );
  }

  @Get(':id/students')
  @ApiOperation({ summary: 'List students assigned to the route' })
  listStudents(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.routes.listStudents(institutionId, id);
  }

  @Post(':id/students')
  @ApiOperation({
    summary: 'Assign students; closes their previous active route assignment',
  })
  assignStudents(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignRouteStudentsDto,
  ) {
    return this.routes.assignStudents(actorUserId, institutionId, id, body);
  }

  @Delete(':id/students/:studentId')
  @ApiOperation({ summary: 'Remove a student from the route' })
  removeStudent(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.routes.removeStudent(actorUserId, institutionId, id, studentId);
  }

  @Get(':id/schedules')
  @ApiOperation({ summary: 'List route schedules' })
  listSchedules(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.routes.listSchedules(institutionId, id);
  }

  @Post(':id/schedules')
  @ApiOperation({
    summary: 'Add a schedule; schools are limited to one per direction',
  })
  createSchedule(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateRouteScheduleDto,
  ) {
    return this.routes.createSchedule(actorUserId, institutionId, id, body);
  }

  @Patch(':id/schedules/:sid')
  @ApiOperation({ summary: 'Update a schedule' })
  updateSchedule(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sid', ParseUUIDPipe) sid: string,
    @Body() body: UpdateRouteScheduleDto,
  ) {
    return this.routes.updateSchedule(actorUserId, institutionId, id, sid, body);
  }

  @Delete(':id/schedules/:sid')
  @ApiOperation({ summary: 'Delete a schedule' })
  deleteSchedule(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sid', ParseUUIDPipe) sid: string,
  ) {
    return this.routes.deleteSchedule(actorUserId, institutionId, id, sid);
  }

  @Get(':id/stops')
  @ApiOperation({ summary: 'List stops for one direction' })
  listStops(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListRouteStopsQueryDto,
  ) {
    return this.routes.listStops(
      institutionId,
      id,
      query.direction ?? TripDirection.OUTBOUND,
    );
  }

  @Post(':id/stops')
  @ApiOperation({ summary: 'Add a manual CUSTOM stop' })
  createCustomStop(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCustomStopDto,
  ) {
    return this.routes.createCustomStop(actorUserId, institutionId, id, body);
  }

  @Patch(':id/stops/:stopId')
  @ApiOperation({ summary: 'Update a stop label or coordinates' })
  updateStop(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stopId', ParseUUIDPipe) stopId: string,
    @Body() body: UpdateRouteStopDto,
  ) {
    return this.routes.updateStop(actorUserId, institutionId, id, stopId, body);
  }

  @Delete(':id/stops/:stopId')
  @ApiOperation({ summary: 'Delete a CUSTOM or empty pickup stop' })
  deleteStop(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stopId', ParseUUIDPipe) stopId: string,
  ) {
    return this.routes.deleteStop(actorUserId, institutionId, id, stopId);
  }

  @Post(':id/optimize-stops')
  @ApiOperation({
    summary: 'Suggest a stop order only — does not persist',
  })
  optimizeStops(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: OptimizeStopsDto,
  ) {
    return this.routes.optimizeStops(institutionId, id, body);
  }

  @Put(':id/stop-order')
  @ApiOperation({ summary: 'Persist a stop order and clear the stale flag' })
  saveStopOrder(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: StopOrderDto,
  ) {
    return this.routes.saveStopOrder(actorUserId, institutionId, id, body);
  }
}
