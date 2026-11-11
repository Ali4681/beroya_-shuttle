import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import {
  ROLE_COOKIE,
  SESSION_COOKIE,
  homePathForRole,
  isPanelRole,
} from "./shared/lib/session";

const handleI18nRouting = createMiddleware(routing);

const LOGIN_PATH = "/login";
const PUBLIC_PATHS = new Set(["/", "/privacy-policy", "/terms-of-use"]);

const PANEL_ACCESS: Record<string, string> = {
  "/admin": "BEROYA_ADMIN",
  "/institution": "INSTITUTION_ADMIN",
};

function redirectTo(request: NextRequest, locale: string, path: string) {
  return NextResponse.redirect(new URL(`/${locale}${path}`, request.url));
}

export default function proxy(request: NextRequest) {
  const [, maybeLocale, ...rest] = request.nextUrl.pathname.split("/");
  const locale = routing.locales.find((item) => item === maybeLocale);

  // Unprefixed URLs get redirected to a locale first; the auth check runs on the follow-up request.
  if (!locale) return handleI18nRouting(request);

  const path = `/${rest.join("/")}`.replace(/\/$/, "") || "/";
  // Landing + legal docs stay public for everyone, signed in or not.
  if (PUBLIC_PATHS.has(path)) return handleI18nRouting(request);

  const isLoginPage = path === LOGIN_PATH;
  const role = request.cookies.get(ROLE_COOKIE)?.value;
  const hasSession = request.cookies.has(SESSION_COOKIE) && isPanelRole(role);

  if (!hasSession) {
    return isLoginPage ? handleI18nRouting(request) : redirectTo(request, locale, LOGIN_PATH);
  }

  const home = homePathForRole(role);
  if (isLoginPage) return redirectTo(request, locale, home);

  const panel = Object.keys(PANEL_ACCESS).find(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  if (!panel || PANEL_ACCESS[panel] !== role) return redirectTo(request, locale, home);

  return handleI18nRouting(request);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
