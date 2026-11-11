"use client";

import { useQuery } from "@tanstack/react-query";
import { Add, ArrowDown, ArrowUp, Edit, Trash } from "iconsax-react-v2";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { OptimizeStopsResult, RouteDetail, RouteSchedule, RouteStop } from "@/domain/models/entities";
import { ROUTE_STATUSES, TRIP_DIRECTIONS, type RouteStatus, type TripDirection } from "@/domain/models/enums";
import { Link } from "@/i18n/navigation";
import { institutionApi, type CrewInput, type ScheduleInput } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { LocationPickerMap } from "@/presentation/components/map/location-picker-map";
import { PointsMap, type MapPoint } from "@/presentation/components/map/points-map";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import {
  CheckboxField,
  EnumSelect,
  Field,
  FormGrid,
  NotifyUsersCheckbox,
  scheduleFocusFirstInvalidField,
  SelectInput,
  TextInput,
} from "@/presentation/components/ui/form";
import { Drawer, Modal } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, ConfirmDialog, KeyValue, PageSection, SearchInput, Tabs } from "@/presentation/components/ui/panel";
import { ErrorState, LoadingState } from "@/presentation/components/ui/states";
import { RouteFormDrawer } from "@/presentation/features/institution/routes-view";
import { useBranchName, useInstitution } from "@/presentation/features/institution/use-institution";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { cn } from "@/shared/lib/cn";

type Tab = "overview" | "schedules" | "stops" | "students";

function routeKeys(routeId: string) {
  return [qk.institution.route(routeId), qk.institution.routes()];
}

export function RouteDetailView({ routeId }: { routeId: string }) {
  const t = useTranslations("RouteDetail");
  const branchName = useBranchName();
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [orderDirection, setOrderDirection] = useState<TripDirection | null>(null);

  const route = useQuery({ queryKey: qk.institution.route(routeId), queryFn: () => institutionApi.route(routeId) });

  if (route.isPending) {
    return (
      <PageSection>
        <LoadingState rows={8} />
      </PageSection>
    );
  }
  if (route.isError) {
    return (
      <PageSection>
        <ErrorState error={route.error} onRetry={() => route.refetch()} />
      </PageSection>
    );
  }
  const data = route.data;

  return (
    <PageSection>
      <PageHeader
        icon="route"
        title={data.name}
        subtitle={`${branchName(data.branchId)}${data.code ? ` · ${data.code}` : ""}`}
        actions={
          <>
            <StatusBadge status={data.status} />
            <button type="button" className="btn btn-secondary" onClick={() => setStatusOpen(true)}>
              {t("changeStatus")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditOpen(true)}>
              <Edit size={16} color="currentColor" variant="Linear" />
              {t("edit")}
            </button>
          </>
        }
      />

      {data.stopsOrderStale ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3">
          <div className="flex flex-col text-start">
            <span className="text-sm font-semibold text-text-primary">{t("staleTitle")}</span>
            <span className="text-xs text-text-secondary">{t("staleHint")}</span>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOrderDirection("OUTBOUND")}>
            {t("reviewOrder")}
          </button>
        </div>
      ) : null}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: t("tabOverview") },
          { id: "schedules", label: t("tabSchedules", { count: data.schedules.length }) },
          { id: "stops", label: t("tabStops", { count: data.stopCount }) },
          { id: "students", label: t("tabStudents", { count: data.studentCount }) },
        ]}
      />

      {tab === "overview" ? <Overview route={data} /> : null}
      {tab === "schedules" ? <Schedules route={data} /> : null}
      {tab === "stops" ? <Stops route={data} onOptimize={setOrderDirection} /> : null}
      {tab === "students" ? <Students route={data} /> : null}

      <RouteFormDrawer open={editOpen} onClose={() => setEditOpen(false)} route={data} />
      <RouteStatusDialog route={data} open={statusOpen} onClose={() => setStatusOpen(false)} />
      <StopOrderDialog route={data} direction={orderDirection} onClose={() => setOrderDirection(null)} />
    </PageSection>
  );
}

