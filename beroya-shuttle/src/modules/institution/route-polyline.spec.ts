import { TripDirection } from '../../generated/prisma/client';
import {
  mapRoutePolylineFields,
  routeNeedsPolylineRefresh,
} from './route-polyline';

describe('route polyline helpers', () => {
  it('maps outbound as primary polyline and both directions', () => {
    expect(
      mapRoutePolylineFields({
        polylineOutbound: 'abc',
        polylineInbound: 'def',
        polylinePrecision: 6,
      }),
    ).toEqual({
      polyline: 'abc',
      polylinePrecision: 6,
      polylines: { OUTBOUND: 'abc', INBOUND: 'def' },
    });
  });

  it('detects when refresh is needed', () => {
    expect(
      routeNeedsPolylineRefresh({
        polylineOutbound: null,
        polylineInbound: null,
        stops: [
          { direction: TripDirection.OUTBOUND },
          { direction: TripDirection.OUTBOUND },
        ],
      }),
    ).toBe(true);

    expect(
      routeNeedsPolylineRefresh({
        polylineOutbound: 'stored',
        polylineInbound: null,
        polylinePrecision: 6,
        stops: [
          { direction: TripDirection.OUTBOUND },
          { direction: TripDirection.OUTBOUND },
        ],
      }),
    ).toBe(false);

    // Stale precision 5 → regenerate at polyline6 quality
    expect(
      routeNeedsPolylineRefresh({
        polylineOutbound: 'old',
        polylineInbound: null,
        polylinePrecision: 5,
        stops: [
          { direction: TripDirection.OUTBOUND },
          { direction: TripDirection.OUTBOUND },
        ],
      }),
    ).toBe(true);
  });
});
