export function localeTag(locale: string) {
  return locale === "ar" ? "ar-SY-u-nu-latn" : "en-GB";
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date | null | undefined, locale: string) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Service dates are stored as UTC midnight; format them in UTC to avoid shifting the day. */
export function formatServiceDate(value: string | null | undefined, locale: string) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined, locale: string) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(value: string | Date | null | undefined, locale: string) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatNumber(value: number | string | null | undefined, locale: string) {
  if (value === null || value === undefined || value === "") return "—";
  const number = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(number)) return String(value);
  return new Intl.NumberFormat(localeTag(locale)).format(number);
}

export function formatMoney(amount: string | number, currency: string, locale: string) {
  const number = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(localeTag(locale), {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(number);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Adds calendar months to a YYYY-MM-DD date, keeping the day when the target month has it. */
export function addMonthsISO(value: string, months: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return todayISO(target);
}

/** ISO string → YYYY-MM-DD (UTC part), for prefilling date inputs. */
export function isoToDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export function compactId(id: string | null | undefined) {
  return id ? id.slice(0, 8) : "—";
}
