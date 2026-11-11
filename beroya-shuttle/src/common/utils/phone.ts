export const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,}[0-9]$/;

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, '');
}