/* ───────────────────────────── Overview ───────────────────────────── */

function Overview({ route }: { route: RouteDetail }) {
  const t = useTranslations("RouteDetail");
  const points = useMemo<MapPoint[]>(() => {
    const outbound = route.stops.filter((stop) => stop.direction === "OUTBOUND").sort((a, b) => a.sequence - b.sequence);
    return [
      { id: "origin", lat: route.originLat, lng: route.originLng, badge: "0", title: route.originLabel ?? t("origin"), variant: "institution" as const },
      ...outbound.map((stop) => ({
        id: stop.id,
        lat: stop.latitude,
        lng: stop.longitude,
        badge: stop.stopType === "INSTITUTION" ? "★" : String(stop.sequence),
        title: stop.label ?? `#${stop.sequence}`,
        variant: stop.stopType === "INSTITUTION" ? ("institution" as const) : ("stop" as const),
      })),
    ];
  }, [route, t]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card title={t("mapOutbound")}>
        <PointsMap points={points} path className="h-[400px]" />
      </Card>
      <div className="flex flex-col gap-5">
        <Card title={t("details")}>
          <KeyValue
            items={[
              { label: t("origin"), value: route.originLabel ?? "—" },
              { label: t("delayThreshold"), value: route.delayThresholdMinutes != null ? t("minutes", { count: route.delayThresholdMinutes }) : t("institutionDefault") },
              { label: t("students"), value: route.studentCount },
              { label: t("stops"), value: route.stopCount },
            ]}
          />
        </Card>
        <DefaultCrewCard route={route} />
      </div>
    </div>
  );
}

function DefaultCrewCard({ route }: { route: RouteDetail }) {
  const t = useTranslations("RouteDetail");
  const tCommon = useTranslations("Common");
  const [editing, setEditing] = useState(false);
  const [crew, setCrew] = useState({ driverId: "", vehicleId: "", attendantId: "" });
  const query = { routeId: route.id };

  const drivers = useQuery({ queryKey: qk.institution.available("drivers", query), queryFn: () => institutionApi.availableDrivers(query), enabled: editing });
  const vehicles = useQuery({ queryKey: qk.institution.available("vehicles", query), queryFn: () => institutionApi.availableVehicles(query), enabled: editing });
  const attendants = useQuery({ queryKey: qk.institution.available("attendants", query), queryFn: () => institutionApi.availableAttendants(query), enabled: editing });

  function options(list: { value: string; label: string }[], currentId: string | null, currentLabel?: string) {
    const merged = currentId && !list.some((item) => item.value === currentId) ? [{ value: currentId, label: currentLabel ?? currentId }, ...list] : list;
    return [{ value: "", label: t("none") }, ...merged];
  }

  const save = useApiMutation({
    mutationFn: (input: CrewInput) => institutionApi.setDefaultAssignment(route.id, input),
    invalidate: [...routeKeys(route.id), ["available"], ["drivers"], ["vehicles"], ["attendants"]],
    onSuccess: () => setEditing(false),
  });

  return (
    <Card
      title={t("defaultCrew")}
      actions={
        editing ? null : (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setCrew({
                driverId: route.defaultDriverId ?? "",
                vehicleId: route.defaultVehicleId ?? "",
                attendantId: route.defaultAttendantId ?? "",
              });
              setEditing(true);
            }}
          >
            {t("edit")}
          </button>
        )
      }
    >
      {editing ? (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({
              driverId: crew.driverId || null,
              vehicleId: crew.vehicleId || null,
              attendantId: crew.attendantId || null,
            });
          }}
        >
          <Field label={t("driver")}>
            <SelectInput
              value={crew.driverId}
              onChange={(value) => setCrew((current) => ({ ...current, driverId: value }))}
              options={options(
                (drivers.data ?? []).map((item) => ({ value: item.id, label: item.user?.fullName ?? item.id })),
                route.defaultDriverId,
                route.defaultDriver?.user?.fullName,
              )}
            />
          </Field>
          <Field label={t("vehicle")}>
            <SelectInput
              value={crew.vehicleId}
              onChange={(value) => setCrew((current) => ({ ...current, vehicleId: value }))}
              options={options(
                (vehicles.data ?? []).map((item) => ({ value: item.id, label: item.capacity ? `${item.plateNumber} (${item.capacity})` : item.plateNumber })),
                route.defaultVehicleId,
                route.defaultVehicle?.plateNumber,
              )}
            />
          </Field>
          <Field label={t("attendant")}>
            <SelectInput
              value={crew.attendantId}
              onChange={(value) => setCrew((current) => ({ ...current, attendantId: value }))}
              options={options(
                (attendants.data ?? []).map((item) => ({ value: item.id, label: item.user?.fullName ?? item.id })),
                route.defaultAttendantId,
                route.defaultAttendant?.user?.fullName,
              )}
            />
          </Field>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm flex-1" disabled={save.isPending}>
              {save.isPending ? tCommon("saving") : tCommon("save")}
            </button>
            <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={() => setEditing(false)}>
              {tCommon("cancel")}
            </button>
          </div>
        </form>
      ) : (
        <KeyValue
          items={[
            { label: t("driver"), value: route.defaultDriver?.user?.fullName ?? <span className="text-warning">{t("unassigned")}</span> },
            { label: t("vehicle"), value: route.defaultVehicle ? <span dir="ltr">{route.defaultVehicle.plateNumber}</span> : <span className="text-warning">{t("unassigned")}</span> },
            { label: t("attendant"), value: route.defaultAttendant?.user?.fullName ?? "—" },
          ]}
        />
      )}
    </Card>
  );
}

