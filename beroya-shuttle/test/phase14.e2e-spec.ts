import { REQUIRED_JOB_NAMES } from '../src/infra/queue/jobs.catalog';

describe('phase14 catalog', () => {
  it('lists every scheduled job from the plan', () => {
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
    expect(REQUIRED_JOB_NAMES).toHaveLength(10);
  });
});
