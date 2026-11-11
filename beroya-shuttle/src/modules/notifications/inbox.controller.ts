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
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { InstitutionNotificationsService } from './institution-notifications.service';

@ApiTags('parent-notifications')
@ApiBearerAuth()
@Roles(ShuttleRole.PARENT)
@Controller('parent/notifications')
export class ParentNotificationsController {
  constructor(private readonly notifications: InstitutionNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Parent notification inbox' })
  list(@CurrentUser('sub') userId: string, @Query() query: PaginationDto) {
    return this.notifications.inbox(userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one parent inbox notification',
    description:
      'Accepts inbox recipient id or notification id (FCM notificationId). 404 if not owned by the current user.',
  })
  getOne(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.inboxById(userId, id);
  }

  @Patch('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark all parent inbox notifications as read' })
  markAllRead(@CurrentUser('sub') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Patch(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark one parent inbox notification as read' })
  markRead(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(userId, id);
  }
}

@ApiTags('university-notifications')
@ApiBearerAuth()
@Roles(ShuttleRole.UNIVERSITY_STUDENT)
@Controller('university/notifications')
export class UniversityNotificationsController {
  constructor(private readonly notifications: InstitutionNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'University student notification inbox' })
  list(@CurrentUser('sub') userId: string, @Query() query: PaginationDto) {
    return this.notifications.inbox(userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one university inbox notification',
    description:
      'Accepts inbox recipient id or notification id (FCM notificationId). 404 if not owned by the current user.',
  })
  getOne(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.inboxById(userId, id);
  }

  @Patch('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark all university inbox notifications as read' })
  markAllRead(@CurrentUser('sub') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Patch(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark one university inbox notification as read' })
  markRead(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(userId, id);
  }
}

@ApiTags('driver-notifications')
@ApiBearerAuth()
@Roles(ShuttleRole.DRIVER)
@Controller('driver/notifications')
export class DriverNotificationsController {
  constructor(private readonly notifications: InstitutionNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Driver notification inbox' })
  list(@CurrentUser('sub') userId: string, @Query() query: PaginationDto) {
    return this.notifications.inbox(userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one driver inbox notification',
    description:
      'Accepts inbox recipient id or notification id (FCM notificationId). 404 if not owned by the current user.',
  })
  getOne(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.inboxById(userId, id);
  }

  @Patch('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark all driver inbox notifications as read' })
  markAllRead(@CurrentUser('sub') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Patch(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark one driver inbox notification as read' })
  markRead(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(userId, id);
  }
}

@ApiTags('attendant-notifications')
@ApiBearerAuth()
@Roles(ShuttleRole.ATTENDANT)
@Controller('attendant/notifications')
export class AttendantNotificationsController {
  constructor(private readonly notifications: InstitutionNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Attendant notification inbox' })
  list(@CurrentUser('sub') userId: string, @Query() query: PaginationDto) {
    return this.notifications.inbox(userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one attendant inbox notification',
    description:
      'Accepts inbox recipient id or notification id (FCM notificationId). 404 if not owned by the current user.',
  })
  getOne(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.inboxById(userId, id);
  }

  @Patch('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark all attendant inbox notifications as read' })
  markAllRead(@CurrentUser('sub') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Patch(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark one attendant inbox notification as read' })
  markRead(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(userId, id);
  }
}
