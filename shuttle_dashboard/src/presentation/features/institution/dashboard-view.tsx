"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, FilterSelect, PageSection, StatCard, StatGrid } from "@/presentation/components/ui/panel";
import { QueryBoundary } from "@/presentation/components/ui/states";
import { useBranchOptions, useInstitution } from "@/presentation/features/institution/use-institution";
import { formatTime } from "@/shared/lib/format";

export function InstitutionDashboardView() {
  const t = useTranslations("InstitutionDashboard");
  const { institution, branding } = useInstitution();
  const branchOptions = useBranchOptions();
  const [branchId, setBranchId] = useState<string>();

  const summary = useQuery({
    queryKey: [...qk.institution.dashboard, "summary", branchId ?? "all"],
    queryFn: () => institutionApi.dashboardSummary(branchId),
  });
  const s = summary.data;

  return (
    <PageSection>
      <PageHeader
        icon="home"
        title={t("title", { name: institution.displayName || institution.name })}
        subtitle={branding?.welcomeMessage || t("subtitle")}
        actions={
          branchOptions.length > 1 ? (
            <FilterSelect placeholder={t("branch")} value={branchId} onChange={setBranchId} options={branchOptions} />
          ) : null
        }
      />
      <StatGrid>
        <StatCard icon="history" label={t("todayTrips")} value={s?.todayTrips ?? 0} loading={summary.isPending} hint={t("scheduledHint", { count: s?.scheduled ?? 0 })} />
        <StatCard icon="live" tone="success" label={t("inProgress")} value={s?.inProgress ?? 0} loading={summary.isPending} hint={t("completedHint", { count: s?.completed ?? 0 })} />
        <StatCard icon="chart" tone="warning" label={t("delayed")} value={s?.delayed ?? 0} loading={summary.isPending} />
        <StatCard icon="incident" tone="danger" label={t("openIncidents")} value={s?.openIncidents ?? 0} loading={summary.isPending} />
      </StatGrid>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <LiveTripsCard />
        <AttentionCard />
      </div>
    </PageSection>
  );
}

function LiveTripsCard() {
  const t = useTranslations("InstitutionDashboard");
  const locale = useLocale();
  const directionLabel = useEnumLabel("direction");
  const live = useQuery({ queryKey: qk.institution.liveMap, queryFn: () => institutionApi.liveMap() });

  return (
    <Card
      title={t("liveTrips")}
      actions={
        <Link href="/institution/live-map" className="btn btn-secondary btn-sm">
          {t("openLiveMap")}
        </Link>
      }
    >
      <DataTable
        rows={live.data}
        isLoading={live.isPending}
        error={live.error}
        onRetry={() => live.refetch()}
        rowKey={(row) => row.id}
        emptyTitle={t("noLiveTrips")}
        minWidth={640}
        columns={[
          {
            key: "route",
            header: t("route"),
            cell: (row) => (
              <Link href={`/institution/trips/${row.id}`} className="cell-strong hover:text-accent">
                {row.route?.name ?? "—"}
              </Link>
            ),
          },
          { key: "direction", header: t("direction"), cell: (row) => directionLabel(row.direction) },
          { key: "next", header: t("nextStop"), cell: (row) => row.nextStop?.label ?? (row.nextStop ? `#${row.nextStop.sequence}` : "—") },
          { key: "eta", header: t("eta"), cell: (row) => (row.etaToNextStopAt ? formatTime(row.etaToNextStopAt, locale) : "—") },
          {
            key: "state",
            header: t("state"),
            cell: (row) => (
              <div className="flex flex-wrap gap-1">
                <StatusBadge status={row.status} />
                {row.delayed ? <Chip tone="warning">{t("delayedBy", { minutes: row.delayMinutes ?? 0 })}</Chip> : null}
                {row.gpsStale ? <Chip tone="danger">{t("gpsStale")}</Chip> : null}
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}

function AttentionCard() {
  const t = useTranslations("InstitutionDashboard");
  const incidentLabel = useEnumLabel("incidentType");
  const attention = useQuery({ queryKey: qk.institution.attention, queryFn: institutionApi.attention });

  return (
    <Card title={t("attention")}>
      <QueryBoundary
        query={attention}
        isEmpty={(data) =>
          !data.delayed.length && !data.openBreakdowns.length && !data.openEmergencies.length && !data.gpsStale.length
        }
        emptyTitle={t("allClear")}
        emptyDescription={t("allClearHint")}
        loadingRows={3}
      >
        {(data) => (
          <ul className="flex flex-col gap-2">
            {[...data.openEmergencies, ...data.openBreakdowns].map((incident) => (
              <AttentionItem
                key={incident.id}
                tone="danger"
                href={`/institution/incidents?focus=${incident.id}`}
                title={incidentLabel(incident.type)}
                description={incident.trip?.route?.name ?? incident.description ?? ""}
              />
            ))}
            {data.delayed.map((trip) => (
              <AttentionItem
                key={trip.id}
                tone="warning"
                href={`/institution/trips/${trip.id}`}
                title={t("delayedBy", { minutes: trip.delayMinutes ?? 0 })}
                description={trip.routeName ?? ""}
              />
            ))}
            {data.gpsStale.map((trip) => (
              <AttentionItem
                key={trip.id}
                tone="muted"
                href={`/institution/trips/${trip.id}`}
                title={t("gpsStale")}
                description={trip.routeName ?? ""}
              />
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
}

function AttentionItem({
  tone,
  href,
  title,
  description,
}: {
  tone: "danger" | "warning" | "muted";
  href: string;
  title: string;
  description: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-start transition hover:border-accent/40"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-text-primary">{title}</span>
          <span className="truncate text-xs text-text-muted">{description}</span>
        </span>
        <Chip tone={tone}>●</Chip>
      </Link>
    </li>
  );
}
