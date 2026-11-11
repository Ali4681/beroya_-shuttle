import { Global, Module } from '@nestjs/common';
import { ArrivalAlertService } from '../../notifications/arrival-alert.service';
import { InstitutionNotificationsController } from '../../notifications/institution-notifications.controller';
import { InstitutionNotificationsService } from '../../notifications/institution-notifications.service';
import {
  AttendantNotificationsController,
  DriverNotificationsController,
  ParentNotificationsController,
  UniversityNotificationsController,
} from '../../notifications/inbox.controller';
import { NotificationAudienceService } from '../../notifications/notification-audience.service';
import { NotificationDispatchService } from '../../notifications/notification-dispatch.service';
import { NotificationService } from './notification.service';

@Global()
@Module({
  controllers: [
    InstitutionNotificationsController,
    ParentNotificationsController,
    UniversityNotificationsController,
    DriverNotificationsController,
    AttendantNotificationsController,
  ],
  providers: [
    NotificationAudienceService,
    NotificationDispatchService,
    ArrivalAlertService,
    InstitutionNotificationsService,
    NotificationService,
  ],
  exports: [
    NotificationAudienceService,
    NotificationDispatchService,
    ArrivalAlertService,
    NotificationService,
  ],
})
export class NotificationModule {}
