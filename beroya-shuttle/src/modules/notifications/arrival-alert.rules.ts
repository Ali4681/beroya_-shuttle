export const ARRIVAL_MINUTES = [5, 10, 15] as const;

export function normalizeArrivalMinutes(
  value: number | null | undefined,
): number {
  if (value && (ARRIVAL_MINUTES as readonly number[]).includes(value)) {
    return value;
  }
  return 10;
}

export function shouldSendArrivalAlert(
  etaAt: Date | null | undefined,
  minutesBefore: number,
  now = new Date(),
): boolean {
  if (!etaAt) {
    return false;
  }
  const remainingMs = etaAt.getTime() - now.getTime();
  if (remainingMs < -60_000) {
    return false;
  }
  return remainingMs <= minutesBefore * 60_000;
}
