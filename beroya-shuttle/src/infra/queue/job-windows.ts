import { clockInTimezone } from '../../common/utils/timezone';

export function isGenerateTomorrowWindow(hhmm: string): boolean {
  return hhmm === '23:30';
}

export function isGenerateSafetyNetWindow(hhmm: string): boolean {
  return hhmm === '05:00';
}

export function isResetStoppedTodayWindow(hhmm: string): boolean {
  return hhmm === '00:05';
}

export function localJobClock(now: Date, timeZone: string): string {
  return clockInTimezone(now, timeZone);
}
