"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Add, Car, Edit } from "iconsax-react-v2";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { z } from "zod";
import type { Driver, Paginated, ResourceStats, ResourceTrip, Vehicle } from "@/domain/models/entities";
import {
  FLEET_OWNER_TYPES,
  RESOURCE_STATUSES,
  VEHICLE_STATUSES,
  type FleetOwnerType,
  type OwnerType,
  type VehicleStatus,
} from "@/domain/models/enums";
import { adminApi, type DriverInput, type VehicleInput } from "@/infrastructure/api/admin.api";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { AppDatePicker } from "@/presentation/components/ui/app-date-picker";
import { Chip, StatusBadge, useEnumLabel, useEnumOptions } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import { Field, FormGrid, NumberInput, PasswordInput, SelectInput, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { Drawer, Modal } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import {
  Card,
  ConfirmDialog,
  EnumFilterSelect,
  FilterSelect,
  PageSection,
  SearchInput,
  StatCard,
  StatGrid,
  Toolbar,
} from "@/presentation/components/ui/panel";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState, useResetOnKey } from "@/presentation/hooks/use-form-state";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { formatDate, formatServiceDate, isoToDateInput } from "@/shared/lib/format";
import { v } from "@/shared/lib/validation";

type Scope = "admin" | "institution";
type Query = Record<string, string | number | undefined>;

const driverApi = {
  admin: {
    list: (q: Query) => adminApi.drivers(q),
    create: adminApi.createDriver,
    update: adminApi.updateDriver,
    status: adminApi.setDriverStatus,
    trips: (id: string) => adminApi.driverTrips(id, { limit: 50 }),
    stats: null as null | (() => Promise<ResourceStats>),
  },
  institution: {
    list: (q: Query) => institutionApi.drivers(q),
    create: institutionApi.createDriver,
    update: institutionApi.updateDriver,
    status: institutionApi.setDriverStatus,
    trips: (id: string) => institutionApi.driverTrips(id, { limit: 50 }),
    stats: institutionApi.driverStats,
  },
};

const vehicleApi = {
  admin: {
    list: (q: Query) => adminApi.vehicles(q),
    create: adminApi.createVehicle,
    update: adminApi.updateVehicle,
    status: adminApi.setVehicleStatus,
    trips: (id: string) => adminApi.vehicleTrips(id, { limit: 50 }) as Promise<Paginated<ResourceTrip>> | null,
    stats: null as null | (() => Promise<ResourceStats>),
  },
  institution: {
    list: (q: Query) => institutionApi.vehicles(q),
    create: institutionApi.createVehicle,
    update: institutionApi.updateVehicle,
    status: institutionApi.setVehicleStatus,
    trips: null,
    stats: institutionApi.vehicleStats,
  },
};

function listKey(scope: Scope, kind: "drivers" | "vehicles", params?: Query) {
  if (scope === "admin") return kind === "drivers" ? qk.admin.drivers(params) : qk.admin.vehicles(params);
  return kind === "drivers" ? qk.institution.drivers(params) : qk.institution.vehicles(params);
}

function statsKey(kind: "drivers" | "vehicles") {
  return [kind, "stats"] as const;
}

function ResourceStatsRow({ kind, load }: { kind: "drivers" | "vehicles"; load: () => Promise<ResourceStats> }) {
  const t = useTranslations("Resources");
  const stats = useQuery({ queryKey: statsKey(kind), queryFn: load });
  const s = stats.data;
  return (
    <StatGrid>
      <StatCard icon={kind === "drivers" ? "driver" : "vehicle"} label={t("statsOwned")} value={s?.total ?? 0} loading={stats.isPending} />
      <StatCard icon="chart" tone="success" label={t("statsActive")} value={s?.active ?? 0} loading={stats.isPending} />
      <StatCard icon="route" label={t("statsAssigned")} value={s?.assigned ?? 0} loading={stats.isPending} />
      <StatCard
        icon="incident"
        tone="warning"
        label={kind === "vehicles" ? t("statsMaintenance") : t("statsSuspended")}
        value={(kind === "vehicles" ? s?.underMaintenance : s?.suspended) ?? 0}
        loading={stats.isPending}
      />
    </StatGrid>
  );
}

function OwnerChip({ owner }: { owner: OwnerType }) {
  const label = useEnumLabel("ownerType");
  return (
    <Chip tone={owner === "BEROYA" ? "info" : owner === "DRIVER" ? "warning" : "muted"}>
      {label(owner)}
    </Chip>
  );
}

/* ───────────────────────────── Drivers ───────────────────────────── */

