"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { AdminLiveTrip } from "@/domain/models/entities";
import { Link } from "@/i18n/navigation";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { PointsMap, type MapPoint } from "@/presentation/components/map/points-map";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, FilterSelect, KeyValue, PageSection, Toolbar } from "@/presentation/components/ui/panel";
import { EmptyState, ErrorState, LoadingState } from "@/presentation/components/ui/states";
import { InstitutionLink, institutionLabel } from "@/presentation/features/admin/operations-shared";
import { cn } from "@/shared/lib/cn";
import { formatDateTime, formatTime } from "@/shared/lib/format";

/** One GET on mount; positions then arrive through the `admin:beroya` socket room (see `applyAdminEvent`). */
export function AdminLiveMapView() {
  const t = useTranslations("LiveMap");
  const tOps = useTranslations("AdminOps");
  const locale = useLocale();
  const [institutionId, setInstitutionId] = useState<string>();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const live = useQuery({
    queryKey: qk.admin.opsLiveMap,
    queryFn: adminApi.opsLiveMap,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const institutionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const trip of live.data ?? []) seen.set(trip.institution.id, institutionLabel(trip.institution));
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [live.data]);

  const trips = useMemo(
    () => (live.data ?? []).filter((trip) => !institutionId || trip.institution.id === institutionId),
    [live.data, institutionId],
  );

  const points = useMemo<MapPoint[]>(
    () =>
      trips
        .filter((trip) => trip.location)
        .map((trip) => ({
          id: trip.id,
          lat: trip.location!.latitude,
          lng: trip.location!.longitude,
          title: `${institutionLabel(trip.institution)} · ${trip.route?.name ?? ""}`,
          badge: (trip.route?.name ?? "").slice(0, 2),
          variant: trip.gpsStale ? "bus-stale" : trip.delayed ? "bus-delayed" : "bus",
        })),
    [trips],
  );

  const selected = trips.find((trip) => trip.id === selectedId) ?? null;

  return (
    <PageSection>
      <PageHeader icon="live" title={tOps("liveMapTitle")} subtitle={tOps("liveMapSubtitle")} />
      <Toolbar>
        {institutionOptions.length > 1 ? (
          <FilterSelect placeholder={tOps("institution")} value={institutionId} onChange={setInstitutionId} options={institutionOptions} />
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <Legend className="live-bus-marker-dot" label={t("legendOnTime")} />
          <Legend className="live-bus-marker-dot live-bus-marker-dot--delayed" label={t("legendDelayed")} />
          <Legend className="live-bus-marker-dot live-bus-marker-dot--stale" label={t("legendStale")} />
        </div>
      </Toolbar>
      {live.isPending ? (
        <Card>
          <LoadingState rows={6} />
        </Card>
      ) : live.isError ? (
        <Card>
          <ErrorState error={live.error} onRetry={() => live.refetch()} />
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative isolate">
            <PointsMap points={points} className="h-[560px]" selectedId={selectedId} onPointClick={setSelectedId} />
            {trips.length === 0 ? (
              <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] flex justify-center">
                <span className="rounded-full bg-surface px-4 py-2 text-sm text-text-secondary shadow">{t("noTrips")}</span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-4">
            {selected ? <SelectedTrip trip={selected} onClose={() => setSelectedId(null)} /> : null}
            <Card title={t("tripsCount", { count: trips.length })}>
              {trips.length === 0 ? (
                <EmptyState title={t("noTrips")} description={t("noTripsHint")} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {trips.map((trip) => (
                    <li key={trip.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(trip.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-start transition",
                          trip.id === selectedId ? "border-accent bg-accent-soft" : "border-border hover:border-accent/40",
                        )}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-semibold text-text-primary">{trip.route?.name ?? "—"}</span>
                          <span className="truncate text-xs text-text-secondary">{institutionLabel(trip.institution)}</span>
                          <span className="text-xs text-text-muted">
                            {trip.location ? t("lastSeen", { time: formatTime(trip.location.recordedAt, locale) }) : t("noLocation")}
                          </span>
                        </span>
                        <TripFlags trip={trip} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </PageSection>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn(className, "!size-4 !text-[0px]")} />
      {label}
    </span>
  );
}

function TripFlags({ trip }: { trip: AdminLiveTrip }) {
  const t = useTranslations("LiveMap");
  const typeLabel = useEnumLabel("incidentType");
  const incident = trip.openIncidents.includes("EMERGENCY") ? "EMERGENCY" : trip.openIncidents[0];
  if (incident) return <Chip tone="danger">{typeLabel(incident)}</Chip>;
  if (trip.gpsStale) return <Chip tone="danger">{t("gpsStale")}</Chip>;
  if (trip.delayed) return <Chip tone="warning">{t("delayedBy", { minutes: trip.delayMinutes ?? 0 })}</Chip>;
  return <StatusBadge status={trip.status} />;
}

function SelectedTrip({ trip, onClose }: { trip: AdminLiveTrip; onClose: () => void }) {
  const t = useTranslations("LiveMap");
  const tOps = useTranslations("AdminOps");
  const tTrip = useTranslations("TripDetail");
  const locale = useLocale();
  const directionLabel = useEnumLabel("direction");
  return (
    <Card
      title={trip.route?.name ?? "—"}
      actions={
        <>
          <Link href={`/admin/trips/${trip.id}`} className="btn btn-primary btn-sm">
            {t("openTrip")}
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {t("close")}
          </button>
        </>
      }
    >
      <KeyValue
        items={[
          { label: tOps("institution"), value: <InstitutionLink institution={trip.institution} /> },
          { label: t("status"), value: <TripFlags trip={trip} /> },
          { label: tTrip("driver"), value: trip.driver?.fullName ?? <span className="text-warning">{tTrip("unassigned")}</span> },
          { label: tOps("driverPhone"), value: trip.driver?.phone ? <span dir="ltr">{trip.driver.phone}</span> : "—" },
          { label: tTrip("vehicle"), value: trip.vehicle ? <span dir="ltr">{trip.vehicle.plateNumber}</span> : <span className="text-warning">{tTrip("unassigned")}</span> },
          { label: t("direction"), value: directionLabel(trip.direction) },
          { label: t("nextStop"), value: trip.nextStop?.label ?? (trip.nextStop ? `#${trip.nextStop.sequence}` : "—") },
          { label: t("etaNext"), value: trip.etaToNextStopAt ? formatTime(trip.etaToNextStopAt, locale) : "—" },
          { label: t("etaFinish"), value: trip.etaToFinishAt ? formatTime(trip.etaToFinishAt, locale) : "—" },
          { label: t("speed"), value: trip.location?.speedKph != null ? `${Math.round(trip.location.speedKph)} km/h` : "—" },
          { label: t("lastUpdate"), value: trip.location ? formatDateTime(trip.location.recordedAt, locale) : "—" },
        ]}
      />
    </Card>
  );
}
