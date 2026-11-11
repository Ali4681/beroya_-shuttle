"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { AuditLog } from "@/domain/models/entities";
import { adminApi } from "@/infrastructure/api/admin.api";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { AppDatePicker } from "@/presentation/components/ui/app-date-picker";
import { useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, TextInput } from "@/presentation/components/ui/form";
import { Modal } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, KeyValue, PageSection, SearchInput, Toolbar } from "@/presentation/components/ui/panel";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { formatDateTime } from "@/shared/lib/format";

export function AuditLogsView({ scope }: { scope: "admin" | "institution" }) {
  const t = useTranslations("AuditLogs");
  return (
    <PageSection>
      <PageHeader icon="history" title={t("title")} subtitle={t("subtitle")} />
      <Card>
        <AuditLogsTable scope={scope} />
      </Card>
    </PageSection>
  );
}

export function AuditLogsTable({ scope, institutionId }: { scope: "admin" | "institution"; institutionId?: string }) {
  const t = useTranslations("AuditLogs");
  const locale = useLocale();
  const roleLabel = useEnumLabel("role");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const { filters, setFilter, setPage, query } = useListParams({
    entityType: undefined as string | undefined,
    action: undefined as string | undefined,
    dateFrom: undefined as string | undefined,
    dateTo: undefined as string | undefined,
  });
  const params = { ...query, institutionId };

  const list = useQuery({
    queryKey: scope === "admin" ? qk.admin.auditLogs(params) : qk.institution.auditLogs(params),
    queryFn: () => (scope === "admin" ? adminApi.auditLogs(params) : institutionApi.auditLogs(query)),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <SearchInput value={filters.action ?? ""} onChange={(value) => setFilter("action", value || undefined)} placeholder={t("action")} className="sm:max-w-[220px]" />
        <SearchInput value={filters.entityType ?? ""} onChange={(value) => setFilter("entityType", value || undefined)} placeholder={t("entityType")} className="sm:max-w-[220px]" />
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          {t("from")}
          <AppDatePicker size="sm" clearable className="w-[200px]" value={filters.dateFrom ?? ""} onChange={(value) => setFilter("dateFrom", value || undefined)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          {t("to")}
          <AppDatePicker size="sm" clearable className="w-[200px]" value={filters.dateTo ?? ""} min={filters.dateFrom} onChange={(value) => setFilter("dateTo", value || undefined)} />
        </label>
      </Toolbar>
      <DataTable
        rows={list.data?.data}
        meta={list.data?.meta}
        onPageChange={setPage}
        isLoading={list.isPending}
        error={list.error}
        onRetry={() => list.refetch()}
        rowKey={(row) => row.id}
        onRowClick={setSelected}
        emptyTitle={t("empty")}
        minWidth={820}
        columns={[
          { key: "at", header: t("at"), cell: (row) => formatDateTime(row.createdAt, locale) },
          {
            key: "actor",
            header: t("actor"),
            cell: (row) =>
              row.actor ? (
                <div className="flex flex-col">
                  <span className="cell-strong">{row.actor.fullName}</span>
                  <span className="text-xs text-text-muted">{roleLabel(row.actor.role)}</span>
                </div>
              ) : (
                t("system")
              ),
          },
          { key: "action", header: t("action"), cell: (row) => <code className="text-xs" dir="ltr">{row.action}</code> },
          { key: "entity", header: t("entityType"), cell: (row) => <code className="text-xs" dir="ltr">{row.entityType}</code> },
          { key: "ip", header: t("ip"), cell: (row) => <span dir="ltr">{row.ipAddress ?? "—"}</span> },
        ]}
      />

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={t("detail")}>
        {selected ? (
          <>
            <KeyValue
              items={[
                { label: t("action"), value: <code dir="ltr">{selected.action}</code> },
                { label: t("entityType"), value: <code dir="ltr">{selected.entityType}</code> },
                { label: t("entityId"), value: <code dir="ltr" className="text-xs">{selected.entityId ?? "—"}</code> },
                { label: t("at"), value: formatDateTime(selected.createdAt, locale) },
                { label: t("actor"), value: selected.actor?.fullName ?? t("system") },
                { label: t("ip"), value: <span dir="ltr">{selected.ipAddress ?? "—"}</span> },
              ]}
            />
            <Field label={t("before")}>
              <JsonBlock value={selected.before} />
            </Field>
            <Field label={t("after")}>
              <JsonBlock value={selected.after} />
            </Field>
          </>
        ) : null}
      </Modal>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <TextInput disabled value="—" readOnly />;
  return (
    <pre dir="ltr" className="max-h-56 overflow-auto rounded-lg bg-surface-muted p-3 text-start text-xs text-text-secondary">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
