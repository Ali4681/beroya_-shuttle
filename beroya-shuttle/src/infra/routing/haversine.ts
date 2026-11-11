import { CITY_SPEED_MPS, EtaLeg, LatLng } from './routing.types';

export function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(from: LatLng, to: LatLng): number {
  const radius = 6_371_000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function haversineEta(from: LatLng, to: LatLng): EtaLeg {
  const distanceMeters = haversineMeters(from, to);
  return {
    distanceMeters,
    durationSeconds: distanceMeters / CITY_SPEED_MPS,
  };
}

export function pathDistance(points: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += haversineMeters(points[i], points[i + 1]);
  }
  return total;
}

export function nearestNeighborOrder<T extends { id: string; point: LatLng }>(
  origin: LatLng,
  stops: T[],
): T[] {
  const remaining = [...stops].sort((a, b) => a.id.localeCompare(b.id));
  const ordered: T[] = [];
  let current = origin;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const distance = haversineMeters(current, remaining[i].point);
      const candidate = remaining[i];
      const best = remaining[bestIndex];
      if (
        distance < bestDistance - 1e-9 ||
        (Math.abs(distance - bestDistance) <= 1e-9 &&
          candidate.id.localeCompare(best.id) < 0)
      ) {
        bestIndex = i;
        bestDistance = distance;
      }
    }
    const next = remaining.splice(bestIndex, 1)[0];
    ordered.push(next);
    current = next.point;
  }
  return ordered;
}

export function twoOptImprove<T extends { point: LatLng }>(stops: T[]): T[] {
  const ordered = [...stops];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < ordered.length - 1; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const current = segmentCost(ordered, i, j, false);
        const swapped = segmentCost(ordered, i, j, true);
        if (swapped + 1e-9 < current) {
          reverseRange(ordered, i, j);
          improved = true;
          break;
        }
      }
      if (improved) {
        break;
      }
    }
  }
  return ordered;
}

function segmentCost<T extends { point: LatLng }>(
  stops: T[],
  i: number,
  j: number,
  reversed: boolean,
): number {
  const slice = stops.slice(i, j + 1);
  if (reversed) {
    slice.reverse();
  }
  return pathDistance(slice.map((stop) => stop.point));
}

function reverseRange<T>(items: T[], start: number, end: number): void {
  while (start < end) {
    const tmp = items[start];
    items[start] = items[end];
    items[end] = tmp;
    start += 1;
    end -= 1;
  }
}
