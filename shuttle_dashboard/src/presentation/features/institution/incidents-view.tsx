"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Incident } from "@/domain/models/entities";
import { INCIDENT_STATUSES, INCIDENT_TYPES } from "@/domain/models/enums";
import { Link } from "@/i18n/navigation";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { PointsMap } from "@/presentation/components/map/points-map";
import { AppDatePicker } from "@/presentation/components/ui/app-date-picker";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, TextArea } from "@/presentation/components/ui/form";
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
import { ErrorState, LoadingState } from "@/presentation/components/ui/states";
import { useBranchOptions, useRouteOptions } from "@/presentation/features/institution/use-institution";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { formatDateTime } from "@/shared/lib/format";

export function IncidentsView() {
  const t = useTranslations("Incidents");
  const locale = useLocale();
  const typeLabel = useEnumLabel("incidentType");
  const branchOptions = useBranchOptions();
  const routeOptions = useRouteOptions();
  const focus = useSearchParams().get("focus");
  const [selectedId, setSelectedId] = useState<string | null>(focus);
  const { filters, setFilter, setPage, query } = useListParams({
    status: (focus ? undefined : "OPEN") as string | undefined,
    type: undefined as string | undefined,
    routeId: undefined as string | undefined,
    branchId: undefined as string | undefined,
    dateFrom: undefined as string | undefined,
    dateTo: undefined as string | undefined,
  });

  const stats = useQuery({ queryKey: qk.institution.incidentStats, queryFn: institutionApi.incidentStats });
  const list = useQuery({
    queryKey: qk.institution.incidentList(query),
    queryFn: () => institutionApi.incidents(query),
    placeholderData: keepPreviousData,
  });
  const s = stats.data;

  return (
    <PageSection>
      <PageHeader icon="incident" title={t("title")} subtitle={t("subtitle")} />
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
          <FilterSelect placeholder={t("route")} value={filters.routeId} onChange={(value) => setFilter("routeId", value)} options={routeOptions} />
          {branchOptions.length > 1 ? (
            <FilterSelect placeholder={t("branch")} value={filters.branchId} onChange={(value) => setFilter("branchId", value)} options={branchOptions} />
          ) : null}
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
          onRowClick={(row) => setSelectedId(row.id)}
          emptyTitle={t("empty")}
          minWidth={920}
          columns={[
            {
              key: "type",
              header: t("type"),
              cell: (row) => <Chip tone={row.type === "EMERGENCY" ? "danger" : "warning"}>{typeLabel(row.type)}</Chip>,
            },
            { key: "route", header: t("route"), cell: (row) => <span className="cell-strong">{row.trip?.route?.name ?? "—"}</span> },
            { key: "driver", header: t("driver"), cell: (row) => row.trip?.driver?.user?.fullName ?? "—" },
            { key: "vehicle", header: t("vehicle"), cell: (row) => (row.trip?.vehicle ? <span dir="ltr">{row.trip.vehicle.plateNumber}</span> : "—") },
            { key: "reportedAt", header: t("reportedAt"), cell: (row) => formatDateTime(row.createdAt, locale) },
            { key: "reporter", header: t("reportedBy"), cell: (row) => row.reportedBy?.fullName ?? "—" },
            { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </Card>
      <IncidentDrawer incidentId={selectedId} onClose={() => setSelectedId(null)} />
    </PageSection>
  );
}

function IncidentDrawer({ incidentId, onClose }: { incidentId: string | null; onClose: () => void }) {
  const t = useTranslations("Incidents");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const typeLabel = useEnumLabel("incidentType");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [synced, setSynced] = useState<string | null>(null);
  if (incidentId !== synced) {
    setSynced(incidentId);
    setNotes("");
    setError(undefined);
  }

  const incident = useQuery({
    queryKey: [...qk.institution.incidents, "detail", incidentId],
    queryFn: () => institutionApi.incident(incidentId!),
    enabled: Boolean(incidentId),
  });

  const resolve = useApiMutation({
    mutationFn: (input: { id: string; notes: string }) => institutionApi.resolveIncident(input.id, input.notes),
    invalidate: [qk.institution.incidents, qk.institution.attention, qk.institution.dashboard],
    successMessage: t("resolvedSuccess"),
    onSuccess: onClose,
  });

  const data: Incident | undefined = incident.data;
  const isOpen = data?.status === "OPEN";

  return (
    <Drawer
      open={Boolean(incidentId)}
      onClose={onClose}
      title={data ? typeLabel(data.type) : t("detail")}
      subtitle={data?.trip?.route?.name ?? undefined}
      onSubmit={
        isOpen
          ? (event) => {
              event.preventDefault();
              const trimmed = notes.trim();
              if (trimmed.length < 2) {
                setError("min2");
                return;
              }
              if (trimmed.length > 1000) {
                setError("max1000");
                return;
              }
              resolve.mutate({ id: data.id, notes: trimmed });
            }
          : undefined
      }
      footer={
        isOpen ? (
          <>
            <button type="submit" className="btn btn-primary flex-1" disabled={resolve.isPending}>
              {resolve.isPending ? tCommon("saving") : t("resolve")}
            </button>
            <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
              {tCommon("cancel")}
            </button>
          </>
        ) : undefined
      }
    >
      {incident.isPending ? (
        <LoadingState rows={5} />
      ) : incident.isError ? (
        <ErrorState error={incident.error} onRetry={() => incident.refetch()} />
      ) : data ? (
        <>
          <KeyValue
            items={[
              { label: t("status"), value: <StatusBadge status={data.status} /> },
              { label: t("reportedAt"), value: formatDateTime(data.createdAt, locale) },
              { label: t("reportedBy"), value: data.reportedBy?.fullName },
              { label: t("branch"), value: data.trip?.branch?.name },
              { label: t("driver"), value: data.trip?.driver?.user?.fullName },
              { label: t("vehicle"), value: data.trip?.vehicle?.plateNumber },
              { label: t("attendant"), value: data.trip?.attendant?.user?.fullName },
              { label: t("tripStatus"), value: <StatusBadge status={data.trip?.status} /> },
            ]}
          />
          {data.description ? (
            <Field label={t("description")}>
              <p className="rounded-lg bg-surface-muted p-3 text-start text-sm text-text-secondary" dir="auto">
                {data.description}
              </p>
            </Field>
          ) : null}
          {data.latitude != null && data.longitude != null ? (
            <PointsMap
              className="h-[220px]"
              points={[{ id: data.id, lat: data.latitude, lng: data.longitude, variant: "bus-delayed", title: typeLabel(data.type) }]}
            />
          ) : null}
          {data.trip ? (
            <Link href={`/institution/trips/${data.tripId}`} className="text-start text-sm text-accent hover:underline">
              {t("openTrip")}
            </Link>
          ) : null}
          {isOpen ? (
            <>
              <p className="text-start text-xs text-text-muted">{t("reassignHint")}</p>
              <Field label={t("resolutionNotes")} required error={error}>
                <TextArea
                  rows={4}
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setError(undefined);
                  }}
                  invalid={Boolean(error)}
                />
              </Field>
            </>
          ) : (
            <KeyValue
              items={[
                { label: t("resolvedAt"), value: formatDateTime(data.resolvedAt, locale) },
                { label: t("resolvedBy"), value: data.resolvedBy?.fullName },
                { label: t("resolutionNotes"), value: <span dir="auto">{data.resolutionNotes ?? "—"}</span> },
              ]}
            />
          )}
        </>
      ) : null}
    </Drawer>
  );
}
