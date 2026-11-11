"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { LiveTrip } from "@/domain/models/entities";
import { Link } from "@/i18n/navigation";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { PointsMap, type MapPoint } from "@/presentation/components/map/points-map";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, FilterSelect, KeyValue, PageSection, Toolbar } from "@/presentation/components/ui/panel";
import { EmptyState, ErrorState, LoadingState } from "@/presentation/components/ui/states";
import { useBranchOptions } from "@/presentation/features/institution/use-institution";
import { cn } from "@/shared/lib/cn";
import { formatDateTime, formatTime } from "@/shared/lib/format";

/** One GET on mount; afterwards positions arrive only through the socket (see `applyInstitutionEvent`). */
export function LiveMapView() {
  const t = useTranslations("LiveMap");
  const locale = useLocale();
  const branchOptions = useBranchOptions();
  const [branchId, setBranchId] = useState<string>();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const live = useQuery({
    queryKey: qk.institution.liveMap,
    queryFn: () => institutionApi.liveMap(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const trips = useMemo(
    () => (live.data ?? []).filter((trip) => !branchId || trip.branchId === branchId),
    [live.data, branchId],
  );

  const points = useMemo<MapPoint[]>(
    () =>
      trips
        .filter((trip) => trip.location)
        .map((trip) => ({
          id: trip.id,
          lat: trip.location!.latitude,
          lng: trip.location!.longitude,
          title: trip.route?.name ?? undefined,
          badge: (trip.route?.name ?? "").slice(0, 2),
          variant: trip.gpsStale ? "bus-stale" : trip.delayed ? "bus-delayed" : "bus",
        })),
    [trips],
  );

  const selected = trips.find((trip) => trip.id === selectedId) ?? null;

  return (
    <PageSection>
      <PageHeader icon="live" title={t("title")} subtitle={t("subtitle")} />
      <Toolbar>
        {branchOptions.length > 1 ? (
          <FilterSelect placeholder={t("branch")} value={branchId} onChange={setBranchId} options={branchOptions} />
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

function TripFlags({ trip }: { trip: LiveTrip }) {
  const t = useTranslations("LiveMap");
  if (trip.gpsStale) return <Chip tone="danger">{t("gpsStale")}</Chip>;
  if (trip.delayed) return <Chip tone="warning">{t("delayedBy", { minutes: trip.delayMinutes ?? 0 })}</Chip>;
  return <StatusBadge status={trip.status} />;
}

function SelectedTrip({ trip, onClose }: { trip: LiveTrip; onClose: () => void }) {
  const t = useTranslations("LiveMap");
  const locale = useLocale();
  const directionLabel = useEnumLabel("direction");
  return (
    <Card
      title={trip.route?.name ?? "—"}
      actions={
        <>
          <Link href={`/institution/trips/${trip.id}`} className="btn btn-primary btn-sm">
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
          { label: t("status"), value: <TripFlags trip={trip} /> },
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
