"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { z } from "zod";
import { INSTITUTION_STATUSES, INSTITUTION_TYPES } from "@/domain/models/enums";
import { useRouter } from "@/i18n/navigation";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, EnumFilterSelect, PageSection, SearchInput, StatCard, StatGrid, Toolbar } from "@/presentation/components/ui/panel";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState } from "@/presentation/hooks/use-form-state";
import { useSupportContact } from "@/presentation/hooks/use-support-contact";
import { v } from "@/shared/lib/validation";

function ContactLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} dir="ltr" className="text-accent hover:underline" onClick={(event) => event.stopPropagation()}>
      {children}
    </a>
  );
}

const whatsappSchema = z.object({ supportPhone: v.optionalPhone() });

function SupportWhatsAppCard() {
  const t = useTranslations("Support");
  const tCommon = useTranslations("Common");
  const contact = useSupportContact();
  const initial = { supportPhone: contact.data?.supportPhone ?? "" };
  const form = useFormState(initial);
  const [synced, setSynced] = useState<string | undefined>(undefined);
  const loaded = contact.isSuccess ? (contact.data.supportPhone ?? "") : undefined;
  if (loaded !== undefined && loaded !== synced) {
    setSynced(loaded);
    form.reset({ supportPhone: loaded });
  }
  const { values, set, errors } = form;
  const save = useApiMutation({
    mutationFn: (supportPhone: string | null) => adminApi.updateSupportContact(supportPhone),
    invalidate: [qk.public.supportContact],
    onError: form.captureServerError,
  });

  return (
    <Card title={t("whatsappTitle")}>
      <p className="text-start text-sm text-text-secondary">{t("whatsappHint")}</p>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const data = form.validate(whatsappSchema);
          if (data) save.mutate(data.supportPhone ?? null);
        }}
      >
        <Field label={t("whatsappPhone")} error={errors.supportPhone} className="min-w-0 flex-1">
          <TextInput
            dir="ltr"
            type="tel"
            value={values.supportPhone}
            onChange={(e) => set("supportPhone", e.target.value)}
            invalid={!!errors.supportPhone}
            placeholder="+9639XXXXXXXX"
          />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={save.isPending || contact.isPending}>
          {save.isPending ? tCommon("saving") : tCommon("save")}
        </button>
      </form>
      <ValidationList errors={form.serverErrors} />
    </Card>
  );
}

export function AdminSupportView() {
  const t = useTranslations("Support");
  const router = useRouter();
  const typeLabel = useEnumLabel("institutionType");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>();
  const [status, setStatus] = useState<string>();

  const institutions = useQuery({
    queryKey: qk.admin.institutions({ all: true }),
    queryFn: adminApi.allInstitutions,
    staleTime: 5 * 60_000,
  });
  const all = useMemo(() => institutions.data ?? [], [institutions.data]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all.filter((item) => {
      if (type && item.type !== type) return false;
      if (status && item.status !== status) return false;
      if (!needle) return true;
      return [item.name, item.displayName, item.contactPhone, item.contactEmail, item.primaryAdmin?.fullName, item.primaryAdmin?.phone]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [all, search, type, status]);

  const missingContact = all.filter((item) => !item.contactPhone && !item.primaryAdmin?.phone).length;

  return (
    <PageSection>
      <PageHeader icon="support" title={t("title")} subtitle={t("subtitle")} />
      <SupportWhatsAppCard />
      <StatGrid>
        <StatCard icon="building" label={t("institutions")} value={all.length} loading={institutions.isPending} />
        <StatCard icon="chart" tone="success" label={t("active")} value={all.filter((item) => item.status === "ACTIVE").length} loading={institutions.isPending} />
        <StatCard icon="incident" tone="warning" label={t("suspended")} value={all.filter((item) => item.status === "SUSPENDED").length} loading={institutions.isPending} />
        <StatCard icon="support" tone="danger" label={t("missingContact")} value={missingContact} loading={institutions.isPending} />
      </StatGrid>
      <Card>
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder={t("searchPlaceholder")} className="w-full sm:w-[320px]" />
          <EnumFilterSelect placeholder={t("type")} value={type} onChange={setType} group="institutionType" values={INSTITUTION_TYPES} />
          <EnumFilterSelect placeholder={t("status")} value={status} onChange={setStatus} group="status" values={INSTITUTION_STATUSES} />
        </Toolbar>
        <DataTable
          rows={rows}
          isLoading={institutions.isPending}
          error={institutions.error}
          onRetry={() => institutions.refetch()}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/admin/institutions/${row.id}`)}
          emptyTitle={t("empty")}
          minWidth={1080}
          columns={[
            {
              key: "name",
              header: t("institution"),
              cell: (row) => (
                <span className="flex flex-col">
                  <span className="cell-strong">{row.displayName || row.name}</span>
                  <span className="text-xs text-text-muted">{typeLabel(row.type)}</span>
                </span>
              ),
            },
            {
              key: "phone",
              header: t("contactPhone"),
              cell: (row) => (row.contactPhone ? <ContactLink href={`tel:${row.contactPhone}`}>{row.contactPhone}</ContactLink> : <Chip tone="warning">{t("notSet")}</Chip>),
            },
            {
              key: "email",
              header: t("contactEmail"),
              cell: (row) => (row.contactEmail ? <ContactLink href={`mailto:${row.contactEmail}`}>{row.contactEmail}</ContactLink> : "—"),
            },
            { key: "admin", header: t("primaryAdmin"), cell: (row) => row.primaryAdmin?.fullName ?? "—" },
            {
              key: "adminPhone",
              header: t("adminPhone"),
              cell: (row) => (row.primaryAdmin?.phone ? <ContactLink href={`tel:${row.primaryAdmin.phone}`}>{row.primaryAdmin.phone}</ContactLink> : "—"),
            },
            { key: "address", header: t("address"), cell: (row) => <span dir="auto">{row.address ?? "—"}</span> },
            { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </Card>
    </PageSection>
  );
}
