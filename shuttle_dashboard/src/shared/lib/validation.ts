import { z } from "zod";

/**
 * The backend stores phones as sent and the login form always sends `+963…`, so local Syrian
 * mobiles (`09…`, `9…`, `963…`, `00963…`) must be saved in that same form to be able to sign in.
 */
export function toInternationalPhone(value: string) {
  const compact = value.replace(/[\s-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (/^0?9\d{8}$/.test(compact)) return `+963${compact.replace(/^0/, "")}`;
  if (/^9639\d{8}$/.test(compact)) return `+${compact}`;
  return compact;
}

/** Messages are keys of the `Validation` i18n namespace. */
export const v = {
  required: (min = 1) => z.string().trim().min(min, min > 1 ? `min${min}` : "required"),
  name: () => z.string().trim().min(2, "min2"),
  optionalText: () =>
    z
      .string()
      .trim()
      .transform((value) => value || undefined),
  phone: () =>
    z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s-]{6,}[0-9]$/, "phone")
      .transform(toInternationalPhone),
  optionalPhone: () =>
    z
      .string()
      .trim()
      .refine((value) => !value || /^\+?[0-9][0-9\s-]{6,}[0-9]$/.test(value), "phone")
      .transform((value) => (value ? toInternationalPhone(value) : undefined)),
  email: () => z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "email"),
  password: () => z.string().min(8, "password").max(72, "password"),
  optionalPassword: () =>
    z
      .string()
      .refine((value) => !value || (value.length >= 8 && value.length <= 72), "password")
      .transform((value) => value || undefined),
  optionalEmail: () =>
    z
      .string()
      .trim()
      .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "email")
      .transform((value) => value || undefined),
  hex: () => z.string().regex(/^#[0-9A-Fa-f]{6}$/, "hex"),
  date: () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
  optionalDate: () =>
    z
      .string()
      .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "date")
      .transform((value) => value || undefined),
  time: () => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time"),
  int: (min: number, max: number) =>
    z
      .string()
      .trim()
      .regex(/^\d+$/, "integer")
      .transform(Number)
      .refine((value) => value >= min && value <= max, `range:${min}:${max}`),
  optionalInt: (min: number, max: number) =>
    z
      .string()
      .trim()
      .refine((value) => !value || /^\d+$/.test(value), "integer")
      .transform((value) => (value ? Number(value) : undefined))
      .refine(
        (value) => value === undefined || (value >= min && value <= max),
        `range:${min}:${max}`,
      ),
  latitude: () => z.number({ message: "coords" }).min(-90, "coords").max(90, "coords"),
  longitude: () => z.number({ message: "coords" }).min(-180, "coords").max(180, "coords"),
  uuid: () => z.string().min(1, "required"),
};
