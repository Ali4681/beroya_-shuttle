import { HttpStatus } from '@nestjs/common';
import { AppException } from '../errors/app.exception';

export function assertTimeZone(timeZone: string): void {
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format();
  } catch {
    throw new AppException(
      'INVALID_TIMEZONE',
      'timezone is not a valid IANA time zone',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export function todayInTimezone(timeZone: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${parts}T00:00:00.000Z`);
}

export function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function calendarDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isoWeekdayInTimezone(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[weekday] ?? 0;
}

export function clockInTimezone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

export function zonedDateTime(
  calendarDate: Date,
  timeHHmm: string,
  timeZone: string,
  extraMinutes = 0,
): Date {
  const ymd = calendarDateKey(calendarDate);
  const [hours, minutes] = timeHHmm.split(':').map(Number);
  const guess = new Date(
    `${ymd}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`,
  );
  const offsetMs = localOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offsetMs + extraMinutes * 60_000);
}

function localOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );
  return asUtc - date.getTime();
}

export function daysRemaining(endsAt: Date, now = new Date()): number {
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) {
    return 0;
  }
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
