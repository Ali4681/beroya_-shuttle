"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Add, Edit, Trash } from "iconsax-react-v2";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { StudentDetail, StudentTrip } from "@/domain/models/entities";
import { TRIP_DIRECTIONS, type TripDirection } from "@/domain/models/enums";
import { Link } from "@/i18n/navigation";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { PointsMap } from "@/presentation/components/map/points-map";
import { AppDatePicker } from "@/presentation/components/ui/app-date-picker";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, scheduleFocusFirstInvalidField, SelectInput, TextInput } from "@/presentation/components/ui/form";
import { Modal } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, ConfirmDialog, KeyValue, PageSection, Tabs } from "@/presentation/components/ui/panel";
import { ErrorState, LoadingState } from "@/presentation/components/ui/states";
import {
  GuardianModal,
  PickupDrawer,
  StudentDrawer,
  studentKeys,
} from "@/presentation/features/institution/student-forms";
import { StudentAvatar } from "@/presentation/features/institution/students-view";
import { useBranchName, useRouteOptions } from "@/presentation/features/institution/use-institution";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { formatDate, formatServiceDate, formatTime, todayISO } from "@/shared/lib/format";

type Tab = "overview" | "exceptions" | "trips" | "boarding";

export function StudentDetailView({ studentId }: { studentId: string }) {
  const t = useTranslations("StudentDetail");
  const locale = useLocale();
  const branchName = useBranchName();
  const subscriptionLabel = useEnumLabel("subscriptionType");
  const [tab, setTab] = useState<Tab>("overview");
  const [dialog, setDialog] = useState<"edit" | "guardian" | "pickup" | "status" | null>(null);

  const student = useQuery({ queryKey: qk.institution.student(studentId), queryFn: () => institutionApi.student(studentId) });

  const toggleStatus = useApiMutation({
    mutationFn: (current: StudentDetail) => institutionApi.setStudentStatus(current.id, current.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
    invalidate: studentKeys(studentId),
    onSuccess: () => setDialog(null),
  });

  if (student.isPending) {
    return (
      <PageSection>
        <LoadingState rows={8} />
      </PageSection>
    );
  }
  if (student.isError) {
    return (
      <PageSection>
        <ErrorState error={student.error} onRetry={() => student.refetch()} />
      </PageSection>
    );
  }
  const data = student.data;

  return (
    <PageSection>
      <div className="flex flex-wrap items-center gap-4">
        <StudentAvatar name={data.fullName} url={data.photoUrl} />
        <div className="min-w-0 flex-1">
          <PageHeader
            icon="student"
            title={data.fullName}
            subtitle={`${branchName(data.branchId)}${data.grade ? ` · ${data.grade}` : ""}${data.section ? ` / ${data.section}` : ""}`}
            actions={
              <>
                <StatusBadge status={data.status} />
                <button type="button" className={data.status === "ACTIVE" ? "btn btn-danger" : "btn btn-secondary"} onClick={() => setDialog("status")}>
                  {data.status === "ACTIVE" ? t("deactivate") : t("activate")}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setDialog("edit")}>
                  <Edit size={16} color="currentColor" variant="Linear" />
                  {t("edit")}
                </button>
              </>
            }
          />
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: t("tabOverview") },
          { id: "exceptions", label: t("tabExceptions") },
          { id: "trips", label: t("tabTrips") },
          { id: "boarding", label: t("tabBoarding") },
        ]}
      />

      {tab === "overview" ? (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card title={t("details")}>
            <KeyValue
              items={[
                { label: t("subscriptionType"), value: subscriptionLabel(data.subscriptionType) },
                {
                  label: t("route"),
                  value: data.currentRoute ? (
                    <Link href={`/institution/routes/${data.currentRoute.id}`} className="text-accent hover:underline">
                      {data.currentRoute.name}
                    </Link>
                  ) : (
                    <Chip tone="warning">{t("noRoute")}</Chip>
                  ),
                },
                { label: t("createdAt"), value: formatDate(data.createdAt, locale) },
              ]}
            />
          </Card>
          <Card
            title={t("guardian")}
            actions={
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog("guardian")}>
                {t("edit")}
              </button>
            }
          >
            <KeyValue
              items={[
                { label: t("guardianName"), value: data.guardian?.fullName },
                { label: t("guardianPhone"), value: <span dir="ltr">{data.guardian?.phone ?? "—"}</span> },
                { label: t("guardianStatus"), value: <StatusBadge status={data.guardian?.status} /> },
              ]}
            />
          </Card>
          <PickupCard student={data} onEdit={() => setDialog("pickup")} />
        </div>
      ) : null}
      {tab === "exceptions" ? <RouteExceptions student={data} /> : null}
      {tab === "trips" ? <StudentTrips studentId={studentId} kind="trips" /> : null}
      {tab === "boarding" ? <StudentTrips studentId={studentId} kind="boarding" /> : null}

      <StudentDrawer open={dialog === "edit"} onClose={() => setDialog(null)} student={data} />
      <GuardianModal student={data} open={dialog === "guardian"} onClose={() => setDialog(null)} />
      <PickupDrawer student={data} open={dialog === "pickup"} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={dialog === "status"}
        onClose={() => setDialog(null)}
        title={data.status === "ACTIVE" ? t("deactivateTitle") : t("activateTitle")}
        description={data.status === "ACTIVE" ? t("deactivateConfirm") : t("activateConfirm")}
        danger={data.status === "ACTIVE"}
        pending={toggleStatus.isPending}
        onConfirm={() => toggleStatus.mutate(data)}
      />
    </PageSection>
  );
}

