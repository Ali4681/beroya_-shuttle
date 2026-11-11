"use client";

import { useCallback, useState } from "react";

export const PAGE_SIZE = 20;

type Filters = Record<string, string | undefined>;

/** Page + filter state for paginated lists; changing a filter resets to page 1. */
export function useListParams<F extends Filters>(initial: F) {
  const [filters, setFilters] = useState<F>(initial);
  const [page, setPage] = useState(1);

  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }, []);

  const query: Record<string, string | number | undefined> = { page, limit: PAGE_SIZE };
  for (const [key, value] of Object.entries(filters)) {
    if (value) query[key] = value;
  }

  return { filters, setFilter, page, setPage, query };
}
