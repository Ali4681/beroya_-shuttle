import { keysToCamelCase, keysToSnakeCase } from './case-transform';

describe('case-transform', () => {
  it('converts nested objects to snake_case', () => {
    expect(
      keysToSnakeCase({
        totalPages: 7,
        checks: { latencyMs: 12 },
      }),
    ).toEqual({
      total_pages: 7,
      checks: { latency_ms: 12 },
    });
  });

  it('converts nested objects to camelCase', () => {
    expect(
      keysToCamelCase({
        institution_id: 'abc',
        meeting_point: { address_label: 'home' },
      }),
    ).toEqual({
      institutionId: 'abc',
      meetingPoint: { addressLabel: 'home' },
    });
  });
});