function PickupCard({ student, onEdit }: { student: StudentDetail; onEdit: () => void }) {
  const t = useTranslations("StudentDetail");
  const pickupLabel = useEnumLabel("pickupType");
  const pickup = student.pickup;
  const lat = pickup?.pickupType === "MEETING_POINT" ? pickup.meetingPoint?.latitude : pickup?.latitude;
  const lng = pickup?.pickupType === "MEETING_POINT" ? pickup.meetingPoint?.longitude : pickup?.longitude;

  return (
    <Card
      title={t("pickup")}
      actions={
        <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
          {t("edit")}
        </button>
      }
    >
      <KeyValue
        items={[
          { label: t("pickupType"), value: pickup ? pickupLabel(pickup.pickupType) : "—" },
          {
            label: pickup?.pickupType === "MEETING_POINT" ? t("meetingPoint") : t("address"),
            value: pickup?.pickupType === "MEETING_POINT" ? pickup.meetingPoint?.name : pickup?.addressLabel,
          },
        ]}
      />
      {lat != null && lng != null ? (
        <PointsMap className="h-[180px]" points={[{ id: "pickup", lat, lng, badge: "●", variant: "stop" }]} />
      ) : null}
      {student.routeStopsStale ? <p className="text-start text-xs text-warning">{t("stopsStaleHint")}</p> : null}
    </Card>
  );
}

