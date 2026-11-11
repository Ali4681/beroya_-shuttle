"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, PageSection, SearchInput } from "@/presentation/components/ui/panel";
import { EmptyState, QueryBoundary } from "@/presentation/components/ui/states";
import { SearchGroup, SearchRow } from "@/presentation/features/shared/search-parts";

export function AdminSearchView() {
  const t = useTranslations("Search");
  const router = useRouter();
  const q = useSearchParams().get("q")?.trim() ?? "";
  const typeLabel = useEnumLabel("institutionType");
  const ownerLabel = useEnumLabel("ownerType");

  const result = useQuery({
    queryKey: qk.admin.search(q),
    queryFn: () => adminApi.search(q),
    enabled: q.length >= 2,
  });

  return (
    <PageSection>
      <PageHeader icon="search" title={t("title")} subtitle={t("adminSubtitle")} />
      <SearchInput
        value={q}
        onChange={(value) => router.replace(value ? `/admin/search?q=${encodeURIComponent(value)}` : "/admin/search")}
        placeholder={t("adminPlaceholder")}
        className="max-w-[520px]"
      />
      {q.length < 2 ? (
        <Card>
          <EmptyState title={t("typeToSearch")} description={t("minChars")} />
        </Card>
      ) : (
        <QueryBoundary
          query={result}
          isEmpty={(data) => !data.institutions.length && !data.drivers.length && !data.vehicles.length}
          emptyTitle={t("noResults", { q })}
        >
          {(data) => (
            <div className="grid gap-4 lg:grid-cols-3">
              <SearchGroup title={t("institutions")} count={data.institutions.length}>
                {data.institutions.map((item) => (
                  <SearchRow
                    key={item.id}
                    href={`/admin/institutions/${item.id}`}
                    title={item.displayName || item.name}
                    meta={typeLabel(item.type)}
                    trailing={<StatusBadge status={item.status} />}
                  />
                ))}
              </SearchGroup>
              <SearchGroup title={t("drivers")} count={data.drivers.length}>
                {data.drivers.map((item) => (
                  <SearchRow
                    key={item.id}
                    href={item.institutionId ? `/admin/institutions/${item.institutionId}` : "/admin/drivers"}
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
                    href={item.institutionId ? `/admin/institutions/${item.institutionId}` : "/admin/vehicles"}
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
      <p className="text-xs text-text-muted">
        <Link href="/admin/institutions" className="hover:text-accent">
          {t("browseInstitutions")}
        </Link>
      </p>
    </PageSection>
  );
}
