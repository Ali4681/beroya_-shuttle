import { Injectable } from '@nestjs/common';
import { haversineEta } from './haversine';
import { EtaLeg, LatLng, RoutingProvider } from './routing.types';

@Injectable()
export class HaversineFallbackProvider implements RoutingProvider {
  async getEta(from: LatLng, to: LatLng[]): Promise<EtaLeg[]> {
    return to.map((point) => haversineEta(from, point));
  }
}
