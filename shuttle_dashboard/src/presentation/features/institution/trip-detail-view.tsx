"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowSwap, CloseCircle, Edit } from "iconsax-react-v2";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { Trip, TripStudent } from "@/domain/models/entities";
import { TRIP_STUDENT_STATUSES, type TripStudentStatus } from "@/domain/models/enums";
import { Link } from "@/i18n/navigation";
import { enumKeys } from "@/infrastructure/http/case";
import { institutionApi, type OverrideInput, type ReassignInput } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { PointsMap, type MapPoint } from "@/presentation/components/map/points-map";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { EnumSelect, Field, NotifyUsersCheckbox, SelectInput, TextArea, TextInput } from "@/presentation/components/ui/form";
import { Modal } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, ConfirmDialog, KeyValue, PageSection, StatCard, StatGrid, Tabs } from "@/presentation/components/ui/panel";
import { ErrorState, LoadingState } from "@/presentation/components/ui/states";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { formatDateTime, formatServiceDate, formatTime, isoToDateInput } from "@/shared/lib/format";

export function TripDetailView({ tripId }: { tripId: string }) {
  const t = useTranslations("TripDetail");
  const locale = useLocale();
  const directionLabel = useEnumLabel("direction");
  const [tab, setTab] = useState<"students" | "stops" | "events">("students");
  const [dialog, setDialog] = useState<"override" | "reassign" | "cancel" | null>(null);

  const trip = useQuery({ queryKey: qk.institution.trip(tripId), queryFn: () => institutionApi.trip(tripId) });
  const summary = useQuery({
    queryKey: qk.institution.tripPart(tripId, "summary"),
    queryFn: () => institutionApi.tripSummary(tripId),
  });
  const stops = useQuery({
    queryKey: qk.institution.tripPart(tripId, "stops"),
    queryFn: () => institutionApi.tripStops(tripId),
  });
  const live = useQuery({
    queryKey: qk.institution.liveMap,
    queryFn: () => institutionApi.liveMap(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: trip.data?.status === "IN_PROGRESS",
  });
  const liveTrip = live.data?.find((item) => item.id === tripId) ?? null;

  const points = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = (stops.data ?? []).map((stop) => ({
      id: stop.id,
      lat: stop.latitude,
      lng: stop.longitude,
      badge: stop.stopType === "INSTITUTION" ? "★" : String(stop.sequence),
      title: stop.label ?? `#${stop.sequence}`,
      variant: stop.stopType === "INSTITUTION" ? "institution" : "stop",
    }));
    const origin = trip.data;
    if (origin?.originLat != null && origin.originLng != null) {
      list.unshift({ id: "origin", lat: origin.originLat, lng: origin.originLng, badge: "0", title: origin.originLabel ?? t("origin"), variant: "institution" });
    }
    return list;
  }, [stops.data, trip.data, t]);

  const busPoint = useMemo<MapPoint[]>(
    () =>
      liveTrip?.location
        ? [
            {
              id: `bus-${tripId}`,
              lat: liveTrip.location.latitude,
              lng: liveTrip.location.longitude,
              variant: liveTrip.gpsStale ? "bus-stale" : liveTrip.delayed ? "bus-delayed" : "bus",
              title: t("busPosition"),
            },
          ]
        : [],
    [liveTrip, tripId, t],
  );

  if (trip.isPending) {
    return (
      <PageSection>
        <LoadingState rows={8} />
      </PageSection>
    );
  }
  if (trip.isError) {
    return (
      <PageSection>
        <ErrorState error={trip.error} onRetry={() => trip.refetch()} />
      </PageSection>
    );
  }

  const data = trip.data;
  const studentCounts = enumKeys(summary.data?.students);
  const stopCounts = enumKeys(summary.data?.stops);
  const canOverride = data.status === "SCHEDULED";
  const canReassign = data.status === "SCHEDULED" || data.status === "IN_PROGRESS";
  const canCancel = data.status !== "COMPLETED" && data.status !== "CANCELLED";

  return (
    <PageSection>
      <PageHeader
        icon="history"
        title={data.route?.name ?? t("title")}
        subtitle={`${formatServiceDate(data.serviceDate, locale)} · ${data.scheduledDepartureTime} · ${directionLabel(data.direction)}`}
        actions={
          <>
            <StatusBadge status={data.status} />
            {data.delayed ? <Chip tone="warning">{t("delayedBy", { minutes: data.delayMinutes ?? 0 })}</Chip> : null}
            {canOverride ? (
              <button type="button" className="btn btn-secondary" onClick={() => setDialog("override")}>
                <Edit size={16} color="currentColor" variant="Linear" />
                {t("override")}
              </button>
            ) : null}
            {canReassign ? (
              <button type="button" className="btn btn-secondary" onClick={() => setDialog("reassign")}>
                <ArrowSwap size={16} color="currentColor" variant="Linear" />
                {t("reassign")}
              </button>
            ) : null}
            {canCancel ? (
              <button type="button" className="btn btn-danger" onClick={() => setDialog("cancel")}>
                <CloseCircle size={16} color="currentColor" variant="Linear" />
                {t("cancelTrip")}
              </button>
            ) : null}
          </>
        }
      />

      <StatGrid>
        <StatCard icon="student" label={t("students")} value={data.studentCount} loading={summary.isPending} hint={t("pendingHint", { count: studentCounts.PENDING ?? 0 })} />
        <StatCard icon="people" tone="success" label={t("boarded")} value={(studentCounts.BOARDED ?? 0) + (studentCounts.DROPPED_OFF ?? 0)} loading={summary.isPending} hint={t("droppedHint", { count: studentCounts.DROPPED_OFF ?? 0 })} />
        <StatCard icon="incident" tone="danger" label={t("notBoarded")} value={studentCounts.NOT_BOARDED ?? 0} loading={summary.isPending} />
        <StatCard icon="location" label={t("stopsArrived")} value={`${stopCounts.ARRIVED ?? 0} / ${data.stopCount}`} loading={summary.isPending} hint={t("skippedHint", { count: stopCounts.SKIPPED ?? 0 })} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card title={t("map")}>
          <PointsMap points={[...points, ...busPoint]} path className="h-[380px]" />
          {data.status === "IN_PROGRESS" && !liveTrip?.location ? (
            <p className="text-start text-xs text-text-muted">{t("noLiveLocation")}</p>
          ) : null}
        </Card>
        <Card title={t("details")}>
          <KeyValue
            items={[
              { label: t("branch"), value: data.branch?.name },
              { label: t("driver"), value: data.driver?.user?.fullName ?? <span className="text-warning">{t("unassigned")}</span> },
              { label: t("vehicle"), value: data.vehicle ? <span dir="ltr">{data.vehicle.plateNumber}</span> : <span className="text-warning">{t("unassigned")}</span> },
              { label: t("attendant"), value: data.attendant?.user?.fullName ?? "—" },
              { label: t("origin"), value: data.originLabel ?? "—" },
              { label: t("startedAt"), value: formatDateTime(data.startedAt, locale) },
              { label: t("completedAt"), value: formatDateTime(data.completedAt, locale) },
              { label: t("delayThreshold"), value: data.delayThresholdMinutes != null ? t("minutes", { count: data.delayThresholdMinutes }) : "—" },
              ...(data.status === "CANCELLED"
                ? [
                    { label: t("cancelledAt"), value: formatDateTime(data.cancelledAt, locale) },
                    { label: t("cancelReason"), value: data.cancelReason ?? "—" },
                  ]
                : []),
            ]}
          />
          {data.route ? (
            <Link href={`/institution/routes/${data.route.id}`} className="text-start text-sm text-accent hover:underline">
              {t("openRoute")}
            </Link>
          ) : null}
        </Card>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "students", label: t("tabStudents") },
          { id: "stops", label: t("tabStops") },
          { id: "events", label: t("tabEvents") },
        ]}
      />
      <Card>
        {tab === "students" ? <TripStudents trip={data} /> : null}
        {tab === "stops" ? (
          <DataTable
            rows={stops.data}
            isLoading={stops.isPending}
            error={stops.error}
            onRetry={() => stops.refetch()}
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
        {tab === "events" ? <TripEvents tripId={tripId} /> : null}
      </Card>

      <OverrideDialog trip={data} open={dialog === "override"} onClose={() => setDialog(null)} />
      <ReassignDialog trip={data} open={dialog === "reassign"} onClose={() => setDialog(null)} />
      <CancelTripDialog trip={data} open={dialog === "cancel"} onClose={() => setDialog(null)} />
    </PageSection>
  );
}

