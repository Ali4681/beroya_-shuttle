"use client";

import type { QueryKey } from "@tanstack/react-query";
import { Add, Edit, Trash } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import type { Branch } from "@/domain/models/entities";
import type { ResourceStatus } from "@/domain/models/enums";
import type { BranchInput } from "@/infrastructure/api/institution.api";
import { LocationPickerMap } from "@/presentation/components/map/location-picker-map";
import { StatusBadge } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { Drawer } from "@/presentation/components/ui/overlay";
import { Card, ConfirmDialog } from "@/presentation/components/ui/panel";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState, useResetOnKey } from "@/presentation/hooks/use-form-state";
import { v } from "@/shared/lib/validation";

export type BranchesApi = {
  create: (input: BranchInput) => Promise<Branch>;
  update: (id: string, input: Partial<BranchInput>) => Promise<Branch>;
  setStatus: (id: string, status: ResourceStatus) => Promise<Branch>;
  remove: (id: string) => Promise<unknown>;
};

export function BranchesManager({
  title,
  rows,
  isLoading,
  error,
  onRetry,
  api,
  invalidate,
  onRowClick,
}: {
  title?: string;
  rows: Branch[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  api: BranchesApi;
  invalidate: QueryKey[];
  onRowClick?: (branch: Branch) => void;
}) {
  const t = useTranslations("Branches");
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  const [statusTarget, setStatusTarget] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);

  const setStatus = useApiMutation({
    mutationFn: (branch: Branch) => api.setStatus(branch.id, branch.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"),
    invalidate,
    onSuccess: () => setStatusTarget(null),
  });
  const remove = useApiMutation({
    mutationFn: (branch: Branch) => api.remove(branch.id),
    invalidate,
    successMessage: t("deleted"),
    onSuccess: () => setDeleting(null),
  });

  return (
    <Card
      title={title}
      actions={
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
          <Add size={16} color="currentColor" variant="Linear" />
          {t("add")}
        </button>
      }
    >
      <DataTable
        rows={rows}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
        emptyTitle={t("empty")}
        minWidth={720}
        columns={[
          { key: "name", header: t("name"), cell: (row) => <span className="cell-strong">{row.name}</span> },
          { key: "address", header: t("address"), cell: (row) => row.address ?? "—" },
          {
            key: "coords",
            header: t("location"),
            cell: (row) =>
              row.latitude != null && row.longitude != null ? (
                <span className="text-xs text-text-muted" dir="ltr">
                  {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                </span>
              ) : (
                <span className="text-warning">{t("noLocation")}</span>
              ),
          },
          { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "",
            cell: (row) => (
              <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="icon-btn" title={t("edit")} onClick={() => setEditing(row)}>
                  <Edit size={16} color="currentColor" variant="Linear" />
                </button>
                <button type="button" className={row.status === "ACTIVE" ? "btn btn-danger btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setStatusTarget(row)}>
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

      <BranchDrawer
        branch={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        api={api}
        invalidate={invalidate}
      />
      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.status === "ACTIVE" ? t("suspendTitle") : t("activateTitle")}
        description={statusTarget?.status === "ACTIVE" ? t("suspendConfirm") : t("activateConfirm")}
        danger={statusTarget?.status === "ACTIVE"}
        pending={setStatus.isPending}
        onConfirm={() => statusTarget && setStatus.mutate(statusTarget)}
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
    </Card>
  );
}

const branchSchema = z.object({
  name: v.name(),
  address: v.optionalText(),
  latitude: v.latitude(),
  longitude: v.longitude(),
});

function BranchDrawer({
  branch,
  open,
  onClose,
  api,
  invalidate,
}: {
  branch: Branch | null;
  open: boolean;
  onClose: () => void;
  api: BranchesApi;
  invalidate: QueryKey[];
}) {
  const t = useTranslations("Branches");
  const tCommon = useTranslations("Common");
  const initial = {
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    latitude: branch?.latitude ?? 36.19934,
    longitude: branch?.longitude ?? 37.15822,
  };
  const form = useFormState(initial);
  useResetOnKey(open ? (branch?.id ?? "new") : null, form.reset, initial);
  const { values, set, errors } = form;

  const save = useApiMutation({
    mutationFn: (input: BranchInput) => (branch ? api.update(branch.id, input) : api.create(input)),
    invalidate,
    onError: form.captureServerError,
    onSuccess: onClose,
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={branch ? t("edit") : t("add")}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(branchSchema);
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
      <Field label={t("name")} required error={errors.name}>
        <TextInput value={values.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
      </Field>
      <Field label={t("address")}>
        <TextInput value={values.address} onChange={(e) => set("address", e.target.value)} />
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