/* ───────────────────────────── Status ───────────────────────────── */

function RouteStatusDialog({ route, open, onClose }: { route: RouteDetail; open: boolean; onClose: () => void }) {
  const t = useTranslations("RouteDetail");
  const tCommon = useTranslations("Common");
  const [status, setStatus] = useState<RouteStatus>(route.status);
  const [notifyUsers, setNotifyUsers] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStatus(route.status);
      setNotifyUsers(false);
    }
  }

  const save = useApiMutation({
    mutationFn: () => institutionApi.setRouteStatus(route.id, status, notifyUsers),
    invalidate: routeKeys(route.id),
    onSuccess: onClose,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("changeStatus")}
      subtitle={route.name}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {tCommon("cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending || status === route.status}>
            {save.isPending ? tCommon("saving") : tCommon("save")}
          </button>
        </>
      }
    >
      <Field label={t("status")} required hint={t(`statusHint.${status}`)}>
        <EnumSelect group="status" values={ROUTE_STATUSES} value={status} onChange={(value) => setStatus(value as RouteStatus)} />
      </Field>
      <NotifyUsersCheckbox checked={notifyUsers} onChange={setNotifyUsers} />
    </Modal>
  );
}

/* ───────────────────────────── Schedules ───────────────────────────── */

const WEEKDAYS = [6, 7, 1, 2, 3, 4, 5] as const;

