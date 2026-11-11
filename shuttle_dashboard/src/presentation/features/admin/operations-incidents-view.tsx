"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { AdminIncident } from "@/domain/models/entities";
import { INCIDENT_STATUSES, INCIDENT_TYPES } from "@/domain/models/enums";
import { Link } from "@/i18n/navigation";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { PointsMap } from "@/presentation/components/map/points-map";
import { AppDatePicker } from "@/presentation/components/ui/app-date-picker";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field } from "@/presentation/components/ui/form";
import { Drawer } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import {
  Card,
  EnumFilterSelect,
  FilterSelect,
  KeyValue,
  PageSection,
  StatCard,
  StatGrid,
  Toolbar,
} from "@/presentation/components/ui/panel";
import {
  InstitutionLink,
  ReadOnlyHint,
  institutionLabel,
  useInstitutionOptions,
} from "@/presentation/features/admin/operations-shared";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { formatDateTime } from "@/shared/lib/format";

export function AdminIncidentsView() {
  const t = useTranslations("Incidents");
  const tOps = useTranslations("AdminOps");
  const locale = useLocale();
  const typeLabel = useEnumLabel("incidentType");
  const institutionOptions = useInstitutionOptions();
  const [selected, setSelected] = useState<AdminIncident | null>(null);
  const { filters, setFilter, setPage, query } = useListParams({
    status: "OPEN" as string | undefined,
    type: undefined as string | undefined,
    institutionId: undefined as string | undefined,
    dateFrom: undefined as string | undefined,
    dateTo: undefined as string | undefined,
  });

  const stats = useQuery({ queryKey: qk.admin.opsIncidentStats, queryFn: adminApi.opsIncidentStats });
  const list = useQuery({
    queryKey: qk.admin.opsIncidents(query),
    queryFn: () => adminApi.opsIncidents(query),
    placeholderData: keepPreviousData,
  });
  const s = stats.data;

  return (
    <PageSection>
      <PageHeader icon="incident" title={tOps("incidentsTitle")} subtitle={tOps("incidentsSubtitle")} />
      <StatGrid>
        <StatCard icon="incident" tone="danger" label={t("openEmergencies")} value={s?.openEmergencies ?? 0} loading={stats.isPending} />
        <StatCard icon="vehicle" tone="warning" label={t("openBreakdowns")} value={s?.openBreakdowns ?? 0} loading={stats.isPending} />
        <StatCard icon="chart" tone="success" label={t("resolved")} value={s?.resolved ?? 0} loading={stats.isPending} />
        <StatCard icon="document" label={t("total")} value={s?.total ?? 0} loading={stats.isPending} />
      </StatGrid>
      <Card>
        <Toolbar>
          <EnumFilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => setFilter("status", value)} group="status" values={INCIDENT_STATUSES} />
          <EnumFilterSelect placeholder={t("type")} value={filters.type} onChange={(value) => setFilter("type", value)} group="incidentType" values={INCIDENT_TYPES} />
          <FilterSelect
            placeholder={tOps("institution")}
            value={filters.institutionId}
            onChange={(value) => setFilter("institutionId", value)}
            options={institutionOptions}
          />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            {t("from")}
            <AppDatePicker size="sm" clearable className="w-[200px]" value={filters.dateFrom ?? ""} onChange={(value) => setFilter("dateFrom", value || undefined)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            {t("to")}
            <AppDatePicker size="sm" clearable className="w-[200px]" value={filters.dateTo ?? ""} min={filters.dateFrom} onChange={(value) => setFilter("dateTo", value || undefined)} />
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
          onRowClick={setSelected}
          emptyTitle={t("empty")}
          minWidth={1040}
          columns={[
            {
              key: "type",
              header: t("type"),
              cell: (row) => <Chip tone={row.type === "EMERGENCY" ? "danger" : "warning"}>{typeLabel(row.type)}</Chip>,
            },
            { key: "institution", header: tOps("institution"), cell: (row) => <InstitutionLink institution={row.institution} /> },
            { key: "route", header: t("route"), cell: (row) => <span className="cell-strong">{row.trip?.route?.name ?? "—"}</span> },
            { key: "driver", header: t("driver"), cell: (row) => row.trip?.driver?.user?.fullName ?? "—" },
            { key: "vehicle", header: t("vehicle"), cell: (row) => (row.trip?.vehicle ? <span dir="ltr">{row.trip.vehicle.plateNumber}</span> : "—") },
            { key: "reportedAt", header: t("reportedAt"), cell: (row) => formatDateTime(row.createdAt, locale) },
            { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </Card>
      <IncidentDrawer incident={selected} onClose={() => setSelected(null)} />
    </PageSection>
  );
}

function IncidentDrawer({ incident, onClose }: { incident: AdminIncident | null; onClose: () => void }) {
  const t = useTranslations("Incidents");
  const tOps = useTranslations("AdminOps");
  const locale = useLocale();
  const typeLabel = useEnumLabel("incidentType");

  return (
    <Drawer
      open={Boolean(incident)}
      onClose={onClose}
      title={incident ? typeLabel(incident.type) : t("detail")}
      subtitle={incident ? `${institutionLabel(incident.institution)} · ${incident.trip?.route?.name ?? ""}` : undefined}
    >
      {incident ? (
        <>
          <KeyValue
            items={[
              { label: t("status"), value: <StatusBadge status={incident.status} /> },
              { label: tOps("institution"), value: <InstitutionLink institution={incident.institution} /> },
              { label: t("reportedAt"), value: formatDateTime(incident.createdAt, locale) },
              { label: t("reportedBy"), value: incident.reportedBy?.fullName },
              { label: t("branch"), value: incident.trip?.branch?.name },
              { label: t("driver"), value: incident.trip?.driver?.user?.fullName },
              { label: tOps("driverPhone"), value: incident.trip?.driver?.user?.phone ? <span dir="ltr">{incident.trip.driver.user.phone}</span> : "—" },
              { label: t("vehicle"), value: incident.trip?.vehicle?.plateNumber },
              { label: t("attendant"), value: incident.trip?.attendant?.user?.fullName },
              { label: t("tripStatus"), value: <StatusBadge status={incident.trip?.status} /> },
            ]}
          />
          {incident.description ? (
            <Field label={t("description")}>
              <p className="rounded-lg bg-surface-muted p-3 text-start text-sm text-text-secondary" dir="auto">
                {incident.description}
              </p>
            </Field>
          ) : null}
          {incident.latitude != null && incident.longitude != null ? (
            <PointsMap
              className="h-[220px]"
              points={[{ id: incident.id, lat: incident.latitude, lng: incident.longitude, variant: "bus-delayed", title: typeLabel(incident.type) }]}
            />
          ) : null}
          <Link href={`/admin/trips/${incident.tripId}`} className="text-start text-sm text-accent hover:underline">
            {t("openTrip")}
          </Link>
          {incident.status === "RESOLVED" ? (
            <KeyValue
              items={[
                { label: t("resolvedAt"), value: formatDateTime(incident.resolvedAt, locale) },
                { label: t("resolvedBy"), value: incident.resolvedBy?.fullName },
                { label: t("resolutionNotes"), value: <span dir="auto">{incident.resolutionNotes ?? "—"}</span> },
              ]}
            />
          ) : (
            <ReadOnlyHint />
          )}
        </>
      ) : null}
    </Drawer>
  );
}
