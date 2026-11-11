"use client";

import { useQuery } from "@tanstack/react-query";
import { Add, Edit, ProfileTick } from "iconsax-react-v2";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import type { InstitutionDetail } from "@/domain/models/entities";
import { INSTITUTION_TYPES, OPERATION_MODELS, type InstitutionType, type OperationModel } from "@/domain/models/enums";
import { Link } from "@/i18n/navigation";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { uploadImage } from "@/infrastructure/api/uploads";
import { StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import {
  CheckboxField,
  EnumSelect,
  Field,
  FormGrid,
  PasswordInput,
  TextInput,
  ValidationList,
} from "@/presentation/components/ui/form";
import { Drawer } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, ConfirmDialog, KeyValue, PageSection, StatCard, StatGrid, Tabs } from "@/presentation/components/ui/panel";
import { QueryBoundary } from "@/presentation/components/ui/states";
import { SubscriptionActions, SubscriptionDrawer } from "@/presentation/features/admin/subscription-dialogs";
import { AuditLogsTable } from "@/presentation/features/shared/audit-logs";
import { BranchesManager, type BranchesApi } from "@/presentation/features/shared/branches-manager";
import { BrandingForm } from "@/presentation/features/shared/branding-form";
import { DriversView } from "@/presentation/features/shared/resources";
import { SettingsForm } from "@/presentation/features/shared/settings-form";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState } from "@/presentation/hooks/use-form-state";
import { formatDate, formatMoney, formatNumber } from "@/shared/lib/format";
import { v } from "@/shared/lib/validation";

type TabId =
  | "overview"
  | "subscriptions"
  | "branding"
  | "settings"
  | "branches"
  | "activity"
  | "drivers";

export function InstitutionDetailView({ id }: { id: string }) {
  const t = useTranslations("AdminInstitution");
  const tNav = useTranslations("Nav");
  const [tab, setTab] = useState<TabId>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const detail = useQuery({ queryKey: qk.admin.institution(id), queryFn: () => adminApi.institution(id) });

  const setStatus = useApiMutation({
    mutationFn: (input: { status: "ACTIVE" | "SUSPENDED"; reason?: string }) =>
      adminApi.setInstitutionStatus(id, input.status, input.reason),
    invalidate: [qk.admin.all],
    onSuccess: () => setStatusOpen(false),
  });

  const institution = detail.data;
  const suspended = institution?.status === "SUSPENDED";

  return (
    <PageSection>
      <PageHeader
        icon="building"
        title={institution ? institution.displayName || institution.name : t("title")}
        meta={institution ? <StatusBadge status={institution.status} /> : null}
        subtitle={
          <nav className="flex items-center gap-1.5">
            <Link href="/admin/institutions" className="transition hover:text-accent">
              {tNav("institutions")}
            </Link>
            <span>/</span>
            <span className="text-text-secondary">{institution?.name ?? "…"}</span>
          </nav>
        }
        actions={
          institution ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(true)}>
                <Edit size={16} color="currentColor" variant="Linear" />
                {t("edit")}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setAdminOpen(true)}>
                <ProfileTick size={16} color="currentColor" variant="Linear" />
                {t("changeAdmin")}
              </button>
              <button
                type="button"
                className={suspended ? "btn btn-primary" : "btn btn-danger"}
                onClick={() => setStatusOpen(true)}
              >
                {suspended ? t("activate") : t("suspend")}
              </button>
            </div>
          ) : null
        }
      />

      <QueryBoundary query={detail}>
        {(data) => (
          <>
            {suspended && data.statusReason ? (
              <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-start text-sm text-danger">
                {t("suspendedReason", { reason: data.statusReason })}
              </div>
            ) : null}

            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "overview", label: t("tabs.overview") },
                { id: "subscriptions", label: t("tabs.subscriptions") },
                { id: "branding", label: t("tabs.branding") },
                { id: "settings", label: t("tabs.settings") },
                { id: "branches", label: t("tabs.branches") },
                { id: "activity", label: t("tabs.activity") },
                ...(data.operationModel === "BEROYA_OPERATED"
                  ? [{ id: "drivers" as const, label: t("tabs.drivers") }]
                  : []),
              ]}
            />

            {tab === "overview" ? <OverviewTab institution={data} /> : null}
            {tab === "subscriptions" ? <SubscriptionsTab institutionId={id} /> : null}
            {tab === "branding" ? <BrandingTab institution={data} /> : null}
            {tab === "settings" ? <SettingsTab institution={data} /> : null}
            {tab === "branches" ? <BranchesTab institution={data} /> : null}
            {tab === "activity" ? (
              <Card>
                <AuditLogsTable scope="admin" institutionId={id} />
              </Card>
            ) : null}
            {tab === "drivers" && data.operationModel === "BEROYA_OPERATED" ? (
              <DriversView scope="admin" institutionId={id} embedded />
            ) : null}

            <EditInstitutionDrawer open={editOpen} onClose={() => setEditOpen(false)} institution={data} />
            <ChangeAdminDrawer open={adminOpen} onClose={() => setAdminOpen(false)} institutionId={id} />
          </>
        )}
      </QueryBoundary>

      <ConfirmDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title={suspended ? t("activateTitle") : t("suspendTitle")}
        description={suspended ? t("activateConfirm") : t("suspendConfirm")}
        danger={!suspended}
        withReason
        reasonRequired={!suspended}
        reasonLabel={t("statusReason")}
        pending={setStatus.isPending}
        onConfirm={({ reason }) =>
          setStatus.mutate({ status: suspended ? "ACTIVE" : "SUSPENDED", reason: reason || undefined })
        }
      />
    </PageSection>
  );
}

