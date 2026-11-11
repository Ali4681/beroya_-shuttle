import {
  adminKpiCacheKey,
  asInt,
  emptyAdminSearch,
  emptyInstitutionSearch,
  institutionSummaryCacheKey,
  sanitizeSearchTerm,
  searchLimit,
} from './insights.rules';

describe('insights.rules', () => {
  it('strips ILIKE wildcards and trims the search term', () => {
    expect(sanitizeSearchTerm('  ahm%_  ')).toBe('ahm');
    expect(sanitizeSearchTerm(undefined)).toBe('');
  });

  it('clamps search limit', () => {
    expect(searchLimit(undefined)).toBe(10);
    expect(searchLimit(0)).toBe(10);
    expect(searchLimit(3)).toBe(3);
    expect(searchLimit(100)).toBe(25);
  });

  it('builds KPI cache keys', () => {
    expect(institutionSummaryCacheKey('inst', '2026-10-03')).toBe(
      'kpi:institution:inst:summary:2026-10-03:all',
    );
    expect(institutionSummaryCacheKey('inst', '2026-10-03', 'b1')).toBe(
      'kpi:institution:inst:summary:2026-10-03:b1',
    );
    expect(adminKpiCacheKey('summary')).toBe('kpi:admin:summary');
    expect(adminKpiCacheKey('expiring', '30')).toBe('kpi:admin:expiring:30');
  });

  it('coerces SQL counts and empty search groups', () => {
    expect(asInt('4')).toBe(4);
    expect(asInt(null)).toBe(0);
    expect(Object.keys(emptyInstitutionSearch())).toEqual([
      'students',
      'parents',
      'routes',
      'drivers',
      'vehicles',
    ]);
    expect(Object.keys(emptyAdminSearch())).toEqual([
      'institutions',
      'drivers',
      'vehicles',
    ]);
    expect(asInt(Number.NaN)).toBe(0);
  });
});
