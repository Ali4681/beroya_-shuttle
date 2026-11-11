"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { useEnumLabel, StatusBadge } from "@/presentation/components/ui/badge";
import { DistributionBars } from "@/presentation/components/ui/charts";
import { DataTable } from "@/presentation/components/ui/data-table";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, PageSection, StatCard, StatGrid } from "@/presentation/components/ui/panel";
import { ErrorState, QueryBoundary } from "@/presentation/components/ui/states";
import { formatDate, formatNumber } from "@/shared/lib/format";

export function AdminDashboardView() {
  const t = useTranslations("AdminDashboard");
  const locale = useLocale();
  const typeLabel = useEnumLabel("institutionType");
  const modelLabel = useEnumLabel("operationModel");
  const statusLabel = useEnumLabel("status");

  const summary = useQuery({ queryKey: qk.admin.dashboardPart("summary"), queryFn: adminApi.dashboardSummary });
  const distribution = useQuery({
    queryKey: qk.admin.dashboardPart("distribution"),
    queryFn: adminApi.distribution,
  });
  const recent = useQuery({ queryKey: qk.admin.dashboardPart("recent"), queryFn: adminApi.recentInstitutions });
  const expiring = useQuery({
    queryKey: qk.admin.dashboardPart("expiring"),
    queryFn: adminApi.expiringSubscriptions,
  });
  const operations = useQuery({
    queryKey: qk.admin.dashboardPart("operations"),
    queryFn: adminApi.operations,
  });

  const s = summary.data;
  const n = (value: number | undefined) => formatNumber(value ?? 0, locale);

  return (
    <PageSection>
      <PageHeader icon="home" title={t("title")} subtitle={t("subtitle")} />

      {summary.isError ? (
        <Card>
          <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
        </Card>
      ) : (
        <StatGrid>
          <StatCard icon="building" label={t("institutionsTotal")} value={n(s?.institutionsTotal)} loading={summary.isPending} />
          <StatCard icon="subscription" tone="success" label={t("activeSubscriptions")} value={n(s?.activeSubscriptions)} loading={summary.isPending} />
          <StatCard icon="subscription" tone="warning" label={t("pendingSubscriptions")} value={n(s?.pendingSubscriptions)} loading={summary.isPending} />
          <StatCard icon="history" tone="danger" label={t("expiring30d")} value={n(s?.expiringSubscriptions30d)} loading={summary.isPending} />
          <StatCard icon="driver" label={t("beroyaDrivers")} value={n(s?.beroyaDrivers)} loading={summary.isPending} />
          <StatCard icon="vehicle" label={t("beroyaVehicles")} value={n(s?.beroyaVehicles)} loading={summary.isPending} />
          <StatCard icon="car" label={t("tripsToday")} value={n(s?.tripsToday)} loading={summary.isPending} />
          <StatCard icon="live" tone="success" label={t("tripsInProgress")} value={n(s?.tripsInProgress)} loading={summary.isPending} />
        </StatGrid>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {(
          [
            ["byType", typeLabel],
            ["byOperationModel", modelLabel],
            ["byStatus", statusLabel],
          ] as const
        ).map(([key, label]) => (
          <Card key={key} title={t(key)}>
            <QueryBoundary
              query={distribution}
              loadingRows={3}
              isEmpty={(data) => data[key].length === 0}
            >
              {(data) => (
                <DistributionBars
                  data={data[key].map((row) => ({ label: label(row.key), count: row.count }))}
                />
              )}
            </QueryBoundary>
          </Card>
        ))}
      </div>

      <Card title={t("operations")}>
        <p className="-mt-2 text-start text-xs text-text-muted">{t("operationsHint")}</p>
        <DataTable
          rows={operations.data}
          isLoading={operations.isPending}
          error={operations.error}
          onRetry={() => operations.refetch()}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "name",
              header: t("institution"),
              cell: (row) => (
                <Link href={`/admin/institutions/${row.id}`} className="cell-strong hover:text-accent">
                  {row.displayName || row.name}
                </Link>
              ),
            },
            { key: "model", header: t("model"), cell: (row) => modelLabel(row.operationModel) },
            { key: "today", header: t("todayTrips"), cell: (row) => n(row.todayTrips) },
            { key: "progress", header: t("inProgress"), cell: (row) => n(row.inProgress) },
            {
              key: "delayed",
              header: t("delayed"),
              cell: (row) => <span className={row.delayed ? "font-semibold text-warning" : ""}>{n(row.delayed)}</span>,
            },
            {
              key: "incidents",
              header: t("openIncidents"),
              cell: (row) => (
                <span className={row.openIncidents ? "font-semibold text-danger" : ""}>{n(row.openIncidents)}</span>
              ),
            },
            { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title={t("recentInstitutions")}
          actions={
            <Link href="/admin/institutions" className="btn btn-ghost btn-sm">
              {t("viewAll")}
            </Link>
          }
        >
          <DataTable
            minWidth={480}
            rows={recent.data}
            isLoading={recent.isPending}
            error={recent.error}
            onRetry={() => recent.refetch()}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "name",
                header: t("institution"),
                cell: (row) => (
                  <Link href={`/admin/institutions/${row.id}`} className="cell-strong hover:text-accent">
                    {row.displayName || row.name}
                  </Link>
                ),
              },
              { key: "type", header: t("type"), cell: (row) => typeLabel(row.type) },
              { key: "created", header: t("createdAt"), cell: (row) => formatDate(row.createdAt, locale) },
            ]}
          />
        </Card>

        <Card
          title={t("expiringSubscriptions")}
          actions={
            <Link href="/admin/subscriptions" className="btn btn-ghost btn-sm">
              {t("viewAll")}
            </Link>
          }
        >
          <DataTable
            minWidth={480}
            rows={expiring.data}
            isLoading={expiring.isPending}
            error={expiring.error}
            onRetry={() => expiring.refetch()}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "institution",
                header: t("institution"),
                cell: (row) => (
                  <Link href={`/admin/institutions/${row.institutionId}`} className="cell-strong hover:text-accent">
                    {row.institution?.displayName || row.institution?.name || "—"}
                  </Link>
                ),
              },
              { key: "ends", header: t("endsAt"), cell: (row) => formatDate(row.endsAt, locale) },
              { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
            ]}
          />
        </Card>
      </div>
    </PageSection>
  );
}