function OverviewTab({ institution }: { institution: InstitutionDetail }) {
  const t = useTranslations("AdminInstitution");
  const locale = useLocale();
  const typeLabel = useEnumLabel("institutionType");
  const modelLabel = useEnumLabel("operationModel");
  const stats = useQuery({
    queryKey: qk.admin.institutionPart(institution.id, "stats"),
    queryFn: () => adminApi.institutionStats(institution.id),
  });
  const counts = stats.data?.counts;
  const n = (value: number | undefined) => formatNumber(value ?? 0, locale);
  const sub = institution.currentSubscription;

  return (
    <div className="flex flex-col gap-5">
      <StatGrid>
        <StatCard icon="branch" label={t("stats.branches")} value={n(counts?.branches)} loading={stats.isPending} />
        <StatCard icon="route" label={t("stats.routes")} value={n(counts?.routes)} loading={stats.isPending} />
        <StatCard
          icon="student"
          label={t("stats.riders")}
          value={n((counts?.students ?? 0) + (counts?.universityStudents ?? 0))}
          loading={stats.isPending}
        />
        <StatCard icon="car" label={t("stats.tripsToday")} value={n(counts?.tripsToday)} loading={stats.isPending} />
        <StatCard icon="driver" label={t("stats.drivers")} value={n(counts?.drivers)} loading={stats.isPending} />
        <StatCard icon="vehicle" label={t("stats.vehicles")} value={n(counts?.vehicles)} loading={stats.isPending} />
        <StatCard icon="attendant" label={t("stats.attendants")} value={n(counts?.attendants)} loading={stats.isPending} />
        <StatCard icon="people" label={t("stats.users")} value={n(counts?.users)} loading={stats.isPending} />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t("profile")}>
          <KeyValue
            items={[
              { label: t("name"), value: institution.name },
              { label: t("displayName"), value: institution.displayName },
              { label: t("type"), value: typeLabel(institution.type) },
              { label: t("operationModel"), value: modelLabel(institution.operationModel) },
              { label: t("contactPhone"), value: <span dir="ltr">{institution.contactPhone ?? "—"}</span> },
              { label: t("contactEmail"), value: institution.contactEmail },
              { label: t("address"), value: institution.address },
              { label: t("createdAt"), value: formatDate(institution.createdAt, locale) },
            ]}
          />
        </Card>
        <div className="flex flex-col gap-4">
          <Card title={t("primaryAdmin")}>
            {institution.primaryAdmin ? (
              <KeyValue
                items={[
                  { label: t("adminName"), value: institution.primaryAdmin.fullName },
                  { label: t("adminPhone"), value: <span dir="ltr">{institution.primaryAdmin.phone}</span> },
                  { label: t("adminEmail"), value: <span dir="ltr">{institution.primaryAdmin.email ?? "—"}</span> },
                  { label: t("status"), value: <StatusBadge status={institution.primaryAdmin.status} /> },
                  { label: t("lastLogin"), value: formatDate(institution.primaryAdmin.lastLoginAt, locale) },
                ]}
              />
            ) : (
              <p className="text-start text-sm text-text-muted">—</p>
            )}
          </Card>
          <Card title={t("currentSubscription")}>
            {sub ? (
              <KeyValue
                items={[
                  { label: t("status"), value: <StatusBadge status={sub.status} /> },
                  { label: t("period"), value: `${formatDate(sub.startsAt, locale)} → ${formatDate(sub.endsAt, locale)}` },
                  { label: t("amount"), value: formatMoney(sub.agreedAmount, sub.currencyCode, locale) },
                ]}
              />
            ) : (
              <p className="text-start text-sm text-warning">{t("noSubscription")}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function SubscriptionsTab({ institutionId }: { institutionId: string }) {
  const t = useTranslations("Subscriptions");
  const locale = useLocale();
  const periodLabel = useEnumLabel("billingPeriod");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const list = useQuery({
    queryKey: [...qk.admin.institution(institutionId), "subscriptions", page],
    queryFn: () => adminApi.institutionSubscriptions(institutionId, { page, limit: 20 }),
  });

  return (
    <Card
      title={t("title")}
      actions={
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
          <Add size={14} color="currentColor" variant="Linear" />
          {t("create")}
        </button>
      }
    >
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
          { key: "period", header: t("billingPeriod"), cell: (row) => periodLabel(row.billingPeriod) },
          { key: "starts", header: t("startsAt"), cell: (row) => formatDate(row.startsAt, locale) },
          { key: "ends", header: t("endsAt"), cell: (row) => formatDate(row.endsAt, locale) },
          { key: "amount", header: t("agreedAmount"), cell: (row) => formatMoney(row.agreedAmount, row.currencyCode, locale) },
          { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
          { key: "actions", header: t("actions"), cell: (row) => <SubscriptionActions subscription={row} /> },
        ]}
      />
      <SubscriptionDrawer open={createOpen} onClose={() => setCreateOpen(false)} institutionId={institutionId} />
    </Card>
  );
}

function BrandingTab({ institution }: { institution: InstitutionDetail }) {
  const t = useTranslations("Branding");
  const id = institution.id;
  const save = useApiMutation({
    mutationFn: (input: Parameters<typeof adminApi.updateBranding>[1]) => adminApi.updateBranding(id, input),
    invalidate: [qk.admin.institution(id)],
    onError: () => true,
  });
  return (
    <Card title={t("title")}>
      <BrandingForm
        branding={institution.branding}
        saving={save.isPending}
        onSave={save.mutateAsync}
        uploadLogo={(file) =>
          uploadImage(
            file,
            "logo",
            (contentType, byteSize) => adminApi.presignLogo(id, contentType, byteSize),
            (objectKey) => adminApi.completeLogo(id, objectKey),
          )
        }
      />
    </Card>
  );
}

function SettingsTab({ institution }: { institution: InstitutionDetail }) {
  const t = useTranslations("Settings");
  const id = institution.id;
  const save = useApiMutation({
    mutationFn: (input: Parameters<typeof adminApi.updateSettings>[1]) => adminApi.updateSettings(id, input),
    invalidate: [qk.admin.institution(id)],
    onError: () => true,
  });
  return (
    <Card title={t("title")}>
      <SettingsForm settings={institution.settings} saving={save.isPending} onSave={save.mutateAsync} />
    </Card>
  );
}

function BranchesTab({ institution }: { institution: InstitutionDetail }) {
  const t = useTranslations("Branches");
  const id = institution.id;
  const api: BranchesApi = {
    create: (input) => adminApi.createBranch(id, input),
    update: (branchId, input) => adminApi.updateBranch(id, branchId, input),
    setStatus: (branchId, status) => adminApi.setBranchStatus(id, branchId, status),
    remove: (branchId) => adminApi.deleteBranch(id, branchId),
  };
  return (
    <BranchesManager
      title={t("title")}
      rows={institution.branches}
      api={api}
      invalidate={[qk.admin.institution(id)]}
    />
  );
}

const editSchema = z.object({
  name: v.name(),
  displayName: v.optionalText(),
  type: z.enum(INSTITUTION_TYPES, { message: "required" }),
  operationModel: z.enum(OPERATION_MODELS, { message: "required" }),
  contactPhone: v.optionalPhone(),
  contactEmail: v.optionalEmail(),
  address: v.optionalText(),
});

function EditInstitutionDrawer({
  open,
  onClose,
  institution,
}: {
  open: boolean;
  onClose: () => void;
  institution: InstitutionDetail;
}) {
  const t = useTranslations("AdminInstitutions");
  const tCommon = useTranslations("Common");
  const initial = {
    name: institution.name,
    displayName: institution.displayName ?? "",
    type: institution.type as InstitutionType | "",
    operationModel: institution.operationModel as OperationModel | "",
    contactPhone: institution.contactPhone ?? "",
    contactEmail: institution.contactEmail ?? "",
    address: institution.address ?? "",
  };
  const form = useFormState(initial);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) form.reset(initial);
  }
  const { values, set, errors } = form;

  const save = useApiMutation({
    mutationFn: (input: z.infer<typeof editSchema>) => adminApi.updateInstitution(institution.id, input),
    invalidate: [qk.admin.all],
    onError: form.captureServerError,
    onSuccess: onClose,
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("editTitle")}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(editSchema);
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
      <Field label={t("displayName")}>
        <TextInput value={values.displayName} onChange={(e) => set("displayName", e.target.value)} />
      </Field>
      <FormGrid>
        <Field label={t("type")} required error={errors.type}>
          <EnumSelect value={values.type} onChange={(value) => set("type", value as InstitutionType)} group="institutionType" values={INSTITUTION_TYPES} />
        </Field>
        <Field label={t("operationModel")} required error={errors.operationModel}>
          <EnumSelect value={values.operationModel} onChange={(value) => set("operationModel", value as OperationModel)} group="operationModel" values={OPERATION_MODELS} />
        </Field>
      </FormGrid>
      <Field label={t("contactPhone")} error={errors.contactPhone}>
        <TextInput dir="ltr" type="tel" value={values.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} invalid={!!errors.contactPhone} />
      </Field>
      <Field label={t("contactEmail")} error={errors.contactEmail}>
        <TextInput dir="ltr" type="email" value={values.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} invalid={!!errors.contactEmail} />
      </Field>
      <Field label={t("address")}>
        <TextInput value={values.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
    </Drawer>
  );
}

const adminSchema = z.object({
  fullName: v.name(),
  phone: v.phone(),
  email: v.email(),
  password: v.password(),
  keepOldAsOperator: z.boolean(),
});

function ChangeAdminDrawer({
  open,
  onClose,
  institutionId,
}: {
  open: boolean;
  onClose: () => void;
  institutionId: string;
}) {
  const t = useTranslations("AdminInstitution");
  const tCommon = useTranslations("Common");
  const form = useFormState({ fullName: "", phone: "", email: "", password: "", keepOldAsOperator: false });
  const { values, set, errors } = form;
  const save = useApiMutation({
    mutationFn: (input: z.infer<typeof adminSchema>) => adminApi.changeAdmin(institutionId, input),
    invalidate: [qk.admin.institution(institutionId), qk.admin.institutions()],
    successMessage: t("adminChanged"),
    onError: form.captureServerError,
    onSuccess: () => {
      form.reset();
      onClose();
    },
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("changeAdmin")}
      subtitle={t("changeAdminHint")}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(adminSchema);
        if (data) save.mutate(data);
      }}
      footer={
        <>
          <button type="submit" className="btn btn-primary flex-1" disabled={save.isPending}>
            {save.isPending ? tCommon("saving") : tCommon("confirm")}
          </button>
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            {tCommon("cancel")}
          </button>
        </>
      }
    >
      <ValidationList errors={form.serverErrors} />
      <Field label={t("adminName")} required error={errors.fullName}>
        <TextInput value={values.fullName} onChange={(e) => set("fullName", e.target.value)} invalid={!!errors.fullName} />
      </Field>
      <Field label={t("adminPhone")} required error={errors.phone}>
        <TextInput dir="ltr" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} invalid={!!errors.phone} />
      </Field>
      <Field label={t("adminEmail")} required error={errors.email} hint={t("loginHint")}>
        <TextInput dir="ltr" type="email" autoComplete="off" value={values.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
      </Field>
      <Field label={t("adminPassword")} required error={errors.password}>
        <PasswordInput autoComplete="new-password" value={values.password} onChange={(e) => set("password", e.target.value)} invalid={!!errors.password} />
      </Field>
      <CheckboxField
        checked={values.keepOldAsOperator}
        onChange={(checked) => set("keepOldAsOperator", checked)}
        label={t("keepOldAsOperator")}
      />
    </Drawer>
  );
}
