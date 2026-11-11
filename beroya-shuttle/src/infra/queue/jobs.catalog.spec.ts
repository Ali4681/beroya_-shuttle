import { REQUIRED_JOB_NAMES } from './jobs.catalog';

describe('jobs.catalog', () => {
  it('lists the ten Phase 14 jobs', () => {
    expect(REQUIRED_JOB_NAMES).toHaveLength(10);
    expect(REQUIRED_JOB_NAMES).toEqual(
      expect.arrayContaining([
        'generate-trips',
        'generate-trips-safety-net',
        'detect-delays',
        'arrival-alerts',
        'flush-location-pings',
        'expire-subscriptions',
        'reset-stopped-today-routes',
        'send-notifications',
        'cleanup-location-pings',
        'cleanup-sessions',
      ]),
    );
  });
});