export function StopTypeLabel({ type }: { type: string }) {
  const label = useEnumLabel("stopType");
  return <>{label(type)}</>;
}

function TripStudents({ trip }: { trip: Trip }) {
  const t = useTranslations("TripDetail");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [target, setTarget] = useState<TripStudent | null>(null);
  const [status, setStatus] = useState<TripStudentStatus | "">("");
  const students = useQuery({
    queryKey: qk.institution.tripPart(trip.id, "students"),
    queryFn: () => institutionApi.tripStudents(trip.id),
  });

  const correct = useApiMutation({
    mutationFn: (input: { id: string; status: TripStudentStatus }) => institutionApi.correctTripStudent(trip.id, input.id, input.status),
    invalidate: [
      qk.institution.tripPart(trip.id, "students"),
      qk.institution.tripPart(trip.id, "summary"),
      qk.institution.tripPart(trip.id, "events"),
    ],
    onSuccess: () => setTarget(null),
  });

  const canCorrect = trip.status !== "CANCELLED";

  return (
    <>
      <DataTable
        rows={students.data}
        isLoading={students.isPending}
        error={students.error}
        onRetry={() => students.refetch()}
        rowKey={(row) => row.id}
        emptyTitle={t("noStudents")}
        minWidth={820}
        columns={[
          {
            key: "name",
            header: t("student"),
            cell: (row) =>
              row.student ? (
                <Link href={`/institution/students/${row.studentId}`} className="cell-strong hover:text-accent">
                  {row.student.fullName}
                </Link>
              ) : (
                "—"
              ),
          },
          { key: "stop", header: t("stop"), cell: (row) => (row.stop ? `#${row.stop.sequence} ${row.stop.label ?? ""}` : "—") },
          { key: "boarded", header: t("boardedAt"), cell: (row) => formatTime(row.boardedAt, locale) },
          { key: "dropped", header: t("droppedAt"), cell: (row) => formatTime(row.droppedOffAt, locale) },
          {
            key: "status",
            header: t("status"),
            cell: (row) => (
              <div className="flex flex-wrap gap-1">
                <StatusBadge status={row.status} />
                {row.isException ? <Chip tone="info">{t("exception")}</Chip> : null}
                {row.correctedAt ? <Chip>{t("corrected")}</Chip> : null}
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            cell: (row) =>
              canCorrect ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setStatus(row.status);
                    setTarget(row);
                  }}
                >
                  {t("correct")}
                </button>
              ) : null,
          },
        ]}
      />
      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={t("correctTitle")}
        subtitle={target?.student?.fullName}
        onSubmit={(event) => {
          event.preventDefault();
          if (target && status) correct.mutate({ id: target.id, status });
        }}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setTarget(null)}>
              {tCommon("cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={correct.isPending || !status || status === target?.status}>
              {correct.isPending ? tCommon("saving") : tCommon("save")}
            </button>
          </>
        }
      >
        <p className="text-start text-sm text-text-secondary">{t("correctHint")}</p>
        <Field label={t("status")} required>
          <EnumSelect group="status" values={TRIP_STUDENT_STATUSES} value={status} onChange={(value) => setStatus(value as TripStudentStatus)} />
        </Field>
      </Modal>
    </>
  );
}

