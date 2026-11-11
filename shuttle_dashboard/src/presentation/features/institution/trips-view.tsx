"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Calendar } from "iconsax-react-v2";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "@/application/stores/toast-store";
import type { GenerationResult } from "@/domain/models/entities";
import { TRIP_DIRECTIONS, TRIP_STATUSES } from "@/domain/models/enums";
import { useRouter } from "@/i18n/navigation";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { AppDatePicker } from "@/presentation/components/ui/app-date-picker";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, SelectInput } from "@/presentation/components/ui/form";
import { Modal } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import {
  Card,
  EnumFilterSelect,
  FilterSelect,
  KeyValue,
  PageSection,
  StatCard,
  StatGrid,
  Toolbar,
} from "@/presentation/components/ui/panel";
import { useBranchName, useBranchOptions, useRouteOptions } from "@/presentation/features/institution/use-institution";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { formatServiceDate, todayISO } from "@/shared/lib/format";

export function TripsView() {
  const t = useTranslations("Trips");
  const locale = useLocale();
  const router = useRouter();
  const directionLabel = useEnumLabel("direction");
  const branchName = useBranchName();
  const branchOptions = useBranchOptions();
  const routeOptions = useRouteOptions();
  const [generateOpen, setGenerateOpen] = useState(false);
  const { filters, setFilter, setPage, query } = useListParams({
    date: todayISO() as string | undefined,
    branchId: undefined as string | undefined,
    routeId: undefined as string | undefined,
    direction: undefined as string | undefined,
    status: undefined as string | undefined,
    delayed: undefined as string | undefined,
  });

  const stats = useQuery({
    queryKey: qk.institution.tripStats(filters.date),
    queryFn: () => institutionApi.tripStats(filters.date),
  });
  const list = useQuery({
    queryKey: qk.institution.tripList(query),
    queryFn: () => institutionApi.trips(query),
    placeholderData: keepPreviousData,
  });
  const s = stats.data;

  return (
    <PageSection>
      <PageHeader
        icon="history"
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setGenerateOpen(true)}>
            <Calendar size={16} color="currentColor" variant="Linear" />
            {t("generate")}
          </button>
        }
      />
      <StatGrid>
        <StatCard icon="history" label={t("total")} value={s?.total ?? 0} loading={stats.isPending} hint={t("scheduledHint", { count: s?.scheduled ?? 0 })} />
        <StatCard icon="live" tone="success" label={t("inProgress")} value={s?.inProgress ?? 0} loading={stats.isPending} hint={t("completedHint", { count: s?.completed ?? 0 })} />
        <StatCard icon="chart" tone="warning" label={t("delayed")} value={s?.delayed ?? 0} loading={stats.isPending} />
        <StatCard icon="incident" tone="danger" label={t("cancelled")} value={s?.cancelled ?? 0} loading={stats.isPending} />
      </StatGrid>
      <Card>
        <Toolbar>
          <AppDatePicker
            size="sm"
            clearable
            className="w-[200px]"
            placeholder={t("date")}
            value={filters.date ?? ""}
            onChange={(value) => setFilter("date", value || undefined)}
          />
          {branchOptions.length > 1 ? (
            <FilterSelect placeholder={t("branch")} value={filters.branchId} onChange={(value) => setFilter("branchId", value)} options={branchOptions} />
          ) : null}
          <FilterSelect placeholder={t("route")} value={filters.routeId} onChange={(value) => setFilter("routeId", value)} options={routeOptions} />
          <EnumFilterSelect placeholder={t("direction")} value={filters.direction} onChange={(value) => setFilter("direction", value)} group="direction" values={TRIP_DIRECTIONS} />
          <EnumFilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => setFilter("status", value)} group="status" values={TRIP_STATUSES} />
          <FilterSelect
            placeholder={t("delay")}
            value={filters.delayed}
            onChange={(value) => setFilter("delayed", value)}
            options={[
              { value: "true", label: t("delayedOnly") },
              { value: "false", label: t("onTimeOnly") },
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
          onRowClick={(row) => router.push(`/institution/trips/${row.id}`)}
          emptyTitle={t("empty")}
          emptyDescription={t("emptyHint")}
          minWidth={1040}
          columns={[
            { key: "route", header: t("route"), cell: (row) => <span className="cell-strong">{row.route?.name ?? "—"}</span> },
            { key: "branch", header: t("branch"), cell: (row) => row.branch?.name ?? branchName(row.branchId) },
            { key: "date", header: t("date"), cell: (row) => formatServiceDate(row.serviceDate, locale) },
            { key: "time", header: t("departure"), cell: (row) => <span dir="ltr">{row.scheduledDepartureTime}</span> },
            { key: "direction", header: t("direction"), cell: (row) => directionLabel(row.direction) },
            { key: "driver", header: t("driver"), cell: (row) => row.driver?.user?.fullName ?? <span className="text-warning">{t("noDriver")}</span> },
            { key: "vehicle", header: t("vehicle"), cell: (row) => (row.vehicle ? <span dir="ltr">{row.vehicle.plateNumber}</span> : <span className="text-warning">{t("noVehicle")}</span>) },
            { key: "students", header: t("students"), cell: (row) => row.studentCount },
            {
              key: "status",
              header: t("status"),
              cell: (row) => (
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={row.status} />
                  {row.delayed ? <Chip tone="warning">{t("delayedBy", { minutes: row.delayMinutes ?? 0 })}</Chip> : null}
                </div>
              ),
            },
          ]}
        />
      </Card>
      <GenerateTripsModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        defaultDate={filters.date}
        routeOptions={routeOptions}
        onGenerated={(generatedDate) => setFilter("date", generatedDate)}
      />
    </PageSection>
  );
}

