"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, PageSection, SearchInput } from "@/presentation/components/ui/panel";
import { EmptyState, QueryBoundary } from "@/presentation/components/ui/states";
import { useBranchName } from "@/presentation/features/institution/use-institution";
import { SearchGroup, SearchRow } from "@/presentation/features/shared/search-parts";

export function InstitutionSearchView() {
  const t = useTranslations("Search");
  const router = useRouter();
  const branchName = useBranchName();
  const ownerLabel = useEnumLabel("ownerType");
  const q = useSearchParams().get("q")?.trim() ?? "";

  const result = useQuery({
    queryKey: qk.institution.search(q),
    queryFn: () => institutionApi.search(q),
    enabled: q.length >= 2,
  });

  return (
    <PageSection>
      <PageHeader icon="search" title={t("title")} subtitle={t("institutionSubtitle")} />
      <SearchInput
        value={q}
        onChange={(value) => router.replace(value ? `/institution/search?q=${encodeURIComponent(value)}` : "/institution/search")}
        placeholder={t("institutionPlaceholder")}
        className="max-w-[520px]"
      />
      {q.length < 2 ? (
        <Card>
          <EmptyState title={t("typeToSearch")} description={t("minChars")} />
        </Card>
      ) : (
        <QueryBoundary
          query={result}
          isEmpty={(data) =>
            !data.students.length && !data.parents.length && !data.routes.length && !data.drivers.length && !data.vehicles.length
          }
          emptyTitle={t("noResults", { q })}
        >
          {(data) => (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              <SearchGroup title={t("students")} count={data.students.length}>
                {data.students.map((item) => (
                  <SearchRow
                    key={item.id}
                    href={`/institution/students/${item.id}`}
                    title={item.fullName}
                    meta={`${branchName(item.branchId)}${item.grade ? ` · ${item.grade}` : ""}`}
                    trailing={<StatusBadge status={item.status} />}
                  />
                ))}
              </SearchGroup>
              <SearchGroup title={t("parents")} count={data.parents.length}>
                {data.parents.map((item) => (
                  <SearchRow
                    key={item.id}
                    href={`/institution/parents?q=${encodeURIComponent(item.phone)}`}
                    title={item.fullName}
                    meta={<span dir="ltr">{item.phone}</span>}
                    trailing={<StatusBadge status={item.status} />}
                  />
                ))}
              </SearchGroup>
              <SearchGroup title={t("routes")} count={data.routes.length}>
                {data.routes.map((item) => (
                  <SearchRow
                    key={item.id}
                    href={`/institution/routes/${item.id}`}
                    title={item.name}
                    meta={`${branchName(item.branchId)}${item.code ? ` · ${item.code}` : ""}`}
                    trailing={<StatusBadge status={item.status} />}
                  />
                ))}
              </SearchGroup>
              <SearchGroup title={t("drivers")} count={data.drivers.length}>
                {data.drivers.map((item) => (
                  <SearchRow
                    key={item.id}
                    href="/institution/drivers"
                    title={item.fullName}
                    meta={<span dir="ltr">{item.phone}</span>}
                    trailing={<Chip tone={item.ownerType === "BEROYA" ? "info" : "muted"}>{ownerLabel(item.ownerType)}</Chip>}
                  />
                ))}
              </SearchGroup>
              <SearchGroup title={t("vehicles")} count={data.vehicles.length}>
                {data.vehicles.map((item) => (
                  <SearchRow
                    key={item.id}
                    href="/institution/vehicles"
                    title={<span dir="ltr">{item.plateNumber}</span>}
                    meta={item.vehicleType}
                    trailing={<StatusBadge status={item.status} />}
                  />
                ))}
              </SearchGroup>
            </div>
          )}
        </QueryBoundary>
      )}
    </PageSection>
  );
}
