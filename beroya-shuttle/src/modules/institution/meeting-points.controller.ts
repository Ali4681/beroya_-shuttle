import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { UpdateResourceStatusDto } from '../shared/resources/dto/update-resource-status.dto';
import { CreateMeetingPointDto } from './dto/create-meeting-point.dto';
import { UpdateMeetingPointDto } from './dto/update-meeting-point.dto';
import { MeetingPointsService } from './meeting-points.service';

@ApiTags('institution-meeting-points')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/meeting-points')
export class MeetingPointsController {
  constructor(private readonly meetingPoints: MeetingPointsService) {}

  @Get()
  @ApiOperation({ summary: 'List meeting points' })
  list(@CurrentUser('institutionId') institutionId: string) {
    return this.meetingPoints.list(institutionId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a meeting point' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: CreateMeetingPointDto,
  ) {
    return this.meetingPoints.create(actorUserId, institutionId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one meeting point' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.meetingPoints.getById(institutionId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update meeting point name or location' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMeetingPointDto,
  ) {
    return this.meetingPoints.update(actorUserId, institutionId, id, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or suspend a meeting point' })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateResourceStatusDto,
  ) {
    return this.meetingPoints.updateStatus(
      actorUserId,
      institutionId,
      id,
      body.status,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete a meeting point when no active students use it',
  })
  remove(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.meetingPoints.remove(actorUserId, institutionId, id);
  }
}