function TripEvents({ tripId }: { tripId: string }) {
  const t = useTranslations("TripDetail");
  const locale = useLocale();
  const events = useQuery({
    queryKey: qk.institution.tripPart(tripId, "events"),
    queryFn: () => institutionApi.tripEvents(tripId),
  });
  return (
    <DataTable
      rows={events.data}
      isLoading={events.isPending}
      error={events.error}
      onRetry={() => events.refetch()}
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
  );
}

export function EventLabel({ type, title }: { type: string; title: string | null }) {
  const t = useTranslations("TripEvents");
  return <span className="cell-strong">{t.has(type) ? t(type) : (title ?? type)}</span>;
}

/* ─────────────── Crew selection (override / reassign) ─────────────── */

function useCrewOptions(trip: Trip, enabled: boolean) {
  const query = { date: isoToDateInput(trip.serviceDate), time: trip.scheduledDepartureTime, routeId: trip.routeId };
  const drivers = useQuery({
    queryKey: qk.institution.available("drivers", query),
    queryFn: () => institutionApi.availableDrivers(query),
    enabled,
  });
  const vehicles = useQuery({
    queryKey: qk.institution.available("vehicles", query),
    queryFn: () => institutionApi.availableVehicles(query),
    enabled,
  });
  const attendants = useQuery({
    queryKey: qk.institution.available("attendants", query),
    queryFn: () => institutionApi.availableAttendants(query),
    enabled,
  });

  function withCurrent(options: { value: string; label: string }[], id: string | null, label: string | undefined) {
    if (!id || options.some((option) => option.value === id)) return options;
    return [{ value: id, label: label ?? id }, ...options];
  }

  return {
    loading: drivers.isPending || vehicles.isPending || attendants.isPending,
    drivers: withCurrent(
      (drivers.data ?? []).map((item) => ({ value: item.id, label: item.user?.fullName ?? item.id })),
      trip.driverId,
      trip.driver?.user?.fullName,
    ),
    vehicles: withCurrent(
      (vehicles.data ?? []).map((item) => ({
        value: item.id,
        label: item.capacity ? `${item.plateNumber} (${item.capacity})` : item.plateNumber,
      })),
      trip.vehicleId,
      trip.vehicle?.plateNumber,
    ),
    attendants: withCurrent(
      (attendants.data ?? []).map((item) => ({ value: item.id, label: item.user?.fullName ?? item.id })),
      trip.attendantId,
      trip.attendant?.user?.fullName,
    ),
  };
}

