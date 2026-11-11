import { ERROR_CATALOG } from './error-catalog';
import { parseAppLocale } from './locale';

describe('parseAppLocale', () => {
  it('prefers x-locale over Accept-Language', () => {
    expect(parseAppLocale('en', 'ar-SY,en;q=0.8')).toBe('en');
  });

  it('reads the first supported Accept-Language tag', () => {
    expect(parseAppLocale('fr-FR,ar-SY;q=0.9,en;q=0.8')).toBe('ar');
  });

  it('defaults to Arabic', () => {
    expect(parseAppLocale(undefined, '')).toBe('ar');
  });
});

describe('ERROR_CATALOG', () => {
  it('covers core auth and validation codes in both languages', () => {
    for (const code of ['UNAUTHORIZED', 'VALIDATION_ERROR', 'INVALID_CREDENTIALS']) {
      expect(ERROR_CATALOG[code].ar.length).toBeGreaterThan(0);
      expect(ERROR_CATALOG[code].en.length).toBeGreaterThan(0);
      expect(ERROR_CATALOG[code].ar).not.toBe(ERROR_CATALOG[code].en);
    }
  });
});
