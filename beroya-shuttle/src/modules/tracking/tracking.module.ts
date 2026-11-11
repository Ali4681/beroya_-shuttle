import { Module } from '@nestjs/common';
import { DelayDetectionService } from './delay-detection.service';
import { DriverTripsController } from './driver-trips.controller';
import { EtaService } from './eta.service';
import { LiveLocationStore } from './live-location.store';
import { LiveMapController } from './live-map.controller';
import { TrackingService } from './tracking.service';

@Module({
  controllers: [DriverTripsController, LiveMapController],
  providers: [
    LiveLocationStore,
    EtaService,
    DelayDetectionService,
    TrackingService,
  ],
  exports: [
    LiveLocationStore,
    EtaService,
    DelayDetectionService,
    TrackingService,
  ],
})
export class TrackingModule {}
