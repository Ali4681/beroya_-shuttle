"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Add } from "iconsax-react-v2";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import {
  INSTITUTION_STATUSES,
  INSTITUTION_TYPES,
  OPERATION_MODELS,
  SUBSCRIPTION_STATUSES,
  type InstitutionType,
  type OperationModel,
} from "@/domain/models/enums";
import { Link, useRouter } from "@/i18n/navigation";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { StatusBadge, useEnumLabel, useEnumOptions } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, FormGrid, PasswordInput, SelectInput, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { Drawer } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, EnumFilterSelect, PageSection, SearchInput, Toolbar } from "@/presentation/components/ui/panel";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState } from "@/presentation/hooks/use-form-state";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { formatDate } from "@/shared/lib/format";
import { v } from "@/shared/lib/validation";

const TYPE_NAV_KEYS: Record<InstitutionType, string> = {
  SCHOOL: "schools",
  UNIVERSITY: "universities",
  COMPANY: "companies",
};

export function InstitutionsView() {
  const param = useSearchParams().get("type");
  const type = INSTITUTION_TYPES.find((value) => value === param);
  return <InstitutionsList key={type ?? "all"} type={type} />;
}

function InstitutionsList({ type }: { type?: InstitutionType }) {
  const t = useTranslations("AdminInstitutions");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const typeLabel = useEnumLabel("institutionType");
  const modelLabel = useEnumLabel("operationModel");
  const [createOpen, setCreateOpen] = useState(false);
  const { filters, setFilter, setPage, query } = useListParams({
    search: undefined as string | undefined,
    type: type as string | undefined,
    status: undefined as string | undefined,
    operationModel: undefined as string | undefined,
    subscriptionStatus: undefined as string | undefined,
  });

  const list = useQuery({
    queryKey: qk.admin.institutions(query),
    queryFn: () => adminApi.institutions(query),
    placeholderData: keepPreviousData,
  });

  return (
    <PageSection>
      <PageHeader
        icon="building"
        title={type ? tNav(TYPE_NAV_KEYS[type]) : t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <Add size={16} color="currentColor" variant="Linear" />
            {t("add")}
          </button>
        }
      />

      <Card>
        <Toolbar>
          <SearchInput value={filters.search ?? ""} onChange={(value) => setFilter("search", value || undefined)} placeholder={t("searchPlaceholder")} />
          <EnumFilterSelect placeholder={t("type")} value={filters.type} onChange={(value) => router.replace(value ? `/admin/institutions?type=${value}` : "/admin/institutions")} group="institutionType" values={INSTITUTION_TYPES} />
          <EnumFilterSelect placeholder={t("operationModel")} value={filters.operationModel} onChange={(value) => setFilter("operationModel", value)} group="operationModel" values={OPERATION_MODELS} />
          <EnumFilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => setFilter("status", value)} group="status" values={INSTITUTION_STATUSES} />
          <EnumFilterSelect placeholder={t("subscription")} value={filters.subscriptionStatus} onChange={(value) => setFilter("subscriptionStatus", value)} group="status" values={SUBSCRIPTION_STATUSES} />
        </Toolbar>

        <DataTable
          minWidth={1000}
          rows={list.data?.data}
          meta={list.data?.meta}
          onPageChange={setPage}
          isLoading={list.isPending}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/admin/institutions/${row.id}`)}
          emptyTitle={t("empty")}
          columns={[
            {
              key: "name",
              header: t("name"),
              cell: (row) => (
                <div className="flex flex-col">
                  <Link href={`/admin/institutions/${row.id}`} className="cell-strong hover:text-accent" onClick={(event) => event.stopPropagation()}>
                    {row.displayName || row.name}
                  </Link>
                  {row.displayName ? <span className="text-xs text-text-muted">{row.name}</span> : null}
                </div>
              ),
            },
            { key: "type", header: t("type"), cell: (row) => typeLabel(row.type) },
            { key: "model", header: t("operationModel"), cell: (row) => modelLabel(row.operationModel) },
            {
              key: "admin",
              header: t("admin"),
              cell: (row) =>
                row.primaryAdmin ? (
                  <div className="flex flex-col">
                    <span>{row.primaryAdmin.fullName}</span>
                    <span className="text-xs text-text-muted" dir="ltr">{row.primaryAdmin.phone}</span>
                  </div>
                ) : (
                  "—"
                ),
            },
            { key: "branches", header: t("branches"), cell: (row) => row.branchCount },
            {
              key: "subscription",
              header: t("subscription"),
              cell: (row) => <StatusBadge status={row.currentSubscription?.status ?? null} />,
            },
            { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
            { key: "created", header: t("createdAt"), cell: (row) => formatDate(row.createdAt, locale) },
          ]}
        />
      </Card>

      <CreateInstitutionDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageSection>
  );
}

const createSchema = z.object({
  name: v.name(),
  displayName: v.optionalText(),
  type: z.enum(INSTITUTION_TYPES, { message: "required" }),
  operationModel: z
    .string()
    .transform((value) => (value ? (value as OperationModel) : undefined)),
  contactPhone: v.optionalPhone(),
  contactEmail: v.optionalEmail(),
  address: v.optionalText(),
  adminName: v.name(),
  adminPhone: v.phone(),
  adminEmail: v.email(),
  adminPassword: v.password(),
  branchName: v.optionalText(),
  branchAddress: v.optionalText(),
});

const emptyForm = {
  name: "",
  displayName: "",
  type: "" as InstitutionType | "",
  operationModel: "",
  contactPhone: "",
  contactEmail: "",
  address: "",
  adminName: "",
  adminPhone: "",
  adminEmail: "",
  adminPassword: "",
  branchName: "",
  branchAddress: "",
};

function CreateInstitutionDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("AdminInstitutions");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const form = useFormState(emptyForm);
  const { values, set, errors } = form;
  const typeOptions = useEnumOptions("institutionType", INSTITUTION_TYPES);
  const modelOptions = useEnumOptions("operationModel", OPERATION_MODELS);

  const create = useApiMutation({
    mutationFn: adminApi.createInstitution,
    invalidate: [qk.admin.all],
    successMessage: t("created"),
    onError: form.captureServerError,
    onSuccess: (institution) => {
      form.reset(emptyForm);
      onClose();
      router.push(`/admin/institutions/${institution.id}`);
    },
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("addTitle")}
      subtitle={t("addSubtitle")}
      wide
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(createSchema);
        if (!data) return;
        create.mutate({
          name: data.name,
          displayName: data.displayName,
          type: data.type,
          operationModel: data.operationModel,
          contactPhone: data.contactPhone,
          contactEmail: data.contactEmail,
          address: data.address,
          admin: {
            fullName: data.adminName,
            phone: data.adminPhone,
            email: data.adminEmail,
            password: data.adminPassword,
          },
          defaultBranch:
            data.branchName || data.branchAddress
              ? { name: data.branchName, address: data.branchAddress }
              : undefined,
        });
      }}
      footer={
        <>
          <button type="submit" className="btn btn-primary flex-1" disabled={create.isPending}>
            {create.isPending ? tCommon("saving") : t("create")}
          </button>
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            {tCommon("cancel")}
          </button>
        </>
      }
    >
      <ValidationList errors={form.serverErrors} />
      <h3 className="text-start text-sm font-semibold text-text-primary">{t("infoSection")}</h3>
      <FormGrid>
        <Field label={t("name")} required error={errors.name}>
          <TextInput value={values.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
        </Field>
        <Field label={t("displayName")} error={errors.displayName}>
          <TextInput value={values.displayName} onChange={(e) => set("displayName", e.target.value)} />
        </Field>
        <Field label={t("type")} required error={errors.type}>
          <SelectInput value={values.type} onChange={(value) => set("type", value as InstitutionType)} options={typeOptions} />
        </Field>
        <Field label={t("operationModel")} hint={t("operationModelHint")} error={errors.operationModel}>
          <SelectInput value={values.operationModel} onChange={(value) => set("operationModel", value)} options={modelOptions} />
        </Field>
        <Field label={t("contactPhone")} error={errors.contactPhone}>
          <TextInput dir="ltr" type="tel" value={values.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} invalid={!!errors.contactPhone} />
        </Field>
        <Field label={t("contactEmail")} error={errors.contactEmail}>
          <TextInput dir="ltr" type="email" value={values.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} invalid={!!errors.contactEmail} />
        </Field>
        <Field label={t("address")} className="sm:col-span-2">
          <TextInput value={values.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
      </FormGrid>

      <h3 className="pt-2 text-start text-sm font-semibold text-text-primary">{t("adminSection")}</h3>
      <FormGrid>
        <Field label={t("adminName")} required error={errors.adminName}>
          <TextInput value={values.adminName} onChange={(e) => set("adminName", e.target.value)} invalid={!!errors.adminName} />
        </Field>
        <Field label={t("adminPhone")} required error={errors.adminPhone}>
          <TextInput dir="ltr" type="tel" value={values.adminPhone} onChange={(e) => set("adminPhone", e.target.value)} invalid={!!errors.adminPhone} />
        </Field>
        <Field label={t("adminEmail")} required error={errors.adminEmail} hint={t("loginHint")}>
          <TextInput dir="ltr" type="email" autoComplete="off" value={values.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} invalid={!!errors.adminEmail} />
        </Field>
        <Field label={t("adminPassword")} required error={errors.adminPassword}>
          <PasswordInput autoComplete="new-password" value={values.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} invalid={!!errors.adminPassword} />
        </Field>
      </FormGrid>

      <h3 className="pt-2 text-start text-sm font-semibold text-text-primary">{t("branchSection")}</h3>
      <FormGrid>
        <Field label={t("branchName")} hint={t("branchHint")}>
          <TextInput value={values.branchName} onChange={(e) => set("branchName", e.target.value)} />
        </Field>
        <Field label={t("branchAddress")}>
          <TextInput value={values.branchAddress} onChange={(e) => set("branchAddress", e.target.value)} />
        </Field>
      </FormGrid>
    </Drawer>
  );
}