function Schedules({ route }: { route: RouteDetail }) {
  const t = useTranslations("RouteDetail");
  const tDays = useTranslations("Weekdays");
  const directionLabel = useEnumLabel("direction");
  const { institution } = useInstitution();
  const [editing, setEditing] = useState<RouteSchedule | "new" | null>(null);
  const [deleting, setDeleting] = useState<RouteSchedule | null>(null);

  const remove = useApiMutation({
    mutationFn: (schedule: RouteSchedule) => institutionApi.deleteSchedule(route.id, schedule.id),
    invalidate: routeKeys(route.id),
    onSuccess: () => setDeleting(null),
  });

  const schoolFull =
    institution.type === "SCHOOL" &&
    TRIP_DIRECTIONS.every((direction) => route.schedules.some((schedule) => schedule.direction === direction));

  return (
    <Card
      title={t("schedules")}
      actions={
        <button type="button" className="btn btn-primary btn-sm" disabled={schoolFull} onClick={() => setEditing("new")}>
          <Add size={16} color="currentColor" variant="Linear" />
          {t("addSchedule")}
        </button>
      }
    >
      {institution.type === "SCHOOL" ? <p className="text-start text-xs text-text-muted">{t("schoolScheduleHint")}</p> : null}
      <DataTable
        rows={route.schedules}
        rowKey={(row) => row.id}
        emptyTitle={t("noSchedules")}
        minWidth={640}
        columns={[
          { key: "direction", header: t("direction"), cell: (row) => directionLabel(row.direction) },
          { key: "time", header: t("departure"), cell: (row) => <span className="cell-strong" dir="ltr">{row.departureTime}</span> },
          {
            key: "days",
            header: t("days"),
            cell: (row) => (
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.filter((day) => row.daysOfWeek.includes(day)).map((day) => (
                  <Chip key={day}>{tDays(String(day))}</Chip>
                ))}
              </div>
            ),
          },
          { key: "active", header: t("active"), cell: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} /> },
          {
            key: "actions",
            header: "",
            cell: (row) => (
              <div className="flex gap-1">
                <button type="button" className="icon-btn" title={t("edit")} onClick={() => setEditing(row)}>
                  <Edit size={16} color="currentColor" variant="Linear" />
                </button>
                <button type="button" className="icon-btn icon-btn--danger" title={t("delete")} onClick={() => setDeleting(row)}>
                  <Trash size={16} color="currentColor" variant="Linear" />
                </button>
              </div>
            ),
          },
        ]}
      />
      <ScheduleDialog route={route} schedule={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t("deleteSchedule")}
        description={t("deleteScheduleConfirm")}
        danger
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </Card>
  );
}

function ScheduleDialog({
  route,
  schedule,
  open,
  onClose,
}: {
  route: RouteDetail;
  schedule: RouteSchedule | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("RouteDetail");
  const tCommon = useTranslations("Common");
  const tDays = useTranslations("Weekdays");
  const { institution } = useInstitution();
  const [direction, setDirection] = useState<TripDirection>("OUTBOUND");
  const [time, setTime] = useState("07:00");
  const [days, setDays] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<{ time?: string; days?: string }>({});
  const [synced, setSynced] = useState<string | null>(null);
  const key = open ? (schedule?.id ?? "new") : null;
  if (key !== synced) {
    setSynced(key);
    if (open) {
      const used = route.schedules.map((item) => item.direction);
      const free = TRIP_DIRECTIONS.find((item) => !used.includes(item)) ?? "OUTBOUND";
      setDirection(schedule?.direction ?? (institution.type === "SCHOOL" ? free : "OUTBOUND"));
      setTime(schedule?.departureTime ?? (free === "INBOUND" ? "13:00" : "07:00"));
      setDays(schedule?.daysOfWeek ?? [7, 1, 2, 3, 4]);
      setIsActive(schedule?.isActive ?? true);
      setErrors({});
    }
  }

  const save = useApiMutation({
    mutationFn: (input: ScheduleInput) =>
      schedule ? institutionApi.updateSchedule(route.id, schedule.id, input) : institutionApi.createSchedule(route.id, input),
    invalidate: routeKeys(route.id),
    onSuccess: onClose,
  });

  function toggleDay(day: number) {
    setDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
    setErrors((current) => ({ ...current, days: undefined }));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={schedule ? t("editSchedule") : t("addSchedule")}
      onSubmit={(event) => {
        event.preventDefault();
        const next: typeof errors = {};
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) next.time = "time";
        if (days.length === 0) next.days = "required";
        setErrors(next);
        if (Object.keys(next).length) {
          scheduleFocusFirstInvalidField();
          return;
        }
        const daysOfWeek = [...days].sort((a, b) => a - b);
        save.mutate(schedule ? { direction, departureTime: time, daysOfWeek, isActive } : { direction, departureTime: time, daysOfWeek });
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
      <FormGrid>
        <Field label={t("direction")} required>
          <EnumSelect group="direction" values={TRIP_DIRECTIONS} value={direction} onChange={(value) => setDirection(value as TripDirection)} />
        </Field>
        <Field label={t("departure")} required error={errors.time}>
          <TextInput type="time" dir="ltr" value={time} onChange={(event) => setTime(event.target.value)} invalid={Boolean(errors.time)} />
        </Field>
      </FormGrid>
      <Field label={t("days")} required error={errors.days}>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              aria-pressed={days.includes(day)}
              className={cn("btn btn-sm", days.includes(day) ? "btn-primary" : "btn-secondary")}
            >
              {tDays(String(day))}
            </button>
          ))}
        </div>
      </Field>
      {schedule ? <CheckboxField checked={isActive} onChange={setIsActive} label={t("scheduleActive")} /> : null}
    </Modal>
  );
}

