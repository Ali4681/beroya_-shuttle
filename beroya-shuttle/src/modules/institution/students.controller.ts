import {
  Body,
  Controller,
  Delete,
  Get,
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
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { GuardianDto } from './dto/guardian.dto';
import { ListStudentsQueryDto } from './dto/list-students.query';
import { PickupDto } from './dto/pickup.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { CreateRouteExceptionDto } from '../trips/dto/create-route-exception.dto';
import { RouteExceptionsService } from '../trips/route-exceptions.service';
import { StudentsService } from './students.service';

@ApiTags('institution-students')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly exceptions: RouteExceptionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List school students with search and route filters',
  })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: ListStudentsQueryDto,
  ) {
    return this.students.list(institutionId, query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Student totals: active, without route, home, meeting point',
  })
  stats(@CurrentUser('institutionId') institutionId: string) {
    return this.students.stats(institutionId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a student and find-or-create the parent by phone',
  })
  create(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: CreateStudentDto,
  ) {
    return this.students.create(actorUserId, institutionId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one school student' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.getById(institutionId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update student profile fields' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStudentDto,
  ) {
    return this.students.update(actorUserId, institutionId, id, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate a student' })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStudentStatusDto,
  ) {
    return this.students.updateStatus(actorUserId, institutionId, id, body.status);
  }

  @Patch(':id/guardian')
  @ApiOperation({
    summary: 'Change guardian phone — reuses or creates the PARENT account',
  })
  updateGuardian(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GuardianDto,
  ) {
    return this.students.updateGuardian(actorUserId, institutionId, id, body);
  }

  @Patch(':id/pickup')
  @ApiOperation({
    summary: 'Update pickup type; does not reorder route stops',
  })
  updatePickup(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PickupDto,
  ) {
    return this.students.updatePickup(actorUserId, institutionId, id, body);
  }

  @Get(':id/trips')
  @ApiOperation({ summary: 'Trip participation rows for this student' })
  trips(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.students.listTrips(institutionId, id, query);
  }

  @Get(':id/boarding-history')
  @ApiOperation({
    summary: 'Board, drop-off, and not-boarded events newest first',
  })
  boardingHistory(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.boardingHistory(institutionId, id);
  }

  @Get(':id/route-exceptions')
  @ApiOperation({ summary: 'List temporary route exceptions for a student' })
  listExceptions(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.exceptions.list(institutionId, id);
  }

  @Post(':id/route-exceptions')
  @ApiOperation({ summary: 'Move a student to another route for one date' })
  createException(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateRouteExceptionDto,
  ) {
    return this.exceptions.create(actorUserId, institutionId, id, body);
  }

  @Delete(':id/route-exceptions/:eid')
  @ApiOperation({
    summary: 'Delete an exception only if the related trip has not started',
  })
  deleteException(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eid', ParseUUIDPipe) eid: string,
  ) {
    return this.exceptions.remove(actorUserId, institutionId, id, eid);
  }
}
