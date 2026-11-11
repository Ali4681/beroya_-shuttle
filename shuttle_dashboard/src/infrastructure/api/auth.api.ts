import type { AuthTokens, User } from "@/domain/models/entities";
import { http } from "@/infrastructure/http/client";

export const authApi = {
  login(email: string, password: string) {
    return http.post<AuthTokens>("/auth/login", { email, password }, { auth: false });
  },
  requestOtp(phone: string) {
    return http.post<{ expiresIn: number }>("/auth/otp/request", { phone }, { auth: false });
  },
  verifyOtp(phone: string, code: string) {
    return http.post<AuthTokens>("/auth/otp/verify", { phone, code }, { auth: false });
  },
  me() {
    return http.get<User>("/auth/me");
  },
  logout() {
    return http.post<{ success: true }>("/auth/logout");
  },
  logoutAll() {
    return http.post<{ success: true }>("/auth/logout-all");
  },
};

export const COUNTRY_CODE = "+963";

/** Syrian mobile typed locally: `0912345678` or `912345678`. */
export const LOCAL_PHONE_PATTERN = /^0?9\d{8}$/;

/** Keeps digits only and drops a pasted `+963` / `00963` country code. */
export function localPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("00963")) return digits.slice(5);
  if (digits.startsWith("963") && digits.length > 10) return digits.slice(3);
  return digits;
}

export function toInternationalPhone(local: string) {
  return `${COUNTRY_CODE}${localPhoneDigits(local).replace(/^0/, "")}`;
}