function tripKeys(tripId: string) {
  return [qk.institution.trips, qk.institution.trip(tripId), qk.institution.liveMap, qk.institution.dashboard];
}

function OverrideDialog({ trip, open, onClose }: { trip: Trip; open: boolean; onClose: () => void }) {
  const t = useTranslations("TripDetail");
  const tCommon = useTranslations("Common");
  const crew = useCrewOptions(trip, open);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [attendantId, setAttendantId] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [notifyUsers, setNotifyUsers] = useState(false);
  const [timeError, setTimeError] = useState<string>();
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDriverId(trip.driverId ?? "");
      setVehicleId(trip.vehicleId ?? "");
      setAttendantId(trip.attendantId ?? "");
      setDepartureTime(trip.scheduledDepartureTime);
      setNotifyUsers(false);
      setTimeError(undefined);
    }
  }

  const save = useApiMutation({
    mutationFn: (input: OverrideInput) => institutionApi.overrideTrip(trip.id, input),
    invalidate: tripKeys(trip.id),
    onSuccess: onClose,
  });

  function submit() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime)) {
      setTimeError("time");
      return;
    }
    const input: OverrideInput = { notifyUsers };
    if (driverId && driverId !== trip.driverId) input.driverId = driverId;
    if (vehicleId && vehicleId !== trip.vehicleId) input.vehicleId = vehicleId;
    if (attendantId && attendantId !== trip.attendantId) input.attendantId = attendantId;
    if (departureTime !== trip.scheduledDepartureTime) input.departureTime = departureTime;
    save.mutate(input);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("overrideTitle")}
      subtitle={t("overrideHint")}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {tCommon("cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? tCommon("saving") : tCommon("save")}
          </button>
        </>
      }
    >
      <CrewFields crew={crew} driverId={driverId} setDriverId={setDriverId} vehicleId={vehicleId} setVehicleId={setVehicleId} attendantId={attendantId} setAttendantId={setAttendantId} />
      <Field label={t("departureTime")} error={timeError}>
        <TextInput type="time" dir="ltr" value={departureTime} onChange={(event) => setDepartureTime(event.target.value)} invalid={Boolean(timeError)} />
      </Field>
      <NotifyUsersCheckbox checked={notifyUsers} onChange={setNotifyUsers} />
    </Modal>
  );
}

function CrewFields({
  crew,
  driverId,
  setDriverId,
  vehicleId,
  setVehicleId,
  attendantId,
  setAttendantId,
}: {
  crew: ReturnType<typeof useCrewOptions>;
  driverId: string;
  setDriverId: (value: string) => void;
  vehicleId: string;
  setVehicleId: (value: string) => void;
  attendantId: string;
  setAttendantId: (value: string) => void;
}) {
  const t = useTranslations("TripDetail");
  return (
    <>
      <Field label={t("driver")} hint={crew.loading ? t("loadingAvailable") : t("availableHint")}>
        <SelectInput value={driverId} onChange={setDriverId} options={crew.drivers} />
      </Field>
      <Field label={t("vehicle")}>
        <SelectInput value={vehicleId} onChange={setVehicleId} options={crew.vehicles} />
      </Field>
      <Field label={t("attendant")}>
        <SelectInput value={attendantId} onChange={setAttendantId} options={crew.attendants} />
      </Field>
    </>
  );
}