function GenerateTripsModal({
  open,
  onClose,
  defaultDate,
  routeOptions,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
  routeOptions: { value: string; label: string }[];
  onGenerated: (date: string) => void;
}) {
  const t = useTranslations("Trips");
  const tCommon = useTranslations("Common");
  const [date, setDate] = useState(defaultDate ?? todayISO());
  const [routeId, setRouteId] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDate(defaultDate ?? todayISO());
      setRouteId("");
      setResult(null);
    }
  }

  const generate = useApiMutation({
    mutationFn: () => institutionApi.generateTrips(date, routeId || undefined),
    invalidate: [qk.institution.trips],
    successMessage: false,
    onSuccess: (generated) => {
      setResult(generated);
      onGenerated(date);
      if (generated.tripsCreated > 0) toast.success(t("generated"));
      else if (generated.tripsExisting > 0) toast.info(t("generatedExisting"));
      else toast.info(t("generatedNone"));
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("generateTitle")}
      subtitle={t("generateHint")}
      onSubmit={(event) => {
        event.preventDefault();
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) generate.mutate();
      }}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {result ? tCommon("close") : tCommon("cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={generate.isPending || !date}>
            {generate.isPending ? t("generating") : t("generate")}
          </button>
        </>
      }
    >
      <Field label={t("date")} required>
        <AppDatePicker value={date} onChange={setDate} />
      </Field>
      <Field label={t("route")} hint={t("allRoutesHint")}>
        <SelectInput
          value={routeId}
          onChange={setRouteId}
          options={[{ value: "", label: t("allRoutes") }, ...routeOptions]}
        />
      </Field>
      {result ? (
        <KeyValue
          items={[
            { label: t("routesConsidered"), value: result.routesConsidered },
            { label: t("tripsCreated"), value: result.tripsCreated },
            { label: t("tripsExisting"), value: result.tripsExisting },
            { label: t("stopsCreated"), value: result.stopsCreated },
            { label: t("studentsCreated"), value: result.studentsCreated },
            { label: t("exceptionsApplied"), value: result.exceptionsApplied },
          ]}
        />
      ) : null}
    </Modal>
  );
}
