import {
  Body,
  Controller,
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
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { CreateUniversityStudentDto } from './dto/create-university-student.dto';
import { ListUniversityStudentsQueryDto } from './dto/list-university-students.query';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { UpdateUniversityStudentDto } from './dto/update-university-student.dto';
import { UniversityStudentsService } from './university-students.service';

@ApiTags('institution-university-students')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/university-students')
export class UniversityStudentsController {
  constructor(private readonly universityStudents: UniversityStudentsService) {}

  @Get()
  @ApiOperation({ summary: 'List university students' })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: ListUniversityStudentsQueryDto,
  ) {
    return this.universityStudents.list(institutionId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'University student totals' })
  stats(@CurrentUser('institutionId') institutionId: string) {
    return this.universityStudents.stats(institutionId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a UNIVERSITY_STUDENT user and profile (no fixed route)',
  })
  create(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: CreateUniversityStudentDto,
  ) {
    return this.universityStudents.create(actorUserId, institutionId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one university student' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.universityStudents.getById(institutionId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update university student profile' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUniversityStudentDto,
  ) {
    return this.universityStudents.update(actorUserId, institutionId, id, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate a university student' })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStudentStatusDto,
  ) {
    return this.universityStudents.updateStatus(
      actorUserId,
      institutionId,
      id,
      body.status,
    );
  }
}
