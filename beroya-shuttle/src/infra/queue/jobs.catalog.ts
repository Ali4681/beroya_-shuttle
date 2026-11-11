export type JobCadence =
  | { kind: 'cron'; pattern: string; note: string }
  | { kind: 'every'; ms: number; note: string }
  | { kind: 'event'; note: string };

export type JobDefinition = {
  name: string;
  queue: 'trips' | 'tracking' | 'billing' | 'notifications' | 'location-pings';
  cadence: JobCadence;
};

export const JOB_CATALOG: JobDefinition[] = [
  {
    name: 'generate-trips',
    queue: 'trips',
    cadence: {
      kind: 'cron',
      pattern: '* * * * *',
      note: 'Runs minutely; executes at 23:30 in each institution timezone',
    },
  },
  {
    name: 'generate-trips-safety-net',
    queue: 'trips',
    cadence: {
      kind: 'cron',
      pattern: '* * * * *',
      note: 'Same worker as generate-trips; executes at 05:00 local time',
    },
  },
  {
    name: 'detect-delays',
    queue: 'tracking',
    cadence: {
      kind: 'every',
      ms: 60_000,
      note: 'Delay detection + one-shot alert',
    },
  },
  {
    name: 'arrival-alerts',
    queue: 'tracking',
    cadence: { kind: 'every', ms: 60_000, note: 'Parent arrival-soon alerts' },
  },
  {
    name: 'flush-location-pings',
    queue: 'location-pings',
    cadence: {
      kind: 'every',
      ms: 30_000,
      note: 'Persist Redis GPS samples to Postgres',
    },
  },
  {
    name: 'expire-subscriptions',
    queue: 'billing',
    cadence: {
      kind: 'cron',
      pattern: '30 0 * * *',
      note: 'ACTIVE → EXPIRED at 00:30 UTC',
    },
  },
  {
    name: 'reset-stopped-today-routes',
    queue: 'trips',
    cadence: {
      kind: 'cron',
      pattern: '* * * * *',
      note: 'STOPPED_TODAY → ACTIVE at 00:05 local time',
    },
  },
  {
    name: 'send-notifications',
    queue: 'notifications',
    cadence: { kind: 'event', note: 'FCM dispatch after notification create' },
  },
  {
    name: 'cleanup-location-pings',
    queue: 'tracking',
    cadence: {
      kind: 'cron',
      pattern: '0 3 * * 0',
      note: 'Delete pings older than 14 days',
    },
  },
  {
    name: 'cleanup-sessions',
    queue: 'billing',
    cadence: {
      kind: 'cron',
      pattern: '15 0 * * *',
      note: 'Delete expired sessions daily',
    },
  },
];

export const REQUIRED_JOB_NAMES = JOB_CATALOG.map((job) => job.name);
