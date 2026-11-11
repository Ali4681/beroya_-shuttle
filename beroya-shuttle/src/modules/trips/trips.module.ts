import { Module, forwardRef } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module';
import { PassengerModule } from '../passenger/passenger.module';
import { RouteExceptionsService } from './route-exceptions.service';
import { TripGenerationService } from './trip-generation.service';
import { TripOpsService } from './trip-ops.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [TrackingModule, forwardRef(() => PassengerModule)],
  controllers: [TripsController],
  providers: [
    TripGenerationService,
    TripsService,
    TripOpsService,
    RouteExceptionsService,
  ],
  exports: [TripGenerationService, RouteExceptionsService],
})
export class TripsModule {}
