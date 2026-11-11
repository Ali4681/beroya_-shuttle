import {
  isGenerateSafetyNetWindow,
  isGenerateTomorrowWindow,
  isResetStoppedTodayWindow,
  localJobClock,
} from './job-windows';

describe('job-windows', () => {
  it('matches the scheduled local clocks', () => {
    expect(isGenerateTomorrowWindow('23:30')).toBe(true);
    expect(isGenerateTomorrowWindow('23:31')).toBe(false);
    expect(isGenerateSafetyNetWindow('05:00')).toBe(true);
    expect(isResetStoppedTodayWindow('00:05')).toBe(true);
    expect(isResetStoppedTodayWindow('00:06')).toBe(false);
  });

  it('formats a clock in the institution timezone', () => {
    const noonUtc = new Date('2026-10-03T09:00:00.000Z');
    expect(localJobClock(noonUtc, 'Asia/Damascus')).toBe('12:00');
  });
});