/* ───────────────────────────── Stops ───────────────────────────── */

function Stops({ route, onOptimize }: { route: RouteDetail; onOptimize: (direction: TripDirection) => void }) {
  const t = useTranslations("RouteDetail");
  const tCommon = useTranslations("Common");
  const stopTypeLabel = useEnumLabel("stopType");
  const [direction, setDirection] = useState<TripDirection>("OUTBOUND");
  const [draft, setDraft] = useState<RouteStop[] | null>(null);
  const [editingStop, setEditingStop] = useState<RouteStop | "new" | null>(null);
  const [deleting, setDeleting] = useState<RouteStop | null>(null);

  const stops = useQuery({
    queryKey: qk.institution.routeStops(route.id, direction),
    queryFn: () => institutionApi.stops(route.id, direction),
  });
  const ordered = draft ?? stops.data ?? [];

  const saveOrder = useApiMutation({
    mutationFn: (list: RouteStop[]) =>
      institutionApi.saveStopOrder(
        route.id,
        direction,
        list.map((stop, index) => ({ stopId: stop.id, sequence: index + 1 })),
      ),
    invalidate: [...routeKeys(route.id), ["route", route.id, "stops"]],
    onSuccess: () => setDraft(null),
  });

  const remove = useApiMutation({
    mutationFn: (stop: RouteStop) => institutionApi.deleteStop(route.id, stop.id),
    invalidate: [...routeKeys(route.id), ["route", route.id, "stops"]],
    onSuccess: () => setDeleting(null),
  });

  function move(index: number, delta: -1 | 1) {
    const list = [...ordered];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    if (list[index].stopType === "INSTITUTION" || list[target].stopType === "INSTITUTION") return;
    [list[index], list[target]] = [list[target], list[index]];
    setDraft(list);
  }

  const points: MapPoint[] = ordered.map((stop, index) => ({
    id: stop.id,
    lat: stop.latitude,
    lng: stop.longitude,
    badge: stop.stopType === "INSTITUTION" ? "★" : String(index + 1),
    title: stop.label ?? stopTypeLabel(stop.stopType),
    variant: stop.stopType === "INSTITUTION" ? "institution" : "stop",
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={direction}
          onChange={(value) => {
            setDirection(value);
            setDraft(null);
          }}
          tabs={TRIP_DIRECTIONS.map((item) => ({ id: item, label: <DirectionLabel direction={item} /> }))}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingStop("new")}>
            <Add size={16} color="currentColor" variant="Linear" />
            {t("addCustomStop")}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={ordered.length < 2} onClick={() => onOptimize(direction)}>
            {t("optimize")}
          </button>
          {draft ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>
                {tCommon("cancel")}
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={saveOrder.isPending} onClick={() => saveOrder.mutate(ordered)}>
                {saveOrder.isPending ? tCommon("saving") : t("saveOrder")}
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <DataTable
            rows={ordered}
            isLoading={stops.isPending}
            error={stops.error}
            onRetry={() => stops.refetch()}
            rowKey={(row) => row.id}
            emptyTitle={t("noStops")}
            emptyDescription={t("noStopsHint")}
            minWidth={560}
            columns={[
              { key: "seq", header: "#", cell: (row) => ordered.indexOf(row) + 1 },
              {
                key: "label",
                header: t("stop"),
                cell: (row) => (
                  <div className="flex flex-col">
                    <span className="cell-strong">{row.label ?? row.meetingPoint?.name ?? stopTypeLabel(row.stopType)}</span>
                    <span className="text-xs text-text-muted">{stopTypeLabel(row.stopType)}</span>
                  </div>
                ),
              },
              { key: "students", header: t("students"), cell: (row) => row.studentIds.length || "—" },
              { key: "eta", header: t("etaOffset"), cell: (row) => (row.etaOffsetMinutes != null ? t("etaOffsetValue", { minutes: row.etaOffsetMinutes }) : <span className="text-warning">—</span>) },
              {
                key: "actions",
                header: "",
                cell: (row) => {
                  const index = ordered.indexOf(row);
                  const fixed = row.stopType === "INSTITUTION";
                  return (
                    <div className="flex gap-1">
                      {!fixed ? (
                        <>
                          <button type="button" className="icon-btn" title={t("moveUp")} disabled={index === 0} onClick={() => move(index, -1)}>
                            <ArrowUp size={16} color="currentColor" variant="Linear" />
                          </button>
                          <button type="button" className="icon-btn" title={t("moveDown")} disabled={index === ordered.length - 1} onClick={() => move(index, 1)}>
                            <ArrowDown size={16} color="currentColor" variant="Linear" />
                          </button>
                        </>
                      ) : null}
                      {row.stopType === "CUSTOM" ? (
                        <>
                          <button type="button" className="icon-btn" title={t("edit")} onClick={() => setEditingStop(row)}>
                            <Edit size={16} color="currentColor" variant="Linear" />
                          </button>
                          <button type="button" className="icon-btn icon-btn--danger" title={t("delete")} onClick={() => setDeleting(row)}>
                            <Trash size={16} color="currentColor" variant="Linear" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  );
                },
              },
            ]}
          />
          {draft ? <p className="text-start text-xs text-warning">{t("unsavedOrder")}</p> : null}
        </Card>
        <Card>
          <PointsMap points={points} path className="h-[420px]" />
        </Card>
      </div>
      <CustomStopDialog route={route} direction={direction} stop={editingStop === "new" ? null : editingStop} open={editingStop !== null} onClose={() => setEditingStop(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t("deleteStop")}
        description={t("deleteStopConfirm")}
        danger
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}

function DirectionLabel({ direction }: { direction: string }) {
  const label = useEnumLabel("direction");
  return <>{label(direction)}</>;
}

function CustomStopDialog({
  route,
  direction,
  stop,
  open,
  onClose,
}: {
  route: RouteDetail;
  direction: TripDirection;
  stop: RouteStop | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("RouteDetail");
  const tCommon = useTranslations("Common");
  const [label, setLabel] = useState("");
  const [coords, setCoords] = useState({ lat: route.originLat, lng: route.originLng });
  const [error, setError] = useState<string>();
  const [synced, setSynced] = useState<string | null>(null);
  const key = open ? (stop?.id ?? "new") : null;
  if (key !== synced) {
    setSynced(key);
    if (open) {
      setLabel(stop?.label ?? "");
      setCoords(stop ? { lat: stop.latitude, lng: stop.longitude } : { lat: route.originLat, lng: route.originLng });
      setError(undefined);
    }
  }

  const save = useApiMutation({
    mutationFn: () => {
      const body = { label: label.trim() || undefined, latitude: coords.lat, longitude: coords.lng };
      return stop ? institutionApi.updateStop(route.id, stop.id, body) : institutionApi.createStop(route.id, { direction, ...body });
    },
    invalidate: [...routeKeys(route.id), ["route", route.id, "stops"]],
    onSuccess: onClose,
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={stop ? t("editStop") : t("addCustomStop")}
      subtitle={t("customStopHint")}
      onSubmit={(event) => {
        event.preventDefault();
        if (label.trim() && label.trim().length < 2) {
          setError("min2");
          return;
        }
        save.mutate();
      }}
      footer={
        <>
          <button type="submit" className="btn btn-primary flex-1" disabled={save.isPending}>
            {save.isPending ? tCommon("saving") : tCommon("save")}
          </button>
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            {tCommon("cancel")}
          </button>
        </>
      }
    >
      <Field label={t("stopLabel")} error={error}>
        <TextInput value={label} onChange={(event) => setLabel(event.target.value)} invalid={Boolean(error)} />
      </Field>
      <LocationPickerMap lat={coords.lat} lng={coords.lng} onChange={setCoords} />
    </Drawer>
  );
}

/** Stale stop order: run the optimizer, preview the proposal, then persist it with PUT stop-order. */
function StopOrderDialog({
  route,
  direction,
  onClose,
}: {
  route: RouteDetail;
  direction: TripDirection | null;
  onClose: () => void;
}) {
  const t = useTranslations("RouteDetail");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const stopTypeLabel = useEnumLabel("stopType");
  const directionLabel = useEnumLabel("direction");
  const [result, setResult] = useState<OptimizeStopsResult | null>(null);
  const [active, setActive] = useState<TripDirection | null>(null);
  const [synced, setSynced] = useState<TripDirection | null>(null);
  if (direction !== synced) {
    setSynced(direction);
    setActive(direction);
    setResult(null);
  }

  const optimize = useApiMutation({
    mutationFn: (dir: TripDirection) => institutionApi.optimizeStops(route.id, dir),
    successMessage: false,
    onSuccess: setResult,
  });
  const runOptimize = optimize.mutate;

  useEffect(() => {
    if (active) runOptimize(active);
  }, [active, runOptimize]);

  const apply = useApiMutation({
    mutationFn: (proposal: OptimizeStopsResult) =>
      institutionApi.saveStopOrder(
        route.id,
        proposal.direction,
        proposal.stops.map((stop) => ({ stopId: stop.stopId, sequence: stop.sequence })),
      ),
    invalidate: [...routeKeys(route.id), ["route", route.id, "stops"]],
    successMessage: t("orderSaved"),
    onSuccess: onClose,
  });

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const distance = (meters: number, seconds: number) =>
    t("distanceValue", { km: number.format(meters / 1000), minutes: number.format(Math.round(seconds / 60)) });

  return (
    <Modal
      open={direction !== null}
      onClose={onClose}
      title={t("optimizeTitle")}
      subtitle={active ? directionLabel(active) : undefined}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {tCommon("cancel")}
          </button>
          {active ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setResult(null);
                setActive(active === "OUTBOUND" ? "INBOUND" : "OUTBOUND");
              }}
              disabled={optimize.isPending}
            >
              {t("otherDirection")}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!result || result.direction !== active || optimize.isPending || apply.isPending}
            onClick={() => result && apply.mutate(result)}
          >
            {apply.isPending ? tCommon("saving") : t("applyOrder")}
          </button>
        </>
      }
    >
      {optimize.isPending || (active && !result && !optimize.isError) ? (
        <LoadingState rows={4} />
      ) : optimize.isError ? (
        <ErrorState error={optimize.error} onRetry={() => active && runOptimize(active)} />
      ) : result ? (
        <>
          <KeyValue
            items={[
              { label: t("currentDistance"), value: distance(result.current.totalDistanceMeters, result.current.totalDurationSeconds) },
              { label: t("proposedDistance"), value: distance(result.totalDistanceMeters, result.totalDurationSeconds) },
            ]}
          />
          <p className={cn("text-start text-sm", result.improved ? "text-success" : "text-text-secondary")}>
            {result.improved ? t("improved") : t("notImproved")}
          </p>
          <ol className="flex flex-col gap-1.5">
            {result.stops.map((stop) => (
              <li key={stop.stopId} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-start text-sm">
                <span className="flex min-w-0 items-start gap-2">
                  <span className="font-semibold text-text-primary">{stop.sequence}.</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{stop.label ?? stopTypeLabel(stop.stopType)}</span>
                    {stop.address ? <span className="truncate text-xs text-text-muted">{stop.address}</span> : null}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-text-muted">
                  {stop.etaOffsetMinutes != null ? t("etaOffsetValue", { minutes: number.format(stop.etaOffsetMinutes) }) : ""}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </Modal>
  );
}

/* ───────────────────────────── Students ───────────────────────────── */

function Students({ route }: { route: RouteDetail }) {
  const t = useTranslations("RouteDetail");
  const pickupLabel = useEnumLabel("pickupType");
  const [assignOpen, setAssignOpen] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const remove = useApiMutation({
    mutationFn: (studentId: string) => institutionApi.removeRouteStudent(route.id, studentId),
    invalidate: [...routeKeys(route.id), ["students"], ["route", route.id, "stops"]],
    onSuccess: () => setRemoving(null),
  });

  return (
    <Card
      title={t("students")}
      actions={
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAssignOpen(true)}>
          <Add size={16} color="currentColor" variant="Linear" />
          {t("assignStudents")}
        </button>
      }
    >
      <DataTable
        rows={route.students}
        rowKey={(row) => row.id}
        emptyTitle={t("noStudents")}
        minWidth={720}
        columns={[
          {
            key: "name",
            header: t("student"),
            cell: (row) => (
              <Link href={`/institution/students/${row.id}`} className="cell-strong hover:text-accent">
                {row.fullName}
              </Link>
            ),
          },
          { key: "grade", header: t("grade"), cell: (row) => [row.grade, row.section].filter(Boolean).join(" / ") || "—" },
          { key: "guardian", header: t("guardian"), cell: (row) => row.guardian?.fullName ?? "—" },
          { key: "pickup", header: t("pickup"), cell: (row) => (row.pickup ? pickupLabel(row.pickup.pickupType) : "—") },
          { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "",
            cell: (row) => (
              <button type="button" className="icon-btn icon-btn--danger" title={t("removeStudent")} onClick={() => setRemoving({ id: row.id, name: row.fullName })}>
                <Trash size={16} color="currentColor" variant="Linear" />
              </button>
            ),
          },
        ]}
      />
      <AssignStudentsDrawer route={route} open={assignOpen} onClose={() => setAssignOpen(false)} />
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={t("removeStudent")}
        description={t("removeStudentConfirm", { name: removing?.name ?? "" })}
        danger
        pending={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </Card>
  );
}

function AssignStudentsDrawer({ route, open, onClose }: { route: RouteDetail; open: boolean; onClose: () => void }) {
  const t = useTranslations("RouteDetail");
  const tCommon = useTranslations("Common");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSearch("");
      setSelected([]);
    }
  }

  const query = { branchId: route.branchId, withoutRoute: "true", status: "ACTIVE", search: search || undefined, limit: 100 };
  const candidates = useQuery({
    queryKey: qk.institution.students(query),
    queryFn: () => institutionApi.students(query),
    enabled: open,
  });

  const assign = useApiMutation({
    mutationFn: () => institutionApi.assignRouteStudents(route.id, selected),
    invalidate: [...routeKeys(route.id), ["students"], ["route", route.id, "stops"]],
    onSuccess: onClose,
  });

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("assignStudents")}
      subtitle={t("assignHint")}
      onSubmit={(event) => {
        event.preventDefault();
        if (selected.length) assign.mutate();
      }}
      footer={
        <>
          <button type="submit" className="btn btn-primary flex-1" disabled={assign.isPending || selected.length === 0}>
            {assign.isPending ? tCommon("saving") : t("assignCount", { count: selected.length })}
          </button>
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            {tCommon("cancel")}
          </button>
        </>
      }
    >
      <SearchInput value={search} onChange={setSearch} placeholder={t("searchStudents")} className="max-w-none" />
      {candidates.isPending ? (
        <LoadingState rows={5} />
      ) : candidates.isError ? (
        <ErrorState error={candidates.error} onRetry={() => candidates.refetch()} />
      ) : candidates.data.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">{t("noCandidates")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {candidates.data.data.map((student) => (
            <li key={student.id}>
              <CheckboxField
                checked={selected.includes(student.id)}
                onChange={() => toggle(student.id)}
                label={
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-text-primary">{student.fullName}</span>
                    <span className="text-xs text-text-muted">
                      {[student.grade, student.section].filter(Boolean).join(" / ")}
                      {student.pickup ? "" : ` · ${t("noPickup")}`}
                    </span>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
