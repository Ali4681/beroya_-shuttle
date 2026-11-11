"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { TRIP_STATUSES } from "@/domain/models/enums";
import { useRouter } from "@/i18n/navigation";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { PointsMap, type MapPoint } from "@/presentation/components/map/points-map";
import { AppDatePicker } from "@/presentation/components/ui/app-date-picker";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { PageHeader } from "@/presentation/components/ui/page-header";
import {
  Card,
  EnumFilterSelect,
  FilterSelect,
  KeyValue,
  PageSection,
  StatCard,
  StatGrid,
  Tabs,
  Toolbar,
} from "@/presentation/components/ui/panel";
import { ErrorState, LoadingState } from "@/presentation/components/ui/states";
import {
  InstitutionLink,
  ReadOnlyHint,
  institutionLabel,
  useInstitutionOptions,
} from "@/presentation/features/admin/operations-shared";
import { EventLabel, StopTypeLabel } from "@/presentation/features/institution/trip-detail-view";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { formatDateTime, formatServiceDate, formatTime, todayISO } from "@/shared/lib/format";

export function AdminTripsView() {
  const t = useTranslations("Trips");
  const tOps = useTranslations("AdminOps");
  const locale = useLocale();
  const router = useRouter();
  const directionLabel = useEnumLabel("direction");
  const institutionOptions = useInstitutionOptions();
  const { filters, setFilter, setPage, query } = useListParams({
    date: todayISO() as string | undefined,
    institutionId: undefined as string | undefined,
    status: undefined as string | undefined,
    delayed: undefined as string | undefined,
  });

  const stats = useQuery({
    queryKey: qk.admin.opsTripStats(filters.date),
    queryFn: () => adminApi.opsTripStats(filters.date),
  });
  const list = useQuery({
    queryKey: qk.admin.opsTrips(query),
    queryFn: () => adminApi.opsTrips(query),
    placeholderData: keepPreviousData,
  });
  const s = stats.data;

  return (
    <PageSection>
      <PageHeader icon="history" title={tOps("tripsTitle")} subtitle={tOps("tripsSubtitle")} />
      <StatGrid>
        <StatCard icon="history" label={t("total")} value={s?.total ?? 0} loading={stats.isPending} hint={t("scheduledHint", { count: s?.scheduled ?? 0 })} />
        <StatCard icon="live" tone="success" label={t("inProgress")} value={s?.inProgress ?? 0} loading={stats.isPending} hint={t("completedHint", { count: s?.completed ?? 0 })} />
        <StatCard icon="chart" tone="warning" label={t("delayed")} value={s?.delayed ?? 0} loading={stats.isPending} />
        <StatCard icon="incident" tone="danger" label={t("cancelled")} value={s?.cancelled ?? 0} loading={stats.isPending} />
      </StatGrid>
      <Card>
        <Toolbar>
          <AppDatePicker
            size="sm"
            clearable
            className="w-[200px]"
            placeholder={t("date")}
            value={filters.date ?? ""}
            onChange={(value) => setFilter("date", value || undefined)}
          />
          <FilterSelect
            placeholder={tOps("institution")}
            value={filters.institutionId}
            onChange={(value) => setFilter("institutionId", value)}
            options={institutionOptions}
          />
          <EnumFilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => setFilter("status", value)} group="status" values={TRIP_STATUSES} />
          <FilterSelect
            placeholder={t("delay")}
            value={filters.delayed}
            onChange={(value) => setFilter("delayed", value)}
            options={[{ value: "true", label: t("delayedOnly") }]}
          />
        </Toolbar>
        <DataTable
          rows={list.data?.data}
          meta={list.data?.meta}
          onPageChange={setPage}
          isLoading={list.isPending}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/admin/trips/${row.id}`)}
          emptyTitle={t("empty")}
          minWidth={1120}
          columns={[
            { key: "institution", header: tOps("institution"), cell: (row) => <InstitutionLink institution={row.institution} /> },
            { key: "route", header: t("route"), cell: (row) => <span className="cell-strong">{row.route?.name ?? "—"}</span> },
            { key: "date", header: t("date"), cell: (row) => formatServiceDate(row.serviceDate, locale) },
            { key: "time", header: t("departure"), cell: (row) => <span dir="ltr">{row.scheduledDepartureTime}</span> },
            { key: "direction", header: t("direction"), cell: (row) => directionLabel(row.direction) },
            { key: "driver", header: t("driver"), cell: (row) => row.driver?.user?.fullName ?? <span className="text-warning">{t("noDriver")}</span> },
            { key: "vehicle", header: t("vehicle"), cell: (row) => (row.vehicle ? <span dir="ltr">{row.vehicle.plateNumber}</span> : <span className="text-warning">{t("noVehicle")}</span>) },
            { key: "students", header: t("students"), cell: (row) => row.studentCount },
            {
              key: "status",
              header: t("status"),
              cell: (row) => (
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={row.status} />
                  {row.delayed ? <Chip tone="warning">{t("delayedBy", { minutes: row.delayMinutes ?? 0 })}</Chip> : null}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </PageSection>
  );
}

export function AdminTripDetailView({ tripId }: { tripId: string }) {
  const t = useTranslations("TripDetail");
  const tOps = useTranslations("AdminOps");
  const tIncidents = useTranslations("Incidents");
  const tLive = useTranslations("LiveMap");
  const locale = useLocale();
  const directionLabel = useEnumLabel("direction");
  const typeLabel = useEnumLabel("incidentType");
  const [tab, setTab] = useState<"stops" | "events" | "incidents">("stops");

  const detail = useQuery({ queryKey: qk.admin.opsTrip(tripId), queryFn: () => adminApi.opsTrip(tripId) });
  const isLive = detail.data?.trip.status === "IN_PROGRESS";
  const liveMap = useQuery({
    queryKey: qk.admin.opsLiveMap,
    queryFn: adminApi.opsLiveMap,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: isLive,
  });
  const live = liveMap.data?.find((item) => item.id === tripId) ?? (isLive ? detail.data?.live : null) ?? null;

  const points = useMemo<MapPoint[]>(() => {
    const data = detail.data;
    if (!data) return [];
    const list: MapPoint[] = data.stops.map((stop) => ({
      id: stop.id,
      lat: stop.latitude,
      lng: stop.longitude,
      badge: stop.stopType === "INSTITUTION" ? "★" : String(stop.sequence),
      title: stop.label ?? `#${stop.sequence}`,
      variant: stop.stopType === "INSTITUTION" ? "institution" : "stop",
    }));
    const { trip } = data;
    if (trip.originLat != null && trip.originLng != null) {
      list.unshift({ id: "origin", lat: trip.originLat, lng: trip.originLng, badge: "0", title: trip.originLabel ?? t("origin"), variant: "institution" });
    }
    return list;
  }, [detail.data, t]);

  const busPoint: MapPoint[] = live?.location
    ? [
        {
          id: `bus-${tripId}`,
          lat: live.location.latitude,
          lng: live.location.longitude,
          variant: live.gpsStale ? "bus-stale" : live.delayed ? "bus-delayed" : "bus",
          title: t("busPosition"),
        },
      ]
    : [];

  if (detail.isPending) {
    return (
      <PageSection>
        <LoadingState rows={8} />
      </PageSection>
    );
  }
  if (detail.isError) {
    return (
      <PageSection>
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      </PageSection>
    );
  }

  const { trip, stops, events, incidents } = detail.data;
  const arrived = stops.filter((stop) => stop.status === "ARRIVED").length;
  const skipped = stops.filter((stop) => stop.status === "SKIPPED").length;
  const openIncidents = incidents.filter((incident) => incident.status === "OPEN").length;

  return (
    <PageSection>
      <PageHeader
        icon="history"
        title={trip.route?.name ?? t("title")}
        subtitle={`${institutionLabel(trip.institution)} · ${formatServiceDate(trip.serviceDate, locale)} · ${trip.scheduledDepartureTime} · ${directionLabel(trip.direction)}`}
        actions={
          <>
            <StatusBadge status={trip.status} />
            {trip.delayed ? <Chip tone="warning">{t("delayedBy", { minutes: trip.delayMinutes ?? 0 })}</Chip> : null}
          </>
        }
      />
      <ReadOnlyHint />

      <StatGrid>
        <StatCard icon="student" label={t("students")} value={trip.studentCount} />
        <StatCard icon="location" label={t("stopsArrived")} value={`${arrived} / ${stops.length}`} hint={t("skippedHint", { count: skipped })} />
        <StatCard icon="incident" tone={openIncidents > 0 ? "danger" : undefined} label={tOps("openIncidents")} value={openIncidents} />
        <StatCard
          icon="live"
          tone={live?.gpsStale ? "danger" : "success"}
          label={tLive("etaFinish")}
          value={live?.etaToFinishAt ? formatTime(live.etaToFinishAt, locale) : "—"}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card title={t("map")}>
          <PointsMap points={[...points, ...busPoint]} path className="h-[380px]" />
          {isLive && !live?.location ? <p className="text-start text-xs text-text-muted">{t("noLiveLocation")}</p> : null}
        </Card>
        <Card title={t("details")}>
          <KeyValue
            items={[
              { label: tOps("institution"), value: <InstitutionLink institution={trip.institution} /> },
              { label: t("branch"), value: trip.branch?.name },
              { label: t("driver"), value: trip.driver?.user?.fullName ?? <span className="text-warning">{t("unassigned")}</span> },
              { label: tOps("driverPhone"), value: trip.driver?.user?.phone ? <span dir="ltr">{trip.driver.user.phone}</span> : "—" },
              { label: t("vehicle"), value: trip.vehicle ? <span dir="ltr">{trip.vehicle.plateNumber}</span> : <span className="text-warning">{t("unassigned")}</span> },
              { label: t("attendant"), value: trip.attendant?.user?.fullName ?? "—" },
              { label: t("origin"), value: trip.originLabel ?? "—" },
              { label: t("startedAt"), value: formatDateTime(trip.startedAt, locale) },
              { label: t("completedAt"), value: formatDateTime(trip.completedAt, locale) },
              ...(trip.status === "CANCELLED"
                ? [
                    { label: t("cancelledAt"), value: formatDateTime(trip.cancelledAt, locale) },
                    { label: t("cancelReason"), value: trip.cancelReason ?? "—" },
                  ]
                : []),
            ]}
          />
        </Card>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "stops", label: t("tabStops") },
          { id: "events", label: t("tabEvents") },
          { id: "incidents", label: `${tOps("tabIncidents")} (${incidents.length})` },
        ]}
      />
      <Card>
        {tab === "stops" ? (
          <DataTable
            rows={stops}
            rowKey={(row) => row.id}
            emptyTitle={t("noStops")}
            minWidth={720}
            columns={[
              { key: "seq", header: "#", cell: (row) => row.sequence },
              { key: "label", header: t("stop"), cell: (row) => <span className="cell-strong">{row.label ?? "—"}</span> },
              { key: "type", header: t("stopType"), cell: (row) => <StopTypeLabel type={row.stopType} /> },
              { key: "planned", header: t("planned"), cell: (row) => formatTime(row.plannedArrivalAt, locale) },
              { key: "eta", header: t("eta"), cell: (row) => formatTime(row.etaAt, locale) },
              { key: "arrived", header: t("arrived"), cell: (row) => formatTime(row.arrivedAt, locale) },
              { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
            ]}
          />
        ) : null}
        {tab === "events" ? (
          <DataTable
            rows={events}
            rowKey={(row) => row.id}
            emptyTitle={t("noEvents")}
            minWidth={680}
            columns={[
              { key: "at", header: t("at"), cell: (row) => formatDateTime(row.occurredAt, locale) },
              { key: "type", header: t("event"), cell: (row) => <EventLabel type={row.type} title={row.title} /> },
              { key: "desc", header: t("description"), cell: (row) => <span dir="auto">{row.description ?? "—"}</span> },
              { key: "actor", header: t("actor"), cell: (row) => row.actor?.fullName ?? t("system") },
            ]}
          />
        ) : null}
        {tab === "incidents" ? (
          <DataTable
            rows={incidents}
            rowKey={(row) => row.id}
            emptyTitle={tOps("noIncidents")}
            minWidth={760}
            columns={[
              {
                key: "type",
                header: tIncidents("type"),
                cell: (row) => <Chip tone={row.type === "EMERGENCY" ? "danger" : "warning"}>{typeLabel(row.type)}</Chip>,
              },
              { key: "reportedAt", header: tIncidents("reportedAt"), cell: (row) => formatDateTime(row.createdAt, locale) },
              { key: "reporter", header: tIncidents("reportedBy"), cell: (row) => row.reportedBy?.fullName ?? "—" },
              { key: "desc", header: tIncidents("description"), cell: (row) => <span dir="auto">{row.description ?? "—"}</span> },
              { key: "status", header: tIncidents("status"), cell: (row) => <StatusBadge status={row.status} /> },
            ]}
          />
        ) : null}
      </Card>
    </PageSection>
  );
}
