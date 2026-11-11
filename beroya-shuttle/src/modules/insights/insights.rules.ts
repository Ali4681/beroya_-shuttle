import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  MAX_SEARCH_TERM_LENGTH,
} from './insights.constants';

export function sanitizeSearchTerm(raw: string | undefined): string {
  return (raw ?? '')
    .trim()
    .replace(/[%_]/g, '')
    .slice(0, MAX_SEARCH_TERM_LENGTH);
}

export function searchLimit(raw?: number): number {
  if (!raw || Number.isNaN(raw)) {
    return DEFAULT_SEARCH_LIMIT;
  }
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.floor(raw)));
}

export function institutionSummaryCacheKey(
  institutionId: string,
  dateKey: string,
  branchId?: string,
): string {
  return `kpi:institution:${institutionId}:summary:${dateKey}:${branchId ?? 'all'}`;
}

export function adminKpiCacheKey(part: string, suffix = ''): string {
  return suffix ? `kpi:admin:${part}:${suffix}` : `kpi:admin:${part}`;
}

export function asInt(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function emptyInstitutionSearch() {
  return {
    students: [] as unknown[],
    parents: [] as unknown[],
    routes: [] as unknown[],
    drivers: [] as unknown[],
    vehicles: [] as unknown[],
  };
}

export function emptyAdminSearch() {
  return {
    institutions: [] as unknown[],
    drivers: [] as unknown[],
    vehicles: [] as unknown[],
  };
}
