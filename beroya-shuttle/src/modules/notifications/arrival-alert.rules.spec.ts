import {
  normalizeArrivalMinutes,
  shouldSendArrivalAlert,
} from './arrival-alert.rules';

describe('arrival-alert.rules', () => {
  const now = new Date('2026-10-03T07:30:00.000Z');

  it('accepts only 5 / 10 / 15 minute windows', () => {
    expect(normalizeArrivalMinutes(5)).toBe(5);
    expect(normalizeArrivalMinutes(12)).toBe(10);
    expect(normalizeArrivalMinutes(null)).toBe(10);
  });

  it('alerts when the stop ETA is inside the parent window', () => {
    expect(
      shouldSendArrivalAlert(new Date('2026-10-03T07:38:00.000Z'), 10, now),
    ).toBe(true);
    expect(
      shouldSendArrivalAlert(new Date('2026-10-03T07:45:00.000Z'), 10, now),
    ).toBe(false);
    expect(
      shouldSendArrivalAlert(new Date('2026-10-03T07:20:00.000Z'), 10, now),
    ).toBe(false);
    expect(shouldSendArrivalAlert(null, 10, now)).toBe(false);
  });
});
