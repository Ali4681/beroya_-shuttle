const FCM_ROUTING_KEYS = [
  'type',
  'tripId',
  'routeId',
  'tripStudentId',
  'studentId',
] as const;

/** Prefer camelCase; accept legacy snake_case when reading stored data. */
const FCM_ROUTING_ALIASES: Record<(typeof FCM_ROUTING_KEYS)[number], string[]> = {
  type: ['type'],
  tripId: ['tripId', 'trip_id'],
  routeId: ['routeId', 'route_id'],
  tripStudentId: ['tripStudentId', 'trip_student_id'],
  studentId: ['studentId', 'student_id'],
};

function fcmStringField(
  data: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }
  return undefined;
}

/** Routing fields only — never dump full notification.data (i18n / 4KB FCM cap). */
export function buildFcmRoutingData(
  notificationId: string,
  origin: string,
  audience: string,
  locale: string,
  data: Record<string, unknown>,
  routeIdFallback?: string | null,
): Record<string, string> {
  const payload: Record<string, string> = {
    notificationId,
    origin,
    audience,
    locale,
  };
  for (const key of FCM_ROUTING_KEYS) {
    const value = fcmStringField(data, FCM_ROUTING_ALIASES[key]);
    if (value !== undefined) {
      payload[key] = value;
    }
  }
  if (!payload.routeId && typeof routeIdFallback === 'string' && routeIdFallback) {
    payload.routeId = routeIdFallback;
  }
  return payload;
}
