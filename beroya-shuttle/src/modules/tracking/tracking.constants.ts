export const LIVE_LOCATION_TTL_SECONDS = 10 * 60;
export const ETA_CACHE_TTL_SECONDS = 60;
export const LOCATION_EMIT_TTL_SECONDS = 5;
export const SAMPLE_INTERVAL_MS = 30_000;
export const MIRROR_INTERVAL_MS = 60_000;
export const PING_RETENTION_DAYS = 14;

export function tripLocKey(tripId: string): string {
  return `trip:${tripId}:loc`;
}

export function institutionLiveKey(institutionId: string): string {
  return `institution:${institutionId}:live`;
}

export function tripEtaKey(tripId: string): string {
  return `trip:${tripId}:eta`;
}

export function tripEmitKey(tripId: string): string {
  return `trip:${tripId}:loc:emit`;
}

export function tripSampledKey(tripId: string): string {
  return `trip:${tripId}:sampled_at`;
}

export function tripMirroredKey(tripId: string): string {
  return `trip:${tripId}:mirrored_at`;
}

export function tripTrackingLostKey(tripId: string): string {
  return `trip:${tripId}:tracking_lost`;
}
