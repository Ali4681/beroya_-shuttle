import { Global, Module } from '@nestjs/common';
import { HaversineFallbackProvider } from './haversine.provider';
import { OsrmRoutingProvider } from './osrm.provider';
import { RoutingService } from './routing.service';

@Global()
@Module({
  providers: [HaversineFallbackProvider, OsrmRoutingProvider, RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
