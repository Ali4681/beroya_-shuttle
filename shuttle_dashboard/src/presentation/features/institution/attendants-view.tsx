"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Add, Edit } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import type { Attendant } from "@/domain/models/entities";
import { RESOURCE_STATUSES } from "@/domain/models/enums";
import { institutionApi, type AttendantInput } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { Chip, StatusBadge } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, PasswordInput, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { Drawer } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, ConfirmDialog, EnumFilterSelect, FilterSelect, PageSection, SearchInput, Toolbar } from "@/presentation/components/ui/panel";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState, useResetOnKey } from "@/presentation/hooks/use-form-state";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { v } from "@/shared/lib/validation";

export function AttendantsView() {
  const t = useTranslations("Attendants");
  const [editing, setEditing] = useState<Attendant | "new" | null>(null);
  const [statusTarget, setStatusTarget] = useState<Attendant | null>(null);
  const { filters, setFilter, setPage, query } = useListParams({
    search: undefined as string | undefined,
    status: undefined as string | undefined,
    assigned: undefined as string | undefined,
  });

  const list = useQuery({
    queryKey: qk.institution.attendants(query),
    queryFn: () => institutionApi.attendants(query),
    placeholderData: keepPreviousData,
  });

  const toggle = useApiMutation({
    mutationFn: (item: Attendant) => institutionApi.setAttendantStatus(item.id, item.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"),
    invalidate: [qk.institution.attendants()],
    onSuccess: () => setStatusTarget(null),
  });

  return (
    <PageSection>
      <PageHeader
        icon="attendant"
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Add size={16} color="currentColor" variant="Linear" />
            {t("add")}
          </button>
        }
      />
      <Card>
        <Toolbar>
          <SearchInput value={filters.search ?? ""} onChange={(value) => setFilter("search", value || undefined)} placeholder={t("searchPlaceholder")} />
          <EnumFilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => setFilter("status", value)} group="status" values={RESOURCE_STATUSES} />
          <FilterSelect
            placeholder={t("assignment")}
            value={filters.assigned}
            onChange={(value) => setFilter("assigned", value)}
            options={[
              { value: "true", label: t("assigned") },
              { value: "false", label: t("unassigned") },
            ]}
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
          emptyTitle={t("empty")}
          minWidth={760}
          columns={[
            { key: "name", header: t("name"), cell: (row) => <span className="cell-strong">{row.user?.fullName ?? "—"}</span> },
            { key: "phone", header: t("phone"), cell: (row) => <span dir="ltr">{row.user?.phone ?? "—"}</span> },
            { key: "nationalId", header: t("nationalId"), cell: (row) => row.nationalId ?? "—" },
            {
              key: "route",
              header: t("route"),
              cell: (row) =>
                row.assignedRoute ? (
                  <Chip tone={row.assignedRoute.needsReassignment ? "warning" : "muted"}>{row.assignedRoute.name}</Chip>
                ) : (
                  <span className="text-text-muted">{t("unassigned")}</span>
                ),
            },
            { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              header: "",
              cell: (row) => (
                <div className="flex items-center gap-1">
                  <button type="button" className="icon-btn" title={t("edit")} onClick={() => setEditing(row)}>
                    <Edit size={16} color="currentColor" variant="Linear" />
                  </button>
                  <button type="button" className={row.status === "ACTIVE" ? "btn btn-danger btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setStatusTarget(row)}>
                    {row.status === "ACTIVE" ? t("suspend") : t("activate")}
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      <AttendantDrawer attendant={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.status === "ACTIVE" ? t("suspendTitle") : t("activateTitle")}
        description={statusTarget?.status === "ACTIVE" ? t("suspendConfirm") : t("activateConfirm")}
        danger={statusTarget?.status === "ACTIVE"}
        pending={toggle.isPending}
        onConfirm={() => statusTarget && toggle.mutate(statusTarget)}
      />
    </PageSection>
  );
}

function schema(editing: boolean) {
  return z.object({
    fullName: v.name(),
    phone: v.phone(),
    email: v.email(),
    password: editing ? v.optionalPassword() : v.password(),
    nationalId: v.optionalText(),
  });
}

function AttendantDrawer({ attendant, open, onClose }: { attendant: Attendant | null; open: boolean; onClose: () => void }) {
  const t = useTranslations("Attendants");
  const tCommon = useTranslations("Common");
  const initial = {
    fullName: attendant?.user?.fullName ?? "",
    phone: attendant?.user?.phone ?? "",
    email: attendant?.user?.email ?? "",
    password: "",
    nationalId: attendant?.nationalId ?? "",
  };
  const form = useFormState(initial);
  useResetOnKey(open ? (attendant?.id ?? "new") : null, form.reset, initial);
  const { values, set, errors } = form;

  const save = useApiMutation({
    mutationFn: (input: AttendantInput) => (attendant ? institutionApi.updateAttendant(attendant.id, input) : institutionApi.createAttendant(input)),
    invalidate: [qk.institution.attendants()],
    onError: form.captureServerError,
    onSuccess: onClose,
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={attendant ? t("edit") : t("add")}
      subtitle={attendant ? undefined : t("addHint")}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(schema(Boolean(attendant)));
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
      <Field label={t("name")} required error={errors.fullName}>
        <TextInput value={values.fullName} onChange={(e) => set("fullName", e.target.value)} invalid={!!errors.fullName} />
      </Field>
      <Field label={t("phone")} required error={errors.phone}>
        <TextInput dir="ltr" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} invalid={!!errors.phone} />
      </Field>
      <Field label={t("email")} required error={errors.email} hint={t("loginHint")}>
        <TextInput dir="ltr" type="email" autoComplete="off" value={values.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
      </Field>
      <Field label={t("password")} required={!attendant} error={errors.password} hint={attendant ? t("passwordKeepHint") : undefined}>
        <PasswordInput autoComplete="new-password" value={values.password} onChange={(e) => set("password", e.target.value)} invalid={!!errors.password} />
      </Field>
      <Field label={t("nationalId")}>
        <TextInput value={values.nationalId} onChange={(e) => set("nationalId", e.target.value)} />
      </Field>
    </Drawer>
  );
}
