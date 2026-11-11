"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Add, Edit } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import type { UniversityStudent } from "@/domain/models/entities";
import { STUDENT_STATUSES } from "@/domain/models/enums";
import { institutionApi, type UniversityStudentInput } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { StatusBadge } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, FormGrid, PasswordInput, SelectInput, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { Drawer } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import {
  Card,
  ConfirmDialog,
  EnumFilterSelect,
  PageSection,
  SearchInput,
  StatCard,
  StatGrid,
  Toolbar,
} from "@/presentation/components/ui/panel";
import { useBranchName, useBranchOptions } from "@/presentation/features/institution/use-institution";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState, useResetOnKey } from "@/presentation/hooks/use-form-state";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { v } from "@/shared/lib/validation";

export function UniversityStudentsView() {
  const t = useTranslations("UniversityStudents");
  const branchName = useBranchName();
  const [editing, setEditing] = useState<UniversityStudent | "new" | null>(null);
  const [statusTarget, setStatusTarget] = useState<UniversityStudent | null>(null);
  const { filters, setFilter, setPage, query } = useListParams({
    search: undefined as string | undefined,
    status: undefined as string | undefined,
  });

  const stats = useQuery({ queryKey: [...qk.institution.universityStudents(), "stats"], queryFn: institutionApi.universityStudentStats });
  const list = useQuery({
    queryKey: qk.institution.universityStudents(query),
    queryFn: () => institutionApi.universityStudents(query),
    placeholderData: keepPreviousData,
  });

  const toggle = useApiMutation({
    mutationFn: (item: UniversityStudent) => institutionApi.setUniversityStudentStatus(item.id, item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
    invalidate: [qk.institution.universityStudents()],
    onSuccess: () => setStatusTarget(null),
  });

  return (
    <PageSection>
      <PageHeader
        icon="university"
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Add size={16} color="currentColor" variant="Linear" />
            {t("add")}
          </button>
        }
      />
      <StatGrid>
        <StatCard icon="university" label={t("total")} value={stats.data?.total ?? 0} loading={stats.isPending} />
        <StatCard icon="chart" tone="success" label={t("active")} value={stats.data?.active ?? 0} loading={stats.isPending} />
      </StatGrid>
      <Card>
        <Toolbar>
          <SearchInput value={filters.search ?? ""} onChange={(value) => setFilter("search", value || undefined)} placeholder={t("searchPlaceholder")} />
          <EnumFilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => setFilter("status", value)} group="status" values={STUDENT_STATUSES} />
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
          minWidth={860}
          columns={[
            { key: "name", header: t("name"), cell: (row) => <span className="cell-strong">{row.user?.fullName ?? "—"}</span> },
            { key: "phone", header: t("phone"), cell: (row) => <span dir="ltr">{row.user?.phone ?? "—"}</span> },
            { key: "number", header: t("studentNumber"), cell: (row) => row.studentNumber ?? "—" },
            { key: "faculty", header: t("faculty"), cell: (row) => row.faculty ?? "—" },
            { key: "branch", header: t("branch"), cell: (row) => (row.branchId ? branchName(row.branchId) : "—") },
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
                    {row.status === "ACTIVE" ? t("deactivate") : t("activate")}
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      <UniversityStudentDrawer student={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.status === "ACTIVE" ? t("deactivateTitle") : t("activateTitle")}
        description={statusTarget?.status === "ACTIVE" ? t("deactivateConfirm") : t("activateConfirm")}
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
    studentNumber: v.optionalText(),
    faculty: v.optionalText(),
    branchId: v.optionalText(),
  });
}

function UniversityStudentDrawer({ student, open, onClose }: { student: UniversityStudent | null; open: boolean; onClose: () => void }) {
  const t = useTranslations("UniversityStudents");
  const tCommon = useTranslations("Common");
  const branchOptions = useBranchOptions();
  const initial = {
    fullName: student?.user?.fullName ?? "",
    phone: student?.user?.phone ?? "",
    email: student?.user?.email ?? "",
    password: "",
    studentNumber: student?.studentNumber ?? "",
    faculty: student?.faculty ?? "",
    branchId: student?.branchId ?? "",
  };
  const form = useFormState(initial);
  useResetOnKey(open ? (student?.id ?? "new") : null, form.reset, initial);
  const { values, set, errors } = form;

  const save = useApiMutation({
    mutationFn: (input: UniversityStudentInput) =>
      student ? institutionApi.updateUniversityStudent(student.id, input) : institutionApi.createUniversityStudent(input),
    invalidate: [qk.institution.universityStudents()],
    onError: form.captureServerError,
    onSuccess: onClose,
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={student ? t("edit") : t("add")}
      subtitle={student ? undefined : t("addHint")}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(schema(Boolean(student)));
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
      <Field label={t("password")} required={!student} error={errors.password} hint={student ? t("passwordKeepHint") : undefined}>
        <PasswordInput autoComplete="new-password" value={values.password} onChange={(e) => set("password", e.target.value)} invalid={!!errors.password} />
      </Field>
      <FormGrid>
        <Field label={t("studentNumber")}>
          <TextInput dir="ltr" value={values.studentNumber} onChange={(e) => set("studentNumber", e.target.value)} />
        </Field>
        <Field label={t("faculty")}>
          <TextInput value={values.faculty} onChange={(e) => set("faculty", e.target.value)} />
        </Field>
        {branchOptions.length > 1 ? (
          <Field label={t("branch")}>
            <SelectInput value={values.branchId} onChange={(value) => set("branchId", value)} options={branchOptions} />
          </Field>
        ) : null}
      </FormGrid>
    </Drawer>
  );
}
