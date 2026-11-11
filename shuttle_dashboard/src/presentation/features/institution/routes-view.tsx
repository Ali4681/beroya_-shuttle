"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Add } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import type { RouteSummary } from "@/domain/models/entities";
import { ROUTE_STATUSES } from "@/domain/models/enums";
import { useRouter } from "@/i18n/navigation";
import { institutionApi, type RouteInput } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { LocationPickerMap } from "@/presentation/components/map/location-picker-map";
import { Chip, StatusBadge } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, FormGrid, NumberInput, SelectInput, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { Drawer } from "@/presentation/components/ui/overlay";
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
import { useBranchName, useBranchOptions, useInstitution } from "@/presentation/features/institution/use-institution";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState, useResetOnKey } from "@/presentation/hooks/use-form-state";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { v } from "@/shared/lib/validation";

export function RoutesView() {
  const t = useTranslations("Routes");
  const router = useRouter();
  const branchName = useBranchName();
  const branchOptions = useBranchOptions();
  const [createOpen, setCreateOpen] = useState(false);
  const { filters, setFilter, setPage, query } = useListParams({
    search: undefined as string | undefined,
    branchId: undefined as string | undefined,
    status: undefined as string | undefined,
  });

  const stats = useQuery({ queryKey: [...qk.institution.routes(), "stats"], queryFn: institutionApi.routeStats });
  const list = useQuery({
    queryKey: qk.institution.routes(query),
    queryFn: () => institutionApi.routes(query),
    placeholderData: keepPreviousData,
  });
  const s = stats.data;

  return (
    <PageSection>
      <PageHeader
        icon="route"
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
        <StatCard icon="route" label={t("total")} value={s?.total ?? 0} loading={stats.isPending} />
        <StatCard icon="chart" tone="success" label={t("active")} value={s?.active ?? 0} loading={stats.isPending} />
        <StatCard icon="incident" tone="warning" label={t("stoppedToday")} value={(s?.stoppedToday ?? 0) + (s?.unavailable ?? 0)} loading={stats.isPending} hint={t("underEditHint", { count: s?.underEdit ?? 0 })} />
        <StatCard icon="document" tone="danger" label={t("suspended")} value={s?.suspended ?? 0} loading={stats.isPending} />
      </StatGrid>
      <Card>
        <Toolbar>
          <SearchInput value={filters.search ?? ""} onChange={(value) => setFilter("search", value || undefined)} placeholder={t("searchPlaceholder")} />
          {branchOptions.length > 1 ? (
            <FilterSelect placeholder={t("branch")} value={filters.branchId} onChange={(value) => setFilter("branchId", value)} options={branchOptions} />
          ) : null}
          <EnumFilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => setFilter("status", value)} group="status" values={ROUTE_STATUSES} />
        </Toolbar>
        <DataTable
          rows={list.data?.data}
          meta={list.data?.meta}
          onPageChange={setPage}
          isLoading={list.isPending}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/institution/routes/${row.id}`)}
          emptyTitle={t("empty")}
          emptyDescription={t("emptyHint")}
          minWidth={1000}
          columns={[
            {
              key: "name",
              header: t("name"),
              cell: (row) => (
                <div className="flex flex-col">
                  <span className="cell-strong">{row.name}</span>
                  {row.code ? <span className="text-xs text-text-muted" dir="ltr">{row.code}</span> : null}
                </div>
              ),
            },
            { key: "branch", header: t("branch"), cell: (row) => branchName(row.branchId) },
            { key: "driver", header: t("driver"), cell: (row) => row.defaultDriver?.user?.fullName ?? <span className="text-text-muted">—</span> },
            { key: "vehicle", header: t("vehicle"), cell: (row) => (row.defaultVehicle ? <span dir="ltr">{row.defaultVehicle.plateNumber}</span> : "—") },
            { key: "students", header: t("students"), cell: (row) => row.studentCount },
            { key: "schedules", header: t("schedules"), cell: (row) => row.scheduleCount },
            {
              key: "status",
              header: t("status"),
              cell: (row) => (
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={row.status} />
                  {row.stopsOrderStale ? <Chip tone="warning">{t("stopsStale")}</Chip> : null}
                </div>
              ),
            },
          ]}
        />
      </Card>
      <RouteFormDrawer open={createOpen} onClose={() => setCreateOpen(false)} onSaved={(route) => router.push(`/institution/routes/${route.id}`)} />
    </PageSection>
  );
}

const routeSchema = z.object({
  name: v.name(),
  branchId: v.uuid(),
  code: v.optionalText(),
  originLabel: v.optionalText(),
  originLat: v.latitude(),
  originLng: v.longitude(),
  delayThresholdMinutes: v.optionalInt(1, 180),
});

export function RouteFormDrawer({
  open,
  onClose,
  route,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  route?: RouteSummary;
  onSaved?: (route: RouteSummary) => void;
}) {
  const t = useTranslations("Routes");
  const tCommon = useTranslations("Common");
  const { branches } = useInstitution();
  const branchOptions = useBranchOptions();
  const firstBranch = branches[0];
  const initial = {
    name: route?.name ?? "",
    branchId: route?.branchId ?? firstBranch?.id ?? "",
    code: route?.code ?? "",
    originLabel: route?.originLabel ?? firstBranch?.name ?? "",
    originLat: route?.originLat ?? firstBranch?.latitude ?? 36.19934,
    originLng: route?.originLng ?? firstBranch?.longitude ?? 37.15822,
    delayThresholdMinutes: route?.delayThresholdMinutes != null ? String(route.delayThresholdMinutes) : "",
  };
  const form = useFormState(initial);
  useResetOnKey(open ? (route?.id ?? "new") : null, form.reset, initial);
  const { values, set, errors } = form;

  const save = useApiMutation({
    mutationFn: (input: RouteInput) => (route ? institutionApi.updateRoute(route.id, input) : institutionApi.createRoute(input)),
    invalidate: [qk.institution.routes(), ...(route ? [qk.institution.route(route.id)] : [])],
    onError: form.captureServerError,
    onSuccess: (saved) => {
      onClose();
      onSaved?.(saved);
    },
  });

  function pickBranch(id: string) {
    set("branchId", id);
    const branch = branches.find((item) => item.id === id);
    if (!route && branch?.latitude != null && branch.longitude != null) {
      form.setValues((current) => ({
        ...current,
        branchId: id,
        originLat: branch.latitude!,
        originLng: branch.longitude!,
        originLabel: current.originLabel || branch.name,
      }));
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={route ? t("edit") : t("add")}
      subtitle={t("formHint")}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(routeSchema);
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
      <FormGrid>
        <Field label={t("name")} required error={errors.name}>
          <TextInput value={values.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
        </Field>
        <Field label={t("code")}>
          <TextInput dir="ltr" value={values.code} onChange={(e) => set("code", e.target.value)} />
        </Field>
        <Field label={t("branch")} required error={errors.branchId}>
          <SelectInput value={values.branchId} onChange={pickBranch} options={branchOptions} />
        </Field>
        <Field label={t("delayThreshold")} error={errors.delayThresholdMinutes} hint={t("delayThresholdHint")}>
          <NumberInput min={1} max={180} unit={tCommon("unitMinutes")} value={values.delayThresholdMinutes} onChange={(value) => set("delayThresholdMinutes", value)} invalid={!!errors.delayThresholdMinutes} />
        </Field>
      </FormGrid>
      <Field label={t("originLabel")}>
        <TextInput value={values.originLabel} onChange={(e) => set("originLabel", e.target.value)} />
      </Field>
      <Field label={t("origin")} required error={errors.originLat ?? errors.originLng} hint={t("originHint")}>
        <LocationPickerMap
          lat={values.originLat}
          lng={values.originLng}
          onChange={(coords) => form.setValues((current) => ({ ...current, originLat: coords.lat, originLng: coords.lng }))}
        />
      </Field>
    </Drawer>
  );
}
