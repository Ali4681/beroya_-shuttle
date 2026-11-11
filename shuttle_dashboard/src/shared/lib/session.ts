import type { AuthTokens, User } from "@/domain/models/entities";
import type { Role } from "@/domain/models/enums";

export const SESSION_COOKIE = "beroya-session";
export const ROLE_COOKIE = "beroya-role";

const STORAGE_KEY = "beroya-auth";
const REMEMBERED_PHONE_KEY = "beroya-remembered-phone";
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;

export const PANEL_ROLES = ["BEROYA_ADMIN", "INSTITUTION_ADMIN"] as const;
export type PanelRole = (typeof PANEL_ROLES)[number];

export function isPanelRole(role: string | undefined | null): role is PanelRole {
  return PANEL_ROLES.includes(role as PanelRole);
}

export function homePathForRole(role: Role | string | undefined | null) {
  if (role === "BEROYA_ADMIN") return "/admin";
  if (role === "INSTITUTION_ADMIN") return "/institution";
  return "/login";
}

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: User;
  remember: boolean;
};

function storages() {
  if (typeof window === "undefined") return [];
  return [window.localStorage, window.sessionStorage];
}

export function readSession(): StoredSession | null {
  for (const storage of storages()) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as StoredSession;
    } catch {
      // Ignore unreadable storage and try the next one.
    }
  }
  return null;
}

function writeCookie(name: string, value: string, remember: boolean) {
  const maxAge = remember ? `; max-age=${REMEMBER_MAX_AGE}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax${maxAge}`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function saveSession(tokens: AuthTokens, remember: boolean) {
  const session: StoredSession = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: tokens.user,
    remember,
  };
  const [local, sessionStore] = storages();
  try {
    local?.removeItem(STORAGE_KEY);
    sessionStore?.removeItem(STORAGE_KEY);
    (remember ? local : sessionStore)?.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode); cookies still guard routing.
  }
  writeCookie(SESSION_COOKIE, "1", remember);
  writeCookie(ROLE_COOKIE, tokens.user.role, remember);
  return session;
}

export function updateSessionTokens(tokens: AuthTokens) {
  return saveSession(tokens, readSession()?.remember ?? true);
}

export function updateSessionUser(user: User) {
  const current = readSession();
  if (!current) return;
  const [local, sessionStore] = storages();
  try {
    (current.remember ? local : sessionStore)?.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...current, user }),
    );
  } catch {
    // Ignore storage failures.
  }
}

/** Survives logout on purpose so the login form can be prefilled. */
export function readRememberedPhone() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(REMEMBERED_PHONE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveRememberedPhone(phone: string | null) {
  try {
    if (phone) window.localStorage.setItem(REMEMBERED_PHONE_KEY, phone);
    else window.localStorage.removeItem(REMEMBERED_PHONE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function clearSession() {
  for (const storage of storages()) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }
  if (typeof document !== "undefined") {
    deleteCookie(SESSION_COOKIE);
    deleteCookie(ROLE_COOKIE);
  }
}
