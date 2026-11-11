import { TripDirection } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RoutingService } from '../../infra/routing/routing.service';

export type RoutePolylineFields = {
  polyline: string | null;
  polylinePrecision: number;
  polylines: {
    OUTBOUND: string | null;
    INBOUND: string | null;
  };
};

export function mapRoutePolylineFields(route: {
  polylineOutbound?: string | null;
  polylineInbound?: string | null;
  polylinePrecision?: number | null;
}): RoutePolylineFields {
  const outbound = route.polylineOutbound?.trim() || null;
  const inbound = route.polylineInbound?.trim() || null;
  return {
    // Ticket preferred single field = outbound when present
    polyline: outbound,
    polylinePrecision: route.polylinePrecision ?? 6,
    polylines: {
      OUTBOUND: outbound,
      INBOUND: inbound,
    },
  };
}

/** Recompute and persist road polylines for both directions (OSRM). */
export async function refreshShuttleRoutePolylines(
  prisma: PrismaService,
  routing: RoutingService,
  routeId: string,
): Promise<RoutePolylineFields> {
  const route = await prisma.shuttleRoute.findFirst({
    where: { id: routeId, archivedAt: null },
    include: {
      stops: { orderBy: [{ direction: 'asc' }, { sequence: 'asc' }] },
    },
  });
  if (!route) {
    return mapRoutePolylineFields({});
  }

  const precision = 6;
  const outboundPoints = route.stops
    .filter((stop) => stop.direction === TripDirection.OUTBOUND)
    .map((stop) => ({ lat: stop.latitude, lng: stop.longitude }));
  const inboundPoints = route.stops
    .filter((stop) => stop.direction === TripDirection.INBOUND)
    .map((stop) => ({ lat: stop.latitude, lng: stop.longitude }));

  const [polylineOutbound, polylineInbound] = await Promise.all([
    routing.getEncodedRoutePolyline(outboundPoints, precision),
    routing.getEncodedRoutePolyline(inboundPoints, precision),
  ]);

  const updated = await prisma.shuttleRoute.update({
    where: { id: routeId },
    data: {
      polylineOutbound,
      polylineInbound,
      polylinePrecision: precision,
      polylineUpdatedAt: new Date(),
    },
    select: {
      polylineOutbound: true,
      polylineInbound: true,
      polylinePrecision: true,
    },
  });

  return mapRoutePolylineFields(updated);
}

/** Target encode precision for street-quality zoom (OSRM polyline6). */
export const ROUTE_POLYLINE_PRECISION = 6;

export function routeNeedsPolylineRefresh(route: {
  polylineOutbound?: string | null;
  polylineInbound?: string | null;
  polylinePrecision?: number | null;
  stops?: Array<{ direction: TripDirection }>;
}): boolean {
  const stops = route.stops ?? [];
  const outboundCount = stops.filter(
    (stop) => stop.direction === TripDirection.OUTBOUND,
  ).length;
  const inboundCount = stops.filter(
    (stop) => stop.direction === TripDirection.INBOUND,
  ).length;
  const stalePrecision =
    (route.polylinePrecision ?? 0) < ROUTE_POLYLINE_PRECISION &&
    Boolean(route.polylineOutbound?.trim() || route.polylineInbound?.trim());
  if (stalePrecision) {
    return true;
  }
  if (outboundCount >= 2 && !route.polylineOutbound?.trim()) {
    return true;
  }
  if (inboundCount >= 2 && !route.polylineInbound?.trim()) {
    return true;
  }
  return false;
}
