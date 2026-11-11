export const REALTIME_NAMESPACE = '/realtime';

export const REALTIME_EVENTS = {
  TRIP_STARTED: 'trip.started',
  TRIP_COMPLETED: 'trip.completed',
  TRIP_CANCELLED: 'trip.cancelled',
  TRIP_LOCATION_UPDATED: 'trip.location.updated',
  TRIP_DELAY_DETECTED: 'trip.delay.detected',
  TRIP_DRIVER_CHANGED: 'trip.driver.changed',
  TRIP_VEHICLE_CHANGED: 'trip.vehicle.changed',
  TRIP_ATTENDANT_CHANGED: 'trip.attendant.changed',
  TRIP_ATTENDANT_BOARDED: 'trip.attendant_boarded',
  TRIP_STUDENT_STATUS_CHANGED: 'trip.student.status.changed',
  TRIP_STUDENT_ABSENT: 'trip.student.absent',
  TRIP_STOP_ARRIVED: 'trip.stop.arrived',
  TRIP_BREAKDOWN_CREATED: 'trip.breakdown.created',
  TRIP_EMERGENCY_CREATED: 'trip.emergency.created',
  INCIDENT_RESOLVED: 'incident.resolved',
  TRIP_TRACKING_STALE: 'trip.tracking.stale',
} as const;

export type RealtimeEvent =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export function institutionRoom(institutionId: string): string {
  return `institution:${institutionId}`;
}

export function tripRoom(tripId: string): string {
  return `trip:${tripId}`;
}

export function routeRoom(routeId: string): string {
  return `route:${routeId}`;
}

export const ADMIN_BEROYA_ROOM = 'admin:beroya';
