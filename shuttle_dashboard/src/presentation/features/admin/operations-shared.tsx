"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { OperatedInstitutionRef } from "@/domain/models/entities";
import { Link } from "@/i18n/navigation";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";

export function institutionLabel(institution: OperatedInstitutionRef | null | undefined) {
  return institution ? institution.displayName || institution.name : "—";
}

export function useInstitutionOptions() {
  const institutions = useQuery({
    queryKey: qk.admin.institutions({ all: true }),
    queryFn: adminApi.allInstitutions,
    staleTime: 5 * 60_000,
  });
  return (institutions.data ?? []).map((item) => ({ value: item.id, label: item.displayName || item.name }));
}

export function InstitutionLink({ institution }: { institution: OperatedInstitutionRef | null | undefined }) {
  if (!institution) return <>—</>;
  return (
    <Link
      href={`/admin/institutions/${institution.id}`}
      className="text-accent hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {institutionLabel(institution)}
    </Link>
  );
}

export function ReadOnlyHint() {
  const t = useTranslations("AdminOps");
  return <p className="text-start text-xs text-text-muted">{t("readOnlyHint")}</p>;
}
