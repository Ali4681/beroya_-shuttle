"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { Subscription } from "@/domain/models/entities";
import { BILLING_PERIODS, SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "@/domain/models/enums";
import { Link, useRouter } from "@/i18n/navigation";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { AppDatePicker } from "@/presentation/components/ui/app-date-picker";
import { StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable, type Column } from "@/presentation/components/ui/data-table";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, EnumFilterSelect, PageSection, Tabs, Toolbar } from "@/presentation/components/ui/panel";
import { SubscriptionActions } from "@/presentation/features/admin/subscription-dialogs";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { compactId, formatDate, formatMoney } from "@/shared/lib/format";

type Tab = "all" | "expiring";

export function SubscriptionsView() {
  const search = useSearchParams();
  const tab: Tab = search.get("tab") === "expiring" ? "expiring" : "all";
  const status = SUBSCRIPTION_STATUSES.find((value) => value === search.get("status"));
  return <SubscriptionsContent key={`${tab}:${status ?? ""}`} tab={tab} status={status} />;
}

function SubscriptionsContent({ tab, status }: { tab: Tab; status?: SubscriptionStatus }) {
  const t = useTranslations("Subscriptions");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const periodLabel = useEnumLabel("billingPeriod");
  const setTab = (next: Tab) =>
    router.replace(next === "expiring" ? "/admin/subscriptions?tab=expiring" : "/admin/subscriptions");
  const title =
    tab === "expiring"
      ? tNav("expiringSubscriptions")
      : status === "ACTIVE"
        ? tNav("currentSubscriptions")
        : status === "EXPIRED"
          ? tNav("expiredSubscriptions")
          : t("title");
  const { filters, setFilter, setPage, query } = useListParams({
    status: status as string | undefined,
    billingPeriod: undefined as string | undefined,
    startsFrom: undefined as string | undefined,
    endsTo: undefined as string | undefined,
  });

  const list = useQuery({
    queryKey: qk.admin.subscriptions(query),
    queryFn: () => adminApi.subscriptions(query),
    placeholderData: keepPreviousData,
    enabled: tab === "all",
  });
  const expiring = useQuery({
    queryKey: qk.admin.dashboardPart("expiring"),
    queryFn: adminApi.expiringSubscriptions,
    enabled: tab === "expiring",
  });
  const institutions = useQuery({
    queryKey: qk.admin.institutions({ all: true }),
    queryFn: adminApi.allInstitutions,
    staleTime: 5 * 60_000,
  });
  const institutionNames = new Map(
    (institutions.data ?? []).map((item) => [item.id, item.displayName || item.name]),
  );

  const columns: Column<Subscription>[] = [
    {
      key: "institution",
      header: t("institution"),
      cell: (row) => (
        <Link href={`/admin/institutions/${row.institutionId}`} className="cell-strong hover:text-accent">
          {row.institution?.displayName ||
            row.institution?.name ||
            institutionNames.get(row.institutionId) ||
            (institutions.isPending ? "…" : compactId(row.institutionId))}
        </Link>
      ),
    },
    { key: "period", header: t("billingPeriod"), cell: (row) => periodLabel(row.billingPeriod) },
    { key: "starts", header: t("startsAt"), cell: (row) => formatDate(row.startsAt, locale) },
    { key: "ends", header: t("endsAt"), cell: (row) => formatDate(row.endsAt, locale) },
    { key: "amount", header: t("agreedAmount"), cell: (row) => formatMoney(row.agreedAmount, row.currencyCode, locale) },
    { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
    { key: "actions", header: t("actions"), cell: (row) => <SubscriptionActions subscription={row} /> },
  ];

  return (
    <PageSection>
      <PageHeader icon="subscription" title={title} subtitle={t("subtitle")} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "all", label: t("all") },
          { id: "expiring", label: t("expiring30d") },
        ]}
      />
      <Card>
        {tab === "all" ? (
          <>
            <Toolbar>
              <EnumFilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => router.replace(value ? `/admin/subscriptions?status=${value}` : "/admin/subscriptions")} group="status" values={SUBSCRIPTION_STATUSES} />
              <EnumFilterSelect placeholder={t("billingPeriod")} value={filters.billingPeriod} onChange={(value) => setFilter("billingPeriod", value)} group="billingPeriod" values={BILLING_PERIODS} />
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                {t("startsFrom")}
                <AppDatePicker size="sm" clearable className="w-[200px]" value={filters.startsFrom ?? ""} onChange={(value) => setFilter("startsFrom", value || undefined)} />
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                {t("endsTo")}
                <AppDatePicker size="sm" clearable className="w-[200px]" value={filters.endsTo ?? ""} min={filters.startsFrom} onChange={(value) => setFilter("endsTo", value || undefined)} />
              </label>
            </Toolbar>
            <DataTable
              rows={list.data?.data}
              meta={list.data?.meta}
              onPageChange={setPage}
              isLoading={list.isPending}
              error={list.error}
              onRetry={() => list.refetch()}
              rowKey={(row) => row.id}
              emptyTitle={t("empty")}
              minWidth={980}
              columns={columns}
            />
          </>
        ) : (
          <DataTable
            rows={expiring.data}
            isLoading={expiring.isPending}
            error={expiring.error}
            onRetry={() => expiring.refetch()}
            rowKey={(row) => row.id}
            emptyTitle={t("noExpiring")}
            minWidth={980}
            columns={columns}
          />
        )}
      </Card>
    </PageSection>
  );
}