export function DriversView({
  scope,
  institutionId,
  embedded = false,
  readOnly = false,
}: {
  scope: Scope;
  /** When set (admin), lists/creates drivers linked to this Beroya-operated institution. */
  institutionId?: string;
  embedded?: boolean;
  /** Beroya-operated institution panel: view only. */
  readOnly?: boolean;
}) {
  const t = useTranslations("Resources");
  const locale = useLocale();
  const api = driverApi[scope];
  const [editing, setEditing] = useState<Driver | null | "new">(null);
  const [statusTarget, setStatusTarget] = useState<Driver | null>(null);
  const [tripsFor, setTripsFor] = useState<Driver | null>(null);
  const { filters, setFilter, setPage, query } = useListParams({
    search: undefined as string | undefined,
    status: undefined as string | undefined,
    ownerType: undefined as string | undefined,
    assigned: undefined as string | undefined,
  });
  const listQuery = { ...query, ...(institutionId ? { institutionId } : {}) };

  const list = useQuery({
    queryKey: listKey(scope, "drivers", listQuery),
    queryFn: () => api.list(listQuery),
    placeholderData: keepPreviousData,
  });

  const setStatus = useApiMutation({
    mutationFn: (driver: Driver) => api.status(driver.id, driver.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"),
    invalidate: [listKey(scope, "drivers"), statsKey("drivers")],
    onSuccess: () => setStatusTarget(null),
  });

  const editable = (driver: Driver) =>
    !readOnly && (scope === "admin" || driver.ownerType === "INSTITUTION");

  return (
    <PageSection>
      <PageHeader
        icon="driver"
        title={
          embedded
            ? t("institutionDriversTitle")
            : scope === "admin"
              ? t("beroyaDriversTitle")
              : t("driversTitle")
        }
        subtitle={
          readOnly
            ? t("beroyaAssignedDriversSubtitle")
            : embedded
              ? t("institutionDriversSubtitle")
              : scope === "admin"
                ? t("beroyaDriversSubtitle")
                : t("driversSubtitle")
        }
        actions={
          readOnly ? null : (
            <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
              <Add size={16} color="currentColor" variant="Linear" />
              {t("addDriver")}
            </button>
          )
        }
      />
      {api.stats && !embedded ? <ResourceStatsRow kind="drivers" load={api.stats} /> : null}
      <Card>
        <Toolbar>
          <SearchInput value={filters.search ?? ""} onChange={(value) => setFilter("search", value || undefined)} placeholder={t("searchDrivers")} />
          <EnumFilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => setFilter("status", value)} group="status" values={RESOURCE_STATUSES} />
          {scope === "institution" ? (
            <EnumFilterSelect placeholder={t("owner")} value={filters.ownerType} onChange={(value) => setFilter("ownerType", value)} group="ownerType" values={["INSTITUTION", "BEROYA"]} />
          ) : null}
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
          emptyTitle={t("noDrivers")}
          minWidth={980}
          columns={[
            {
              key: "name",
              header: t("name"),
              cell: (row) => (
                <div className="flex flex-col">
                  <span className="cell-strong">{row.user?.fullName ?? "—"}</span>
                  <span className="text-xs text-text-muted" dir="ltr">{row.user?.phone}</span>
                </div>
              ),
            },
            ...(scope === "institution"
              ? [{ key: "owner", header: t("owner"), cell: (row: Driver) => <OwnerChip owner={row.ownerType} /> }]
              : []),
            { key: "license", header: t("licenseNumber"), cell: (row) => row.licenseNumber ?? "—" },
            { key: "expiry", header: t("licenseExpiry"), cell: (row) => formatDate(row.licenseExpiry, locale) },
            {
              key: "vehicle",
              header: t("linkedVehicle"),
              cell: (row) =>
                row.primaryVehicle ? (
                  <span className="cell-strong" dir="ltr">{row.primaryVehicle.plateNumber}</span>
                ) : (
                  <span className="text-text-muted">{t("noneOptional")}</span>
                ),
            },
            ...(scope === "institution" || institutionId
              ? [
                  {
                    key: "dailyTrips",
                    header: t("dailyTripsLimit"),
                    cell: (row: Driver) =>
                      row.dailyTripsLimit != null ? (
                        <span className="cell-strong">{t("dailyTripsValue", { count: row.dailyTripsLimit })}</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      ),
                  },
                ]
              : []),
            {
              key: "routes",
              header: t("assignedRoutes"),
              cell: (row) =>
                row.assignedRoutes.length ? (
                  <div className="flex flex-wrap gap-1">
                    {row.assignedRoutes.map((route) => (
                      <Chip key={route.id} tone={route.needsReassignment ? "warning" : "muted"}>
                        {route.name}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <span className="text-text-muted">{t("unassigned")}</span>
                ),
            },
            { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
            ...(readOnly
              ? []
              : [
                  {
                    key: "actions",
                    header: t("actions"),
                    cell: (row: Driver) => (
                      <div className="flex items-center gap-1">
                        <button type="button" className="icon-btn" title={t("trips")} onClick={() => setTripsFor(row)}>
                          <Car size={16} color="currentColor" variant="Linear" />
                        </button>
                        {editable(row) ? (
                          <>
                            <button type="button" className="icon-btn" title={t("edit")} onClick={() => setEditing(row)}>
                              <Edit size={16} color="currentColor" variant="Linear" />
                            </button>
                            <button
                              type="button"
                              className={row.status === "ACTIVE" ? "btn btn-danger btn-sm" : "btn btn-secondary btn-sm"}
                              onClick={() => setStatusTarget(row)}
                            >
                              {row.status === "ACTIVE" ? t("suspend") : t("activate")}
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-text-muted">{t("beroyaReadOnly")}</span>
                        )}
                      </div>
                    ),
                  },
                ]),
          ]}
        />
      </Card>

      {!readOnly ? (
        <DriverDrawer
          scope={scope}
          institutionId={institutionId}
          driver={editing === "new" ? null : editing}
          open={editing !== null}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.status === "ACTIVE" ? t("suspendTitle") : t("activateTitle")}
        description={statusTarget?.status === "ACTIVE" ? t("suspendDriverConfirm") : t("activateConfirm")}
        danger={statusTarget?.status === "ACTIVE"}
        pending={setStatus.isPending}
        onConfirm={() => statusTarget && setStatus.mutate(statusTarget)}
      />

      <TripsModal
        title={tripsFor?.user?.fullName ?? ""}
        open={Boolean(tripsFor)}
        onClose={() => setTripsFor(null)}
        queryKey={tripsFor ? [...listKey(scope, "drivers"), tripsFor.id, "trips"] : ["noop"]}
        load={tripsFor ? () => api.trips(tripsFor.id) : null}
      />
    </PageSection>
  );
}

function driverSchema(options: { keepCredentials?: boolean; editing?: boolean }) {
  return z.object({
    fullName: v.name(),
    phone: v.phone(),
    // When the driver already exists (e.g. selected via a driver-owned vehicle),
    // login fields are hidden and must not block submit.
    email: options.keepCredentials ? v.optionalEmail() : v.email(),
    password:
      options.keepCredentials || options.editing ? v.optionalPassword() : v.password(),
    nationalId: v.optionalText(),
    licenseNumber: v.optionalText(),
    licenseExpiry: v.optionalDate(),
  });
}

const DAILY_TRIPS_OPTIONS = Array.from({ length: 10 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));

function DriverDrawer({
  scope,
  institutionId,
  driver,
  open,
  onClose,
}: {
  scope: Scope;
  institutionId?: string;
  driver: Driver | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Resources");
  const tCommon = useTranslations("Common");
  const api = driverApi[scope];
  const vehicles = vehicleApi[scope];
  const linkedVehicle = driver?.primaryVehicle;
  const canAssignExisting = Boolean(institutionId) && !driver;
  const showDailyTrips = Boolean(institutionId);

  const pool = useQuery({
    queryKey: listKey(scope, "drivers", { limit: 100, picker: "1" }),
    queryFn: () => api.list({ limit: 100 }),
    enabled: open && canAssignExisting,
  });

  const initial = {
    driverMode: (canAssignExisting ? "existing" : "new") as "existing" | "new",
    existingDriverId: "",
    dailyTripsLimit: driver?.dailyTripsLimit != null ? String(driver.dailyTripsLimit) : "1",
    fullName: driver?.user?.fullName ?? "",
    phone: driver?.user?.phone ?? "",
    email: driver?.user?.email ?? "",
    password: "",
    nationalId: driver?.nationalId ?? "",
    licenseNumber: driver?.licenseNumber ?? "",
    licenseExpiry: isoToDateInput(driver?.licenseExpiry),
    plateNumber: linkedVehicle?.plateNumber ?? "",
    vehicleType: linkedVehicle?.vehicleType ?? "",
    capacity: linkedVehicle?.capacity != null ? String(linkedVehicle.capacity) : "",
    insuranceExpiry: isoToDateInput(linkedVehicle?.insuranceExpiry),
  };
  const form = useFormState(initial);
  useResetOnKey(open ? (driver?.id ?? "new") : null, form.reset, initial);
  const { values, set, setValues, errors } = form;
  const assigningExisting = canAssignExisting && values.driverMode === "existing";

  const driverOptions = (pool.data?.data ?? [])
    .filter((item) => !item.institutionId || item.institutionId === institutionId)
    .map((item) => ({
      value: item.id,
      label: `${item.user?.fullName ?? "—"} (${item.user?.phone ?? ""})`,
    }));

  const save = useApiMutation({
    mutationFn: async (
      input: DriverInput & { vehiclePatch?: VehicleInput; assignDriverId?: string },
    ) => {
      const { vehiclePatch, assignDriverId, ...driverInput } = input;
      if (assignDriverId) {
        return api.update(assignDriverId, driverInput);
      }
      const saved = driver ? await api.update(driver.id, driverInput) : await api.create(driverInput);
      if (vehiclePatch && linkedVehicle) {
        await vehicles.update(linkedVehicle.id, vehiclePatch);
      }
      return saved;
    },
    invalidate: [listKey(scope, "drivers"), listKey(scope, "vehicles"), statsKey("drivers"), statsKey("vehicles")],
    onError: form.captureServerError,
    onSuccess: onClose,
  });

  function parseDailyTrips(): number | null {
    if (!showDailyTrips) return null;
    const limit = Number(values.dailyTripsLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      form.setErrors((current) => ({ ...current, dailyTripsLimit: "required" }));
      return null;
    }
    return limit;
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={driver ? t("editDriver") : t("addDriver")}
      subtitle={
        assigningExisting ? t("assignExistingHint") : driver ? undefined : t("driverLoginHint")
      }
      onSubmit={(event) => {
        event.preventDefault();
        const dailyTripsLimit = parseDailyTrips();
        if (showDailyTrips && dailyTripsLimit == null) return;

        if (assigningExisting) {
          if (!values.existingDriverId) {
            form.setErrors((current) => ({ ...current, existingDriverId: "required" }));
            return;
          }
          save.mutate({
            assignDriverId: values.existingDriverId,
            institutionId,
            dailyTripsLimit: dailyTripsLimit!,
          });
          return;
        }

        const data = form.validate(driverSchema({ editing: Boolean(driver) }));
        if (!data) return;
        const plate = values.plateNumber.trim();
        if (plate.length < 3) {
          form.setErrors((current) => ({ ...current, plateNumber: "min3" }));
          return;
        }
        const vehicleFields = {
          plateNumber: plate,
          vehicleType: values.vehicleType || undefined,
          capacity: values.capacity ? Number(values.capacity) : undefined,
          insuranceExpiry: values.insuranceExpiry || undefined,
        };
        const payload: DriverInput & { vehiclePatch?: VehicleInput } = {
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          nationalId: data.nationalId,
          licenseNumber: data.licenseNumber,
          licenseExpiry: data.licenseExpiry,
          ...(institutionId ? { institutionId } : {}),
          ...(dailyTripsLimit != null ? { dailyTripsLimit } : {}),
        };
        if (data.password) payload.password = data.password;
        if (driver && linkedVehicle) {
          payload.vehicleId = linkedVehicle.id;
          payload.vehiclePatch = vehicleFields;
        } else {
          payload.newVehicle = vehicleFields;
        }
        save.mutate(payload);
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

      {canAssignExisting ? (
        <Field label={t("assignMode")} required>
          <SelectInput
            value={values.driverMode}
            onChange={(value) => set("driverMode", value as "existing" | "new")}
            options={[
              { value: "existing", label: t("useExistingDriver") },
              { value: "new", label: t("addNewDriver") },
            ]}
          />
        </Field>
      ) : null}

      {assigningExisting ? (
        <>
          <Field label={t("selectDriver")} required error={errors.existingDriverId}>
            <SelectInput
              value={values.existingDriverId}
              onChange={(value) => {
                set("existingDriverId", value);
                const selected = pool.data?.data.find((item) => item.id === value);
                if (!selected) return;
                setValues((current) => ({
                  ...current,
                  existingDriverId: value,
                  dailyTripsLimit:
                    selected.dailyTripsLimit != null
                      ? String(selected.dailyTripsLimit)
                      : current.dailyTripsLimit,
                }));
              }}
              options={driverOptions}
              placeholder={t("selectDriver")}
            />
          </Field>
          <Field label={t("dailyTripsLimit")} required error={errors.dailyTripsLimit} hint={t("dailyTripsHint")}>
            <SelectInput
              value={values.dailyTripsLimit}
              onChange={(value) => set("dailyTripsLimit", value)}
              options={DAILY_TRIPS_OPTIONS}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label={t("name")} required error={errors.fullName}>
            <TextInput value={values.fullName} onChange={(e) => set("fullName", e.target.value)} invalid={!!errors.fullName} />
          </Field>
          <Field label={t("phone")} required error={errors.phone}>
            <TextInput dir="ltr" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} invalid={!!errors.phone} />
          </Field>
          <Field label={t("email")} required error={errors.email} hint={t("loginHint")}>
            <TextInput dir="ltr" type="email" autoComplete="off" value={values.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
          </Field>
          <Field
            label={t("password")}
            required={!driver}
            error={errors.password}
            hint={driver ? t("passwordKeepHint") : undefined}
          >
            <PasswordInput autoComplete="new-password" value={values.password} onChange={(e) => set("password", e.target.value)} invalid={!!errors.password} />
          </Field>
          <FormGrid>
            <Field label={t("nationalId")}>
              <TextInput value={values.nationalId} onChange={(e) => set("nationalId", e.target.value)} />
            </Field>
            <Field label={t("licenseNumber")}>
              <TextInput value={values.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} />
            </Field>
            <Field label={t("licenseExpiry")} error={errors.licenseExpiry}>
              <AppDatePicker clearable value={values.licenseExpiry} onChange={(value) => set("licenseExpiry", value)} />
            </Field>
            {showDailyTrips ? (
              <Field label={t("dailyTripsLimit")} required error={errors.dailyTripsLimit} hint={t("dailyTripsHint")}>
                <SelectInput
                  value={values.dailyTripsLimit}
                  onChange={(value) => set("dailyTripsLimit", value)}
                  options={DAILY_TRIPS_OPTIONS}
                />
              </Field>
            ) : null}
          </FormGrid>

          <h3 className="pt-1 text-start text-sm font-semibold text-text-primary">
            {linkedVehicle ? t("linkedVehicle") : t("addNewVehicle")}
          </h3>
          <FormGrid>
            <Field label={t("plateNumber")} required error={errors.plateNumber}>
              <TextInput dir="ltr" value={values.plateNumber} onChange={(e) => set("plateNumber", e.target.value)} invalid={!!errors.plateNumber} />
            </Field>
            <Field label={t("vehicleType")}>
              <TextInput value={values.vehicleType} onChange={(e) => set("vehicleType", e.target.value)} />
            </Field>
            <Field label={t("capacity")}>
              <NumberInput min={1} max={80} unit={tCommon("unitSeats")} value={values.capacity} onChange={(value) => set("capacity", value)} />
            </Field>
            <Field label={t("insuranceExpiry")}>
              <AppDatePicker clearable value={values.insuranceExpiry} onChange={(value) => set("insuranceExpiry", value)} />
            </Field>
          </FormGrid>
        </>
      )}
    </Drawer>
  );
}

/* ───────────────────────────── Vehicles ───────────────────────────── */

export function VehiclesView({
  scope,
  institutionId,
  readOnly = false,
}: {
  scope: Scope;
  institutionId?: string;
  readOnly?: boolean;
}) {
  const t = useTranslations("Resources");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const api = vehicleApi[scope];
  const [editing, setEditing] = useState<Vehicle | null | "new">(null);
  const [statusTarget, setStatusTarget] = useState<Vehicle | null>(null);
  const [nextStatus, setNextStatus] = useState<VehicleStatus | "">("");
  const [tripsFor, setTripsFor] = useState<Vehicle | null>(null);
  const statusOptions = useEnumOptions("status", VEHICLE_STATUSES);
  const { filters, setFilter, setPage, query } = useListParams({
    search: undefined as string | undefined,
    status: undefined as string | undefined,
    ownerType: undefined as string | undefined,
    assigned: undefined as string | undefined,
  });
  const listQuery = { ...query, ...(institutionId ? { institutionId } : {}) };

  const list = useQuery({
    queryKey: listKey(scope, "vehicles", listQuery),
    queryFn: () => api.list(listQuery),
    placeholderData: keepPreviousData,
  });

  const setStatus = useApiMutation({
    mutationFn: (input: { id: string; status: VehicleStatus }) => api.status(input.id, input.status),
    invalidate: [listKey(scope, "vehicles"), statsKey("vehicles")],
    onSuccess: () => setStatusTarget(null),
  });

  const editable = (vehicle: Vehicle) =>
    !readOnly && (scope === "admin" || vehicle.ownerType === "INSTITUTION");

  return (
    <PageSection>
      <PageHeader
        icon="vehicle"
        title={scope === "admin" ? t("beroyaVehiclesTitle") : t("vehiclesTitle")}
        subtitle={
          readOnly
            ? t("beroyaAssignedVehiclesSubtitle")
            : scope === "admin"
              ? t("beroyaVehiclesSubtitle")
              : t("vehiclesSubtitle")
        }
        actions={
          readOnly ? null : (
            <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
              <Add size={16} color="currentColor" variant="Linear" />
              {t("addVehicle")}
            </button>
          )
        }
      />
      {api.stats && !readOnly ? <ResourceStatsRow kind="vehicles" load={api.stats} /> : null}
      <Card>
        <Toolbar>
          <SearchInput value={filters.search ?? ""} onChange={(value) => setFilter("search", value || undefined)} placeholder={t("searchVehicles")} />
          <FilterSelect placeholder={t("status")} value={filters.status} onChange={(value) => setFilter("status", value)} options={statusOptions} />
          {scope === "institution" ? (
            <EnumFilterSelect placeholder={t("owner")} value={filters.ownerType} onChange={(value) => setFilter("ownerType", value)} group="ownerType" values={["INSTITUTION", "BEROYA", "DRIVER"]} />
          ) : (
            <EnumFilterSelect placeholder={t("owner")} value={filters.ownerType} onChange={(value) => setFilter("ownerType", value)} group="ownerType" values={[...FLEET_OWNER_TYPES]} />
          )}
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
          emptyTitle={t("noVehicles")}
          minWidth={980}
          columns={[
            { key: "plate", header: t("plateNumber"), cell: (row) => <span className="cell-strong" dir="ltr">{row.plateNumber}</span> },
            { key: "owner", header: t("owner"), cell: (row: Vehicle) => <OwnerChip owner={row.ownerType} /> },
            {
              key: "driver",
              header: t("linkedDriver"),
              cell: (row) =>
                row.ownerDriver ? (
                  <span className="cell-strong">{row.ownerDriver.fullName}</span>
                ) : (
                  <span className="text-text-muted">—</span>
                ),
            },
            { key: "type", header: t("vehicleType"), cell: (row) => row.vehicleType ?? "—" },
            { key: "capacity", header: t("capacity"), cell: (row) => row.capacity ?? "—" },
            { key: "license", header: t("licenseExpiry"), cell: (row) => formatDate(row.licenseExpiry, locale) },
            { key: "insurance", header: t("insuranceExpiry"), cell: (row) => formatDate(row.insuranceExpiry, locale) },
            {
              key: "routes",
              header: t("assignedRoutes"),
              cell: (row) =>
                row.assignedRoutes.length ? (
                  <div className="flex flex-wrap gap-1">
                    {row.assignedRoutes.map((route) => (
                      <Chip key={route.id} tone={route.needsReassignment ? "warning" : "muted"}>
                        {route.name}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <span className="text-text-muted">{t("unassigned")}</span>
                ),
            },
            { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
            ...(readOnly
              ? []
              : [
                  {
                    key: "actions",
                    header: t("actions"),
                    cell: (row: Vehicle) => (
                      <div className="flex items-center gap-1">
                        {api.trips ? (
                          <button type="button" className="icon-btn" title={t("trips")} onClick={() => setTripsFor(row)}>
                            <Car size={16} color="currentColor" variant="Linear" />
                          </button>
                        ) : null}
                        {editable(row) ? (
                          <>
                            <button type="button" className="icon-btn" title={t("edit")} onClick={() => setEditing(row)}>
                              <Edit size={16} color="currentColor" variant="Linear" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setNextStatus(row.status);
                                setStatusTarget(row);
                              }}
                            >
                              {t("changeStatus")}
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-text-muted">{t("beroyaReadOnly")}</span>
                        )}
                      </div>
                    ),
                  },
                ]),
          ]}
        />
      </Card>

      {!readOnly ? (
        <VehicleDrawer
          scope={scope}
          institutionId={institutionId}
          vehicle={editing === "new" ? null : editing}
          open={editing !== null}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={t("changeStatus")}
        subtitle={statusTarget?.plateNumber}
        onSubmit={(event) => {
          event.preventDefault();
          if (statusTarget && nextStatus) setStatus.mutate({ id: statusTarget.id, status: nextStatus });
        }}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setStatusTarget(null)}>
              {tCommon("cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={setStatus.isPending || !nextStatus || nextStatus === statusTarget?.status}>
              {setStatus.isPending ? tCommon("saving") : tCommon("save")}
            </button>
          </>
        }
      >
        <Field label={t("status")} required>
          <SelectInput value={nextStatus} onChange={(value) => setNextStatus(value as VehicleStatus)} options={statusOptions} />
        </Field>
      </Modal>

      {api.trips ? (
        <TripsModal
          title={tripsFor?.plateNumber ?? ""}
          open={Boolean(tripsFor)}
          onClose={() => setTripsFor(null)}
          queryKey={tripsFor ? [...listKey(scope, "vehicles"), tripsFor.id, "trips"] : ["noop"]}
          load={tripsFor && api.trips ? () => api.trips!(tripsFor.id) as Promise<Paginated<ResourceTrip>> : null}
        />
      ) : null}
    </PageSection>
  );
}

const vehicleSchema = z.object({
  plateNumber: v.required(3),
  vehicleType: v.optionalText(),
  capacity: v.optionalInt(1, 80),
  licenseExpiry: v.optionalDate(),
  insuranceExpiry: v.optionalDate(),
});

function VehicleDrawer({
  scope,
  institutionId,
  vehicle,
  open,
  onClose,
}: {
  scope: Scope;
  institutionId?: string;
  vehicle: Vehicle | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Resources");
  const tCommon = useTranslations("Common");
  const api = vehicleApi[scope];
  const showOwnership = scope === "admin";
  // Picker must load the full Beroya driver pool (not only drivers already linked to this institution).
  const driverList = useQuery({
    queryKey: listKey(scope, "drivers", { limit: 100, picker: "1" }),
    queryFn: () => driverApi[scope].list({ limit: 100 }),
    enabled: open,
  });
  const ownershipOptions = useEnumOptions("ownerType", FLEET_OWNER_TYPES);
  const initial = {
    plateNumber: vehicle?.plateNumber ?? "",
    vehicleType: vehicle?.vehicleType ?? "",
    capacity: vehicle?.capacity != null ? String(vehicle.capacity) : "",
    licenseExpiry: isoToDateInput(vehicle?.licenseExpiry),
    insuranceExpiry: isoToDateInput(vehicle?.insuranceExpiry),
    ownerType: (vehicle?.ownerType === "DRIVER" ? "DRIVER" : "BEROYA") as FleetOwnerType,
    driverMode: "existing" as "existing" | "new",
    driverId: vehicle?.ownerDriverId ?? "",
    fullName: "",
    phone: "",
    email: "",
    password: "",
    nationalId: "",
    licenseNumber: "",
  };
  const form = useFormState(initial);
  useResetOnKey(open ? (vehicle?.id ?? "new") : null, form.reset, initial);
  const { values, set, setValues, errors } = form;
  const needsDriver = showOwnership && values.ownerType === "DRIVER";

  useEffect(() => {
    if (!open || !vehicle?.ownerDriverId || values.ownerType !== "DRIVER") return;
    const selected = driverList.data?.data.find((item) => item.id === vehicle.ownerDriverId);
    if (!selected) return;
    setValues((current) => ({
      ...current,
      driverId: selected.id,
      fullName: selected.user?.fullName ?? vehicle.ownerDriver?.fullName ?? "",
      phone: selected.user?.phone ?? vehicle.ownerDriver?.phone ?? "",
      email: selected.user?.email ?? vehicle.ownerDriver?.email ?? "",
      nationalId: selected.nationalId ?? "",
      licenseNumber: selected.licenseNumber ?? "",
    }));
    // Only hydrate when the drawer opens for a driver-owned vehicle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle?.id, driverList.data]);

  const save = useApiMutation({
    mutationFn: (input: VehicleInput) => (vehicle ? api.update(vehicle.id, input) : api.create(input)),
    invalidate: [listKey(scope, "vehicles"), listKey(scope, "drivers"), statsKey("vehicles"), statsKey("drivers")],
    onError: form.captureServerError,
    onSuccess: onClose,
  });

  const driverOptions = (driverList.data?.data ?? []).map((item) => ({
    value: item.id,
    label: `${item.user?.fullName ?? "—"} (${item.user?.phone ?? ""})`,
  }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={vehicle ? t("editVehicle") : t("addVehicle")}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(vehicleSchema);
        if (!data) return;
        const payload: VehicleInput = {
          ...data,
          ...(institutionId ? { institutionId } : {}),
        };
        if (showOwnership) {
          payload.ownerType = values.ownerType;
          if (needsDriver) {
            if (values.driverMode === "new") {
              const nested = z
                .object({
                  fullName: v.name(),
                  phone: v.phone(),
                  email: v.email(),
                  password: v.password(),
                  nationalId: v.optionalText(),
                  licenseNumber: v.optionalText(),
                })
                .safeParse(values);
              if (!nested.success) {
                const next: Record<string, string> = {};
                for (const issue of nested.error.issues) {
                  const key = String(issue.path[0] ?? "");
                  if (key && !next[key]) next[key] = issue.message;
                }
                form.setErrors((current) => ({ ...current, ...next }));
                return;
              }
              payload.newDriver = nested.data;
            } else if (!values.driverId) {
              form.setErrors((current) => ({ ...current, driverId: "required" }));
              return;
            } else {
              payload.driverId = values.driverId;
            }
          } else {
            payload.driverId = null;
          }
        }
        save.mutate(payload);
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
      {showOwnership ? (
        <Field label={t("ownership")} required hint={t("ownershipHint")}>
          <SelectInput
            value={values.ownerType}
            onChange={(value) => set("ownerType", value as FleetOwnerType)}
            options={ownershipOptions}
          />
        </Field>
      ) : null}
      <FormGrid>
        <Field label={t("plateNumber")} required error={errors.plateNumber}>
          <TextInput dir="ltr" value={values.plateNumber} onChange={(e) => set("plateNumber", e.target.value)} invalid={!!errors.plateNumber} />
        </Field>
        <Field label={t("vehicleType")}>
          <TextInput value={values.vehicleType} onChange={(e) => set("vehicleType", e.target.value)} />
        </Field>
        <Field label={t("capacity")} error={errors.capacity} hint={t("capacityHint")}>
          <NumberInput min={1} max={80} unit={tCommon("unitSeats")} value={values.capacity} onChange={(value) => set("capacity", value)} invalid={!!errors.capacity} />
        </Field>
        <Field label={t("licenseExpiry")} error={errors.licenseExpiry}>
          <AppDatePicker clearable value={values.licenseExpiry} invalid={!!errors.licenseExpiry} onChange={(value) => set("licenseExpiry", value)} />
        </Field>
        <Field label={t("insuranceExpiry")} error={errors.insuranceExpiry}>
          <AppDatePicker clearable value={values.insuranceExpiry} invalid={!!errors.insuranceExpiry} onChange={(value) => set("insuranceExpiry", value)} />
        </Field>
      </FormGrid>

      {needsDriver ? (
        <>
          <Field label={t("linkedDriver")} required error={errors.driverId}>
            <SelectInput
              value={values.driverMode}
              onChange={(value) => set("driverMode", value as "existing" | "new")}
              options={[
                { value: "existing", label: t("useExistingDriver") },
                { value: "new", label: t("addNewDriver") },
              ]}
            />
          </Field>
          {values.driverMode === "existing" ? (
            <>
              <Field label={t("selectDriver")} required error={errors.driverId}>
                <SelectInput
                  value={values.driverId}
                  onChange={(value) => {
                    set("driverId", value);
                    const selected = driverList.data?.data.find((item) => item.id === value);
                    if (!selected) return;
                    setValues((current) => ({
                      ...current,
                      driverId: value,
                      fullName: selected.user?.fullName ?? "",
                      phone: selected.user?.phone ?? "",
                      email: selected.user?.email ?? "",
                      nationalId: selected.nationalId ?? "",
                      licenseNumber: selected.licenseNumber ?? "",
                    }));
                  }}
                  options={driverOptions}
                  placeholder={t("selectDriver")}
                />
              </Field>
              {values.driverId ? (
                <FormGrid>
                  <Field label={t("name")}>
                    <TextInput value={values.fullName} readOnly />
                  </Field>
                  <Field label={t("phone")}>
                    <TextInput dir="ltr" value={values.phone} readOnly />
                  </Field>
                  <Field label={t("nationalId")}>
                    <TextInput value={values.nationalId} readOnly />
                  </Field>
                  <Field label={t("licenseNumber")}>
                    <TextInput value={values.licenseNumber} readOnly />
                  </Field>
                </FormGrid>
              ) : null}
            </>
          ) : (
            <>
              <Field label={t("name")} required error={errors.fullName}>
                <TextInput value={values.fullName} onChange={(e) => set("fullName", e.target.value)} invalid={!!errors.fullName} />
              </Field>
              <Field label={t("phone")} required error={errors.phone}>
                <TextInput dir="ltr" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} invalid={!!errors.phone} />
              </Field>
              <Field label={t("email")} required error={errors.email} hint={t("loginHint")}>
                <TextInput dir="ltr" type="email" autoComplete="off" value={values.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
              </Field>
              <Field label={t("password")} required error={errors.password}>
                <PasswordInput autoComplete="new-password" value={values.password} onChange={(e) => set("password", e.target.value)} invalid={!!errors.password} />
              </Field>
              <FormGrid>
                <Field label={t("nationalId")}>
                  <TextInput value={values.nationalId} onChange={(e) => set("nationalId", e.target.value)} />
                </Field>
                <Field label={t("licenseNumber")}>
                  <TextInput value={values.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} />
                </Field>
              </FormGrid>
            </>
          )}
        </>
      ) : null}
    </Drawer>
  );
}

/* ───────────────────────────── Trips modal ───────────────────────────── */

function TripsModal({
  title,
  open,
  onClose,
  queryKey,
  load,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  queryKey: readonly unknown[];
  load: (() => Promise<Paginated<ResourceTrip>>) | null;
}) {
  const t = useTranslations("Resources");
  const locale = useLocale();
  const directionLabel = useEnumLabel("direction");
  const trips = useQuery({ queryKey, queryFn: () => load!(), enabled: open && Boolean(load) });

  return (
    <Modal open={open} onClose={onClose} title={t("tripsOf", { name: title })}>
      <DataTable
        minWidth={420}
        rows={trips.data?.data}
        isLoading={trips.isPending}
        error={trips.error}
        rowKey={(row) => row.id}
        emptyTitle={t("noTrips")}
        columns={[
          { key: "date", header: t("date"), cell: (row) => formatServiceDate(row.serviceDate, locale) },
          { key: "time", header: t("time"), cell: (row) => <span dir="ltr">{row.scheduledDepartureTime}</span> },
          { key: "direction", header: t("direction"), cell: (row) => directionLabel(row.direction) },
          { key: "route", header: t("route"), cell: (row) => row.route?.name ?? "—" },
          { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} /> },
        ]}
      />
    </Modal>
  );
}
