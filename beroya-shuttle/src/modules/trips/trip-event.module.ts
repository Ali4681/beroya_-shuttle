import { Global, Module } from '@nestjs/common';
import { TripEventService } from './trip-event.service';

@Global()
@Module({
  providers: [TripEventService],
  exports: [TripEventService],
})
export class TripEventModule {}