function RouteExceptions({ student }: { student: StudentDetail }) {
  const t = useTranslations("StudentDetail");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const directionLabel = useEnumLabel("direction");
  const routeOptions = useRouteOptions(student.branchId);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ overrideRouteId: "", direction: "" as TripDirection | "", date: todayISO(), reason: "" });
  const [errors, setErrors] = useState<{ overrideRouteId?: string; date?: string }>({});

  const exceptions = useQuery({
    queryKey: qk.institution.studentPart(student.id, "route-exceptions"),
    queryFn: () => institutionApi.routeExceptions(student.id),
  });
  const keys = [qk.institution.studentPart(student.id, "route-exceptions"), qk.institution.trips];

  const create = useApiMutation({
    mutationFn: () =>
      institutionApi.createRouteException(student.id, {
        overrideRouteId: form.overrideRouteId,
        direction: form.direction || undefined,
        date: form.date,
        reason: form.reason.trim() || undefined,
      }),
    invalidate: keys,
    onSuccess: () => setCreateOpen(false),
  });
  const remove = useApiMutation({
    mutationFn: (id: string) => institutionApi.deleteRouteException(student.id, id),
    invalidate: keys,
    onSuccess: () => setDeleting(null),
  });

  return (
    <Card
      title={t("exceptions")}
      actions={
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setForm({ overrideRouteId: "", direction: "", date: todayISO(), reason: "" });
            setErrors({});
            setCreateOpen(true);
          }}
        >
          <Add size={16} color="currentColor" variant="Linear" />
          {t("addException")}
        </button>
      }
    >
      <p className="text-start text-xs text-text-muted">{t("exceptionsHint")}</p>
      <DataTable
        rows={exceptions.data}
        isLoading={exceptions.isPending}
        error={exceptions.error}
        onRetry={() => exceptions.refetch()}
        rowKey={(row) => row.id}
        emptyTitle={t("noExceptions")}
        minWidth={620}
        columns={[
          { key: "date", header: t("date"), cell: (row) => formatServiceDate(row.date, locale) },
          { key: "route", header: t("overrideRoute"), cell: (row) => <span className="cell-strong">{row.overrideRoute?.name ?? "—"}</span> },
          { key: "direction", header: t("direction"), cell: (row) => (row.direction ? directionLabel(row.direction) : t("bothDirections")) },
          { key: "reason", header: tCommon("reason"), cell: (row) => <span dir="auto">{row.reason ?? "—"}</span> },
          {
            key: "actions",
            header: "",
            cell: (row) => (
              <button type="button" className="icon-btn icon-btn--danger" title={t("delete")} onClick={() => setDeleting(row.id)}>
                <Trash size={16} color="currentColor" variant="Linear" />
              </button>
            ),
          },
        ]}
      />
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("addException")}
        onSubmit={(event) => {
          event.preventDefault();
          const next: typeof errors = {};
          if (!form.overrideRouteId) next.overrideRouteId = "required";
          if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) next.date = "date";
          setErrors(next);
          if (Object.keys(next).length) {
            scheduleFocusFirstInvalidField();
            return;
          }
          create.mutate();
        }}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
              {tCommon("cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={create.isPending}>
              {create.isPending ? tCommon("saving") : tCommon("save")}
            </button>
          </>
        }
      >
        <Field label={t("overrideRoute")} required error={errors.overrideRouteId}>
          <SelectInput
            value={form.overrideRouteId}
            onChange={(value) => setForm((current) => ({ ...current, overrideRouteId: value }))}
            options={routeOptions.filter((option) => option.value !== student.currentRoute?.id)}
          />
        </Field>
        <Field label={t("date")} required error={errors.date}>
          <AppDatePicker value={form.date} invalid={!!errors.date} onChange={(value) => setForm((current) => ({ ...current, date: value }))} />
        </Field>
        <Field label={t("direction")}>
          <SelectInput
            value={form.direction}
            onChange={(value) => setForm((current) => ({ ...current, direction: value as TripDirection | "" }))}
            options={[{ value: "", label: t("bothDirections") }, ...TRIP_DIRECTIONS.map((value) => ({ value, label: directionLabel(value) }))]}
          />
        </Field>
        <Field label={tCommon("reason")}>
          <TextInput value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
        </Field>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t("deleteException")}
        description={t("deleteExceptionConfirm")}
        danger
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </Card>
  );
}

function StudentTrips({ studentId, kind }: { studentId: string; kind: "trips" | "boarding" }) {
  const t = useTranslations("StudentDetail");
  const locale = useLocale();
  const directionLabel = useEnumLabel("direction");
  const [page, setPage] = useState(1);
  const query = { page, limit: 20 };
  const list = useQuery({
    queryKey: qk.institution.studentPart(studentId, `${kind}-${page}`),
    queryFn: () => (kind === "trips" ? institutionApi.studentTrips(studentId, query) : institutionApi.boardingHistory(studentId, query)),
    placeholderData: keepPreviousData,
  });

  return (
    <Card>
      <DataTable<StudentTrip>
        rows={list.data?.data}
        meta={list.data?.meta}
        onPageChange={setPage}
        isLoading={list.isPending}
        error={list.error}
        onRetry={() => list.refetch()}
        rowKey={(row) => row.id}
        emptyTitle={kind === "trips" ? t("noTrips") : t("noBoarding")}
        minWidth={760}
        columns={[
          {
            key: "date",
            header: t("date"),
            cell: (row) => (
              <Link href={`/institution/trips/${row.trip.id}`} className="cell-strong hover:text-accent">
                {formatServiceDate(row.trip.serviceDate, locale)}
              </Link>
            ),
          },
          { key: "time", header: t("departure"), cell: (row) => <span dir="ltr">{row.trip.scheduledDepartureTime}</span> },
          { key: "direction", header: t("direction"), cell: (row) => directionLabel(row.trip.direction) },
          { key: "boarded", header: t("boardedAt"), cell: (row) => formatTime(row.boardedAt, locale) },
          { key: "dropped", header: t("droppedAt"), cell: (row) => formatTime(row.droppedOffAt, locale) },
          {
            key: "status",
            header: t("status"),
            cell: (row) => (
              <div className="flex flex-wrap gap-1">
                <StatusBadge status={row.status} />
                {row.isException ? <Chip tone="info">{t("exception")}</Chip> : null}
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}
