import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';
import { HaversineFallbackProvider } from './haversine.provider';
import { OsrmRoutingProvider } from './osrm.provider';
import { EtaLeg, LatLng } from './routing.types';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly haversine: HaversineFallbackProvider,
    private readonly osrm: OsrmRoutingProvider,
  ) {}

  async getEta(from: LatLng, to: LatLng[]): Promise<EtaLeg[]> {
    if (to.length === 0) {
      return [];
    }
    if (!this.config.get('OSRM_BASE_URL', { infer: true })) {
      return this.haversine.getEta(from, to);
    }
    try {
      return await this.osrm.getEta(from, to);
    } catch (error) {
      this.osrm.logFallback(error);
      return this.haversine.getEta(from, to);
    }
  }

  async getPathLegs(points: LatLng[]): Promise<EtaLeg[]> {
    const legs: EtaLeg[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const [leg] = await this.getEta(points[i], [points[i + 1]]);
      legs.push(leg);
    }
    return legs;
  }

  /**
   * Encoded road-following polyline via OSRM /route.
   * Returns null when OSRM is unset/fails — never invents straight-line geometry.
   */
  async getEncodedRoutePolyline(
    points: LatLng[],
    precision = 6,
  ): Promise<string | null> {
    if (points.length < 2) {
      return null;
    }
    if (!this.config.get('OSRM_BASE_URL', { infer: true })) {
      this.logger.warn('OSRM_BASE_URL unset — route polyline left empty');
      return null;
    }
    try {
      return await this.osrm.getEncodedRoutePolyline(points, precision);
    } catch (error) {
      this.logger.warn(
        `OSRM route geometry failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }
}
