import type { ConnectionOptions } from 'bullmq';

export const QUEUE_CONNECTION = Symbol('QUEUE_CONNECTION');

export const QUEUE_NAMES = {
  DEFAULT: 'default',
  BILLING: 'billing',
  NOTIFICATIONS: 'notifications',
  LOCATION_PINGS: 'location-pings',
  TRIPS: 'trips',
  TRACKING: 'tracking',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export type MockQueueConnection = { mock: true };

export type QueueConnection = ConnectionOptions | MockQueueConnection;

export function isMockQueueConnection(
  connection: QueueConnection,
): connection is MockQueueConnection {
  return 'mock' in connection && connection.mock === true;
}
