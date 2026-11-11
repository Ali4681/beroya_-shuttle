"use client";

import { useQuery } from "@tanstack/react-query";
import { Add, Edit, Trash } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { z } from "zod";
import type { MeetingPoint } from "@/domain/models/entities";
import { RESOURCE_STATUSES } from "@/domain/models/enums";
import { institutionApi, type MeetingPointInput } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { LocationPickerMap } from "@/presentation/components/map/location-picker-map";
import { PointsMap, type MapPoint } from "@/presentation/components/map/points-map";
import { StatusBadge } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, FormGrid, SelectInput, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { Drawer } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, ConfirmDialog, EnumFilterSelect, FilterSelect, PageSection, Toolbar } from "@/presentation/components/ui/panel";
import { useBranchName, useBranchOptions, useInstitution } from "@/presentation/features/institution/use-institution";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState, useResetOnKey } from "@/presentation/hooks/use-form-state";
import { v } from "@/shared/lib/validation";

export function MeetingPointsView() {
  const t = useTranslations("MeetingPoints");
  const branchName = useBranchName();
  const branchOptions = useBranchOptions();
  const [branchId, setBranchId] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [editing, setEditing] = useState<MeetingPoint | "new" | null>(null);
  const [statusTarget, setStatusTarget] = useState<MeetingPoint | null>(null);
  const [deleting, setDeleting] = useState<MeetingPoint | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const points = useQuery({ queryKey: qk.institution.meetingPoints, queryFn: () => institutionApi.meetingPoints() });
  const rows = useMemo(
    () => (points.data ?? []).filter((point) => (!branchId || point.branchId === branchId) && (!status || point.status === status)),
    [points.data, branchId, status],
  );
  const mapPoints = useMemo<MapPoint[]>(
    () => rows.map((point) => ({ id: point.id, lat: point.latitude, lng: point.longitude, badge: "M", title: point.name, variant: "stop" })),
    [rows],
  );

  const toggleStatus = useApiMutation({
    mutationFn: (point: MeetingPoint) => institutionApi.setMeetingPointStatus(point.id, point.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"),
    invalidate: [qk.institution.meetingPoints],
    onSuccess: () => setStatusTarget(null),
  });
  const remove = useApiMutation({
    mutationFn: (point: MeetingPoint) => institutionApi.deleteMeetingPoint(point.id),
    invalidate: [qk.institution.meetingPoints],
    successMessage: t("deleted"),
    onSuccess: () => setDeleting(null),
  });

  return (
    <PageSection>
      <PageHeader
        icon="location"
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Add size={16} color="currentColor" variant="Linear" />
            {t("add")}
          </button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <Toolbar>
            {branchOptions.length > 1 ? <FilterSelect placeholder={t("branch")} value={branchId} onChange={setBranchId} options={branchOptions} /> : null}
            <EnumFilterSelect placeholder={t("status")} value={status} onChange={setStatus} group="status" values={RESOURCE_STATUSES} />
          </Toolbar>
          <DataTable
            rows={rows}
            isLoading={points.isPending}
            error={points.error}
            onRetry={() => points.refetch()}
            rowKey={(row) => row.id}
            onRowClick={(row) => setSelectedId(row.id)}
            emptyTitle={t("empty")}
            emptyDescription={t("emptyHint")}
            minWidth={600}
            columns={[
              {
                key: "name",
                header: t("name"),
                cell: (row) => (
                  <div className="flex flex-col">
                    <span className="cell-strong">{row.name}</span>
                    {row.addressLabel ? <span className="text-xs text-text-muted">{row.addressLabel}</span> : null}
                  </div>
                ),
              },
              { key: "branch", header: t("branch"), cell: (row) => (row.branchId ? branchName(row.branchId) : t("allBranches")) },
              { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
              {
                key: "actions",
                header: "",
                cell: (row) => (
                  <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="icon-btn" title={t("edit")} onClick={() => setEditing(row)}>
                      <Edit size={16} color="currentColor" variant="Linear" />
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatusTarget(row)}>
                      {row.status === "ACTIVE" ? t("suspend") : t("activate")}
                    </button>
                    <button type="button" className="icon-btn icon-btn--danger" title={t("delete")} onClick={() => setDeleting(row)}>
                      <Trash size={16} color="currentColor" variant="Linear" />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
        <Card>
          <PointsMap points={mapPoints} className="h-[480px]" selectedId={selectedId} onPointClick={setSelectedId} />
        </Card>
      </div>
      <MeetingPointDrawer point={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.status === "ACTIVE" ? t("suspendTitle") : t("activateTitle")}
        description={statusTarget?.status === "ACTIVE" ? t("suspendConfirm") : t("activateConfirm")}
        danger={statusTarget?.status === "ACTIVE"}
        pending={toggleStatus.isPending}
        onConfirm={() => statusTarget && toggleStatus.mutate(statusTarget)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleting?.name ?? "" })}
        danger
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </PageSection>
  );
}

const pointSchema = z.object({
  name: v.name(),
  addressLabel: v.optionalText(),
  branchId: v.optionalText(),
  latitude: v.latitude(),
  longitude: v.longitude(),
});

function MeetingPointDrawer({ point, open, onClose }: { point: MeetingPoint | null; open: boolean; onClose: () => void }) {
  const t = useTranslations("MeetingPoints");
  const tCommon = useTranslations("Common");
  const { branches } = useInstitution();
  const branchOptions = useBranchOptions();
  const initial = {
    name: point?.name ?? "",
    addressLabel: point?.addressLabel ?? "",
    branchId: point?.branchId ?? "",
    latitude: point?.latitude ?? branches[0]?.latitude ?? 36.19934,
    longitude: point?.longitude ?? branches[0]?.longitude ?? 37.15822,
  };
  const form = useFormState(initial);
  useResetOnKey(open ? (point?.id ?? "new") : null, form.reset, initial);
  const { values, set, errors } = form;

  const save = useApiMutation({
    mutationFn: (input: MeetingPointInput) => (point ? institutionApi.updateMeetingPoint(point.id, input) : institutionApi.createMeetingPoint(input)),
    invalidate: [qk.institution.meetingPoints],
    onError: form.captureServerError,
    onSuccess: onClose,
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={point ? t("edit") : t("add")}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(pointSchema);
        if (data) save.mutate(data);
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
      <ValidationList errors={form.serverErrors} />
      <FormGrid>
        <Field label={t("name")} required error={errors.name}>
          <TextInput value={values.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
        </Field>
        <Field label={t("branch")} hint={t("branchHint")}>
          <SelectInput value={values.branchId} onChange={(value) => set("branchId", value)} options={[{ value: "", label: t("allBranches") }, ...branchOptions]} />
        </Field>
      </FormGrid>
      <Field label={t("addressLabel")}>
        <TextInput value={values.addressLabel} onChange={(e) => set("addressLabel", e.target.value)} />
      </Field>
      <Field label={t("location")} required error={errors.latitude ?? errors.longitude}>
        <LocationPickerMap
          lat={values.latitude}
          lng={values.longitude}
          onChange={(coords) => form.setValues((current) => ({ ...current, latitude: coords.lat, longitude: coords.lng }))}
        />
      </Field>
    </Drawer>
  );
}
