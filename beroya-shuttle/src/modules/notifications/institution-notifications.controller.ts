import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { AudiencePreviewDto } from './dto/audience-preview.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { InstitutionNotificationsService } from './institution-notifications.service';

@ApiTags('institution-notifications')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/notifications')
export class InstitutionNotificationsController {
  constructor(private readonly notifications: InstitutionNotificationsService) {}

  @Post('audience-preview')
  @ApiOperation({ summary: 'Count recipients for an audience without sending' })
  preview(
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: AudiencePreviewDto,
  ) {
    return this.notifications.preview(institutionId, body);
  }

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Create a notification and enqueue FCM delivery' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: CreateNotificationDto,
  ) {
    return this.notifications.create(actorUserId, institutionId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Institution notification log' })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: PaginationDto,
  ) {
    return this.notifications.list(institutionId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Notification detail with recipients' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.getById(institutionId, id);
  }
}
