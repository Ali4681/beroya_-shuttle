import { Module } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module';
import {
  AttendantAppController,
  AttendantMeController,
} from './attendant-app.controller';
import { CrewService } from './crew.service';
import { DriverAppController, DriverMeController } from './driver-app.controller';

@Module({
  imports: [TrackingModule],
  controllers: [
    DriverMeController,
    DriverAppController,
    AttendantMeController,
    AttendantAppController,
  ],
  providers: [CrewService],
  exports: [CrewService],
})
export class CrewModule {}
