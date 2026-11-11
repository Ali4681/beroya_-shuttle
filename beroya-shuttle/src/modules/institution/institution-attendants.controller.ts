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
import { AttendantsService } from '../shared/resources/attendants.service';
import { CreateAttendantDto } from '../shared/resources/dto/create-attendant.dto';
import { ListAttendantsQueryDto } from '../shared/resources/dto/list-attendants.query';
import { UpdateAttendantDto } from '../shared/resources/dto/update-attendant.dto';
import { UpdateResourceStatusDto } from '../shared/resources/dto/update-resource-status.dto';

@ApiTags('institution-attendants')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/attendants')
export class InstitutionAttendantsController {
  constructor(private readonly attendants: AttendantsService) {}

  @Get()
  @ApiOperation({ summary: 'List institution attendants' })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: ListAttendantsQueryDto,
  ) {
    return this.attendants.list(institutionId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create an institution attendant' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: CreateAttendantDto,
  ) {
    return this.attendants.create(actorUserId, institutionId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one institution attendant' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attendants.getById(institutionId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an institution attendant' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAttendantDto,
  ) {
    return this.attendants.update(actorUserId, institutionId, id, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change institution attendant status' })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateResourceStatusDto,
  ) {
    return this.attendants.updateStatus(
      actorUserId,
      institutionId,
      id,
      body.status,
    );
  }
}
