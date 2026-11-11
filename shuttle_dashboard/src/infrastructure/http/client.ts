import type { AuthTokens, PageMeta, Paginated } from "@/domain/models/entities";
import { env } from "@/infrastructure/config/env";
import { keysToCamel, keysToSnake } from "@/infrastructure/http/case";
import { readSession, updateSessionTokens } from "@/shared/lib/session";

export type ApiErrorDetails = Record<string, unknown> & { errors?: unknown };

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ApiErrorDetails;

  constructor(code: string, status: number, message?: string, details?: ApiErrorDetails) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details ?? {};
  }

  get validationErrors(): string[] {
    const errors = this.details.errors;
    if (Array.isArray(errors)) return errors.map(String);
    return [];
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function requestLocale() {
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang?.toLowerCase() ?? "";
    if (lang.startsWith("en")) return "en";
    if (lang.startsWith("ar")) return "ar";
  }
  return "ar";
}

function languageHeaders(): Record<string, string> {
  const locale = requestLocale();
  return { "Accept-Language": locale, "X-Locale": locale };
}

type Query = Record<string, string | number | boolean | undefined>;

type RequestOptions = {
  query?: Query;
  body?: unknown;
  idempotencyKey?: string;
  /** Set false for public endpoints (OTP) so a 401 is not treated as session expiry. */
  auth?: boolean;
  signal?: AbortSignal;
};

type Envelope<T> = { data: T; meta?: PageMeta };

const SESSION_ENDING_CODES = new Set([
  "SESSION_REVOKED",
  "REFRESH_INVALID",
  "REFRESH_EXPIRED",
  "REFRESH_TOKEN_REUSED",
]);

let unauthorizedHandler: ((code: string) => void) | null = null;

export function setUnauthorizedHandler(handler: ((code: string) => void) | null) {
  unauthorizedHandler = handler;
}

function buildUrl(path: string, query?: Query) {
  const base = env.apiBase.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(keysToSnake<Query>(query))) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const error = keysToCamel<{ error?: { code?: string; message?: string; details?: ApiErrorDetails } }>(
    payload,
  )?.error;
  const fallback =
    status === 401
      ? "UNAUTHORIZED"
      : status === 403
        ? "FORBIDDEN"
        : status === 404
          ? "NOT_FOUND"
          : status === 429
            ? "RATE_LIMITED"
            : "INTERNAL_ERROR";
  return new ApiError(error?.code ?? fallback, status, error?.message, error?.details);
}

let refreshPromise: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const session = readSession();
    if (!session?.refreshToken) return null;

    const response = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...languageHeaders() },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (!response.ok) return null;

    const payload = keysToCamel<Envelope<AuthTokens>>(await parseBody(response));
    updateSessionTokens(payload.data);
    return payload.data.accessToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<Envelope<T>> {
  const session = options.auth === false ? null : readSession();
    const headers: Record<string, string> = { Accept: "application/json", ...languageHeaders() };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(keysToSnake(options.body)) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("NETWORK_ERROR", 0);
  }

  const payload = await parseBody(response);
  if (response.ok) return keysToCamel<Envelope<T>>(payload ?? { data: null });

  const error = toApiError(response.status, payload);

  if (response.status === 401 && options.auth !== false) {
    if (!SESSION_ENDING_CODES.has(error.code) && !retried && session?.refreshToken) {
      let token: string | null = null;
      try {
        token = await refreshAccessToken();
      } catch {
        throw new ApiError("NETWORK_ERROR", 0);
      }
      if (token) return request<T>(method, path, options, true);
    }
    unauthorizedHandler?.(error.code);
  }

  throw error;
}

export const http = {
  get<T>(path: string, query?: Query, signal?: AbortSignal) {
    return request<T>("GET", path, { query, signal }).then((res) => res.data);
  },
  getPublic<T>(path: string, query?: Query) {
    return request<T>("GET", path, { query, auth: false }).then((res) => res.data);
  },
  page<T>(path: string, query?: Query, signal?: AbortSignal): Promise<Paginated<T>> {
    return request<T[]>("GET", path, { query, signal }).then((res) => ({
      data: res.data ?? [],
      meta: res.meta ?? { page: 1, limit: res.data?.length ?? 0, total: res.data?.length ?? 0, totalPages: 1 },
    }));
  },
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) {
    return request<T>("POST", path, { ...options, body: body ?? {} }).then((res) => res.data);
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>("PATCH", path, { body: body ?? {} }).then((res) => res.data);
  },
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) {
    return request<T>("PUT", path, { ...options, body: body ?? {} }).then((res) => res.data);
  },
  delete<T>(path: string) {
    return request<T>("DELETE", path).then((res) => res.data);
  },
};

export function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
