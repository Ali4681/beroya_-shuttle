"use client";

import { useQuery } from "@tanstack/react-query";
import type { InstitutionBootstrap } from "@/domain/models/entities";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";

export function useInstitutionBootstrap() {
  return useQuery({
    queryKey: qk.institution.bootstrap,
    queryFn: institutionApi.bootstrap,
    staleTime: Infinity,
  });
}

/** Bootstrap data; only call below `InstitutionShell`, which renders children after it loads. */
export function useInstitution(): InstitutionBootstrap {
  const { data } = useInstitutionBootstrap();
  return data as InstitutionBootstrap;
}

export function useBranchOptions() {
  const { branches } = useInstitution();
  return branches.map((branch) => ({ value: branch.id, label: branch.name }));
}

/** Up to 100 routes (backend page cap) for filters and pickers. */
export function useRouteOptions(branchId?: string) {
  const query = { limit: 100, branchId };
  const routes = useQuery({
    queryKey: qk.institution.routes({ ...query, options: true }),
    queryFn: () => institutionApi.routes(query),
    staleTime: 60_000,
  });
  return (routes.data?.data ?? []).map((route) => ({ value: route.id, label: route.name }));
}

export function useBranchName() {
  const { branches } = useInstitution();
  return (id: string | null | undefined) => branches.find((branch) => branch.id === id)?.name ?? "—";
}
