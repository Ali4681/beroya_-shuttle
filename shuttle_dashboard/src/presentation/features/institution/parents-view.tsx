"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import type { Parent } from "@/domain/models/entities";
import { Link } from "@/i18n/navigation";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { StatusBadge } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, PasswordInput, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { Drawer } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, EnumFilterSelect, FilterSelect, KeyValue, PageSection, SearchInput, Toolbar } from "@/presentation/components/ui/panel";
import { ErrorState, LoadingState } from "@/presentation/components/ui/states";
import { useBranchOptions, useRouteOptions } from "@/presentation/features/institution/use-institution";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState, useResetOnKey } from "@/presentation/hooks/use-form-state";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { v } from "@/shared/lib/validation";

export function ParentsView() {
  const t = useTranslations("Parents");
  const branchOptions = useBranchOptions();
  const routeOptions = useRouteOptions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const initialSearch = useSearchParams().get("q") || undefined;
  const { filters, setFilter, setPage, query } = useListParams({
    search: initialSearch,
    routeId: undefined as string | undefined,
    branchId: undefined as string | undefined,
    status: undefined as string | undefined,
  });

  const list = useQuery({
    queryKey: qk.institution.parents(query),
    queryFn: () => institutionApi.parents(query),
    placeholderData: keepPreviousData,
  });

  return (
    <PageSection>
      <PageHeader icon="people" title={t("title")} subtitle={t("subtitle")} />
      <Card>
        <Toolbar>
          <SearchInput value={filters.search ?? ""} onChange={(value) => setFilter("search", value || undefined)} placeholder={t("searchPlaceholder")} />
          {branchOptions.length > 1 ? (
            <FilterSelect placeholder={t("branch")} value={filters.branchId} onChange={(value) => setFilter("branchId", value)} options={branchOptions} />
          ) : null}
          <FilterSelect placeholder={t("route")} value={filters.routeId} onChange={(value) => setFilter("routeId", value)} options={routeOptions} />
          <EnumFilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => setFilter("status", value)} group="status" values={["ACTIVE", "SUSPENDED"]} />
        </Toolbar>
        <DataTable
          rows={list.data?.data}
          meta={list.data?.meta}
          onPageChange={setPage}
          isLoading={list.isPending}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(row) => row.id}
          onRowClick={(row) => setSelectedId(row.id)}
          emptyTitle={t("empty")}
          emptyDescription={t("emptyHint")}
          minWidth={760}
          columns={[
            { key: "name", header: t("name"), cell: (row) => <span className="cell-strong">{row.fullName}</span> },
            { key: "phone", header: t("phone"), cell: (row) => <span dir="ltr">{row.phone}</span> },
            { key: "students", header: t("students"), cell: (row) => row.students.map((student) => student.fullName).join("، ") || "—" },
            { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </Card>
      <ParentDrawer parentId={selectedId} onClose={() => setSelectedId(null)} />
    </PageSection>
  );
}

const parentSchema = z.object({
  fullName: v.name(),
  phone: v.phone(),
  email: v.email(),
  password: v.optionalPassword(),
});

function ParentDrawer({ parentId, onClose }: { parentId: string | null; onClose: () => void }) {
  const t = useTranslations("Parents");
  const tCommon = useTranslations("Common");
  const parent = useQuery({
    queryKey: qk.institution.parent(parentId ?? ""),
    queryFn: () => institutionApi.parent(parentId!),
    enabled: Boolean(parentId),
  });
  const data: Parent | undefined = parent.data;
  const initial = { fullName: data?.fullName ?? "", phone: data?.phone ?? "", email: data?.email ?? "", password: "" };
  const form = useFormState(initial);
  useResetOnKey(parentId && data ? data.id : null, form.reset, initial);
  const { values, set, errors } = form;

  const save = useApiMutation({
    mutationFn: (input: { fullName: string; phone: string; email: string; password?: string }) =>
      institutionApi.updateParent(parentId!, input),
    invalidate: [["parents"], ["parent"], qk.institution.students()],
    onError: form.captureServerError,
    onSuccess: onClose,
  });

  return (
    <Drawer
      open={Boolean(parentId)}
      onClose={onClose}
      title={data?.fullName ?? t("detail")}
      subtitle={t("editHint")}
      onSubmit={(event) => {
        event.preventDefault();
        const input = form.validate(parentSchema);
        if (input) save.mutate(input);
      }}
      footer={
        data ? (
          <>
            <button type="submit" className="btn btn-primary flex-1" disabled={save.isPending}>
              {save.isPending ? tCommon("saving") : tCommon("save")}
            </button>
            <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
              {tCommon("cancel")}
            </button>
          </>
        ) : undefined
      }
    >
      {parent.isPending ? (
        <LoadingState rows={4} />
      ) : parent.isError ? (
        <ErrorState error={parent.error} onRetry={() => parent.refetch()} />
      ) : data ? (
        <>
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
          <Field label={t("password")} error={errors.password} hint={t("passwordKeepHint")}>
            <PasswordInput autoComplete="new-password" value={values.password} onChange={(e) => set("password", e.target.value)} invalid={!!errors.password} />
          </Field>
          <KeyValue items={[{ label: t("status"), value: <StatusBadge status={data.status} /> }]} />
          <h3 className="text-start text-sm font-semibold text-text-primary">{t("students")}</h3>
          <ul className="flex flex-col gap-1.5">
            {data.students.map((student) => (
              <li key={student.id}>
                <Link
                  href={`/institution/students/${student.id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-start text-sm transition hover:border-accent/40"
                >
                  <span className="font-medium text-text-primary">{student.fullName}</span>
                  <StatusBadge status={student.status} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Drawer>
  );
}
