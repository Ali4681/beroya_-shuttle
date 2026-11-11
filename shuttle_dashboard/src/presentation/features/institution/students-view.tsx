"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Add } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PICKUP_TYPES, STUDENT_STATUSES } from "@/domain/models/enums";
import { useRouter } from "@/i18n/navigation";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { mediaUrl } from "@/infrastructure/api/uploads";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { PageHeader } from "@/presentation/components/ui/page-header";
import {
  Card,
  EnumFilterSelect,
  FilterSelect,
  PageSection,
  SearchInput,
  StatCard,
  StatGrid,
  Toolbar,
} from "@/presentation/components/ui/panel";
import { StudentDrawer } from "@/presentation/features/institution/student-forms";
import { useBranchName, useBranchOptions, useRouteOptions } from "@/presentation/features/institution/use-institution";
import { useListParams } from "@/presentation/hooks/use-list-params";

export function StudentAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- served by backend storage
    return <img src={mediaUrl(url)} alt="" className="size-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
      {name.trim().slice(0, 2)}
    </span>
  );
}

export function StudentsView() {
  const t = useTranslations("Students");
  const router = useRouter();
  const pickupLabel = useEnumLabel("pickupType");
  const branchName = useBranchName();
  const branchOptions = useBranchOptions();
  const routeOptions = useRouteOptions();
  const [createOpen, setCreateOpen] = useState(false);
  const { filters, setFilter, setPage, query } = useListParams({
    search: undefined as string | undefined,
    branchId: undefined as string | undefined,
    grade: undefined as string | undefined,
    routeId: undefined as string | undefined,
    pickupType: undefined as string | undefined,
    status: undefined as string | undefined,
    withoutRoute: undefined as string | undefined,
  });

  const stats = useQuery({ queryKey: [...qk.institution.students(), "stats"], queryFn: institutionApi.studentStats });
  const list = useQuery({
    queryKey: qk.institution.students(query),
    queryFn: () => institutionApi.students(query),
    placeholderData: keepPreviousData,
  });
  const s = stats.data;

  return (
    <PageSection>
      <PageHeader
        icon="student"
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <Add size={16} color="currentColor" variant="Linear" />
            {t("add")}
          </button>
        }
      />
      <StatGrid>
        <StatCard icon="student" label={t("total")} value={s?.total ?? 0} loading={stats.isPending} hint={t("activeHint", { count: s?.active ?? 0 })} />
        <StatCard icon="route" tone="warning" label={t("withoutRoute")} value={s?.withoutRoute ?? 0} loading={stats.isPending} />
        <StatCard icon="home" label={t("homePickup")} value={s?.homePickup ?? 0} loading={stats.isPending} />
        <StatCard icon="location" label={t("meetingPointPickup")} value={s?.meetingPointPickup ?? 0} loading={stats.isPending} />
      </StatGrid>
      <Card>
        <Toolbar>
          <SearchInput value={filters.search ?? ""} onChange={(value) => setFilter("search", value || undefined)} placeholder={t("searchPlaceholder")} />
          {branchOptions.length > 1 ? (
            <FilterSelect placeholder={t("branch")} value={filters.branchId} onChange={(value) => setFilter("branchId", value)} options={branchOptions} />
          ) : null}
          <SearchInput value={filters.grade ?? ""} onChange={(value) => setFilter("grade", value || undefined)} placeholder={t("grade")} className="sm:max-w-[140px]" />
          <FilterSelect placeholder={t("route")} value={filters.routeId} onChange={(value) => setFilter("routeId", value)} options={routeOptions} />
          <EnumFilterSelect placeholder={t("pickupType")} value={filters.pickupType} onChange={(value) => setFilter("pickupType", value)} group="pickupType" values={PICKUP_TYPES} />
          <EnumFilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => setFilter("status", value)} group="status" values={STUDENT_STATUSES} />
          <FilterSelect
            placeholder={t("assignment")}
            value={filters.withoutRoute}
            onChange={(value) => setFilter("withoutRoute", value)}
            options={[{ value: "true", label: t("withoutRoute") }]}
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
          onRowClick={(row) => router.push(`/institution/students/${row.id}`)}
          emptyTitle={t("empty")}
          emptyDescription={t("emptyHint")}
          minWidth={1000}
          columns={[
            {
              key: "name",
              header: t("fullName"),
              cell: (row) => (
                <div className="flex items-center gap-3">
                  <StudentAvatar name={row.fullName} url={row.photoUrl} />
                  <span className="cell-strong">{row.fullName}</span>
                </div>
              ),
            },
            { key: "grade", header: t("grade"), cell: (row) => [row.grade, row.section].filter(Boolean).join(" / ") || "—" },
            { key: "branch", header: t("branch"), cell: (row) => branchName(row.branchId) },
            {
              key: "guardian",
              header: t("guardian"),
              cell: (row) =>
                row.guardian ? (
                  <div className="flex flex-col">
                    <span>{row.guardian.fullName}</span>
                    <span className="text-xs text-text-muted" dir="ltr">{row.guardian.phone}</span>
                  </div>
                ) : (
                  "—"
                ),
            },
            { key: "pickup", header: t("pickupType"), cell: (row) => (row.pickup ? pickupLabel(row.pickup.pickupType) : "—") },
            {
              key: "route",
              header: t("route"),
              cell: (row) => row.currentRoute?.name ?? <Chip tone="warning">{t("noRoute")}</Chip>,
            },
            { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </Card>
      <StudentDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(student) => router.push(`/institution/students/${student.id}`)} />
    </PageSection>
  );
}