function ReassignDialog({ trip, open, onClose }: { trip: Trip; open: boolean; onClose: () => void }) {
  const t = useTranslations("TripDetail");
  const tCommon = useTranslations("Common");
  const crew = useCrewOptions(trip, open);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [attendantId, setAttendantId] = useState("");
  const [incidentId, setIncidentId] = useState("");
  const [reason, setReason] = useState("");
  const [notifyUsers, setNotifyUsers] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDriverId(trip.driverId ?? "");
      setVehicleId(trip.vehicleId ?? "");
      setAttendantId(trip.attendantId ?? "");
      setIncidentId("");
      setReason("");
      setNotifyUsers(false);
    }
  }

  const incidents = useQuery({
    queryKey: qk.institution.incidentList({ status: "OPEN", limit: 100 }),
    queryFn: () => institutionApi.incidents({ status: "OPEN", limit: 100 }),
    enabled: open,
  });
  const incidentLabel = useEnumLabel("incidentType");
  const tripIncidents = (incidents.data?.data ?? []).filter((incident) => incident.tripId === trip.id);

  const save = useApiMutation({
    mutationFn: (input: ReassignInput) => institutionApi.reassignTrip(trip.id, input),
    invalidate: [...tripKeys(trip.id), qk.institution.incidents],
    onSuccess: onClose,
  });

  const changed =
    (driverId && driverId !== trip.driverId) ||
    (vehicleId && vehicleId !== trip.vehicleId) ||
    (attendantId && attendantId !== trip.attendantId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("reassignTitle")}
      subtitle={t("reassignHint")}
      onSubmit={(event) => {
        event.preventDefault();
        if (!changed) return;
        const input: ReassignInput = { notifyUsers };
        if (driverId && driverId !== trip.driverId) input.driverId = driverId;
        if (vehicleId && vehicleId !== trip.vehicleId) input.vehicleId = vehicleId;
        if (attendantId && attendantId !== trip.attendantId) input.attendantId = attendantId;
        if (incidentId) input.incidentId = incidentId;
        if (reason.trim()) input.reason = reason.trim();
        save.mutate(input);
      }}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {tCommon("cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending || !changed}>
            {save.isPending ? tCommon("saving") : t("reassign")}
          </button>
        </>
      }
    >
      <CrewFields crew={crew} driverId={driverId} setDriverId={setDriverId} vehicleId={vehicleId} setVehicleId={setVehicleId} attendantId={attendantId} setAttendantId={setAttendantId} />
      {tripIncidents.length ? (
        <Field label={t("linkedIncident")}>
          <SelectInput
            value={incidentId}
            onChange={setIncidentId}
            options={[
              { value: "", label: t("noIncident") },
              ...tripIncidents.map((incident) => ({
                value: incident.id,
                label: `${incidentLabel(incident.type)} · ${incident.description ?? ""}`,
              })),
            ]}
          />
        </Field>
      ) : null}
      <Field label={tCommon("reason")}>
        <TextArea value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <NotifyUsersCheckbox checked={notifyUsers} onChange={setNotifyUsers} />
    </Modal>
  );
}

function CancelTripDialog({ trip, open, onClose }: { trip: Trip; open: boolean; onClose: () => void }) {
  const t = useTranslations("TripDetail");
  const cancel = useApiMutation({
    mutationFn: (input: { reason: string; notifyUsers: boolean }) => institutionApi.cancelTrip(trip.id, input.reason, input.notifyUsers),
    invalidate: tripKeys(trip.id),
    successMessage: t("cancelled"),
    onSuccess: onClose,
  });
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={t("cancelTitle")}
      description={t("cancelConfirm")}
      confirmLabel={t("cancelTrip")}
      danger
      withReason
      reasonRequired
      withNotify
      pending={cancel.isPending}
      onConfirm={(input) => cancel.mutate(input)}
    />
  );
}
