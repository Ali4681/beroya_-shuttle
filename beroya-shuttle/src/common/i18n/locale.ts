import { AppLocale } from './error-catalog';

const LOCALES = new Set<AppLocale>(['ar', 'en']);

function tagToLocale(value: string): AppLocale | undefined {
  const tag = value.trim().toLowerCase();
  if (!tag) return undefined;
  if (tag === 'ar' || tag.startsWith('ar-')) return 'ar';
  if (tag === 'en' || tag.startsWith('en-')) return 'en';
  return undefined;
}

export function parseAppLocale(
  ...candidates: Array<string | string[] | undefined | null>
): AppLocale {
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const parts = Array.isArray(candidate)
      ? candidate.map(String)
      : typeof candidate === 'string'
        ? candidate.split(',')
        : null;
    if (!parts) continue;
    for (const part of parts) {
      const locale = tagToLocale(part.split(';')[0] ?? '');
      if (locale && LOCALES.has(locale)) return locale;
    }
  }
  return 'ar';
}

export function localeFromRequest(request: {
  header?(name: string): string | undefined;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  handshake?: { headers?: Record<string, unknown>; query?: Record<string, unknown> };
}): AppLocale {
  const read = (value: unknown) => {
    if (Array.isArray(value)) return String(value[0] ?? '');
    if (value == null) return undefined;
    return String(value);
  };
  const header = (name: string) => {
    if (typeof request.header === 'function') return request.header(name);
    return read(request.headers?.[name] ?? request.headers?.[name.toLowerCase()]);
  };
  const query = request.query ?? request.handshake?.query ?? {};
  const handshakeHeader = (name: string) =>
    read(request.handshake?.headers?.[name] ?? request.handshake?.headers?.[name.toLowerCase()]);

  return parseAppLocale(
    header('x-locale'),
    header('x-language'),
    typeof query.lang === 'string' ? query.lang : undefined,
    typeof query.locale === 'string' ? query.locale : undefined,
    header('accept-language'),
    handshakeHeader('x-locale'),
    handshakeHeader('x-language'),
    handshakeHeader('accept-language'),
  );
}
