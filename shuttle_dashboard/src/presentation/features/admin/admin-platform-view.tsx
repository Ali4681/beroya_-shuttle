"use client";

import { Edit } from "iconsax-react-v2";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import type { AppRelease, LocalizedCopy, PlatformSettings, StoreRelease } from "@/domain/models/entities";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { Field, NumberInput, TextArea, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { Modal } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { PageSection } from "@/presentation/components/ui/panel";
import { QueryBoundary } from "@/presentation/components/ui/states";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState } from "@/presentation/hooks/use-form-state";
import { v } from "@/shared/lib/validation";

type AppKey = keyof PlatformSettings["apps"];
type FieldKey =
  | "iosMinVersion"
  | "iosLatestVersion"
  | "androidMinVersion"
  | "androidLatestVersion"
  | "iosUrl"
  | "androidUrl"
  | "forceMessage";

const APP_KEYS: AppKey[] = ["driver", "attendant", "parent", "university"];
const FIELD_KEYS: FieldKey[] = [
  "iosMinVersion",
  "iosLatestVersion",
  "iosUrl",
  "androidMinVersion",
  "androidLatestVersion",
  "androidUrl",
  "forceMessage",
];

const versionSchema = z.string().trim().regex(/^\d+\.\d+\.\d+$/, "version");
const optionalUrl = z
  .string()
  .trim()
  .refine((value) => !value || /^https?:\/\//i.test(value), "url")
  .transform((value) => value || null);

const trackingSchema = z.object({
  locationPingIntervalSeconds: v.int(5, 120),
  gpsStaleAfterSeconds: v.int(15, 600),
});

function withPlatformDefaults(settings: PlatformSettings): PlatformSettings {
  const emptyCopy = { titleAr: "", bodyAr: "", titleEn: "", bodyEn: "" };
  return {
    ...settings,
    supportWhatsappUrl: settings.supportWhatsappUrl ?? null,
    maintenance: settings.maintenance ?? { apps: false, dashboard: false, messageAr: null, messageEn: null },
    announcement: {
      enabled: settings.announcement?.enabled ?? false,
      titleAr: settings.announcement?.titleAr ?? "",
      bodyAr: settings.announcement?.bodyAr ?? "",
      titleEn: settings.announcement?.titleEn ?? "",
      bodyEn: settings.announcement?.bodyEn ?? "",
    },
    fcm: {
      parents: settings.fcm?.parents ?? true,
      university: settings.fcm?.university ?? true,
      drivers: settings.fcm?.drivers ?? true,
      attendants: settings.fcm?.attendants ?? true,
      admins: settings.fcm?.admins ?? true,
    },
    templates: {
      delay: { ...emptyCopy, ...settings.templates?.delay },
      emergency: { ...emptyCopy, ...settings.templates?.emergency },
      arrivalSoon: { ...emptyCopy, ...settings.templates?.arrivalSoon },
    },
  };
}

function flattenApp(prefix: AppKey, app: AppRelease) {
  return {
    [`${prefix}IosMinVersion`]: app.ios.minVersion,
    [`${prefix}IosLatestVersion`]: app.ios.latestVersion,
    [`${prefix}IosUrl`]: app.ios.storeUrl,
    [`${prefix}AndroidMinVersion`]: app.android.minVersion,
    [`${prefix}AndroidLatestVersion`]: app.android.latestVersion,
    [`${prefix}AndroidUrl`]: app.android.storeUrl,
    [`${prefix}ForceMessage`]: app.forceMessage,
  };
}

function flattenCopy(prefix: string, copy: LocalizedCopy) {
  return {
    [`${prefix}TitleAr`]: copy.titleAr,
    [`${prefix}BodyAr`]: copy.bodyAr,
    [`${prefix}TitleEn`]: copy.titleEn,
    [`${prefix}BodyEn`]: copy.bodyEn,
  };
}

function flattenUpdate(settings: PlatformSettings, patch: Partial<PlatformSettings> & Record<string, unknown>) {
  const nextApps = { ...settings.apps, ...(patch.apps ?? {}) };
  const maintenance = { ...settings.maintenance, ...(patch.maintenance ?? {}) };
  const announcement = { ...settings.announcement, ...(patch.announcement ?? {}) };
  const fcm = { ...settings.fcm, ...(patch.fcm ?? {}) };
  const templates = {
    delay: { ...settings.templates.delay, ...(patch.templates?.delay ?? {}) },
    emergency: { ...settings.templates.emergency, ...(patch.templates?.emergency ?? {}) },
    arrivalSoon: { ...settings.templates.arrivalSoon, ...(patch.templates?.arrivalSoon ?? {}) },
  };
  return {
    supportPhone: patch.supportPhone !== undefined ? patch.supportPhone : settings.supportPhone,
    supportWhatsappUrl: patch.supportWhatsappUrl !== undefined ? patch.supportWhatsappUrl : settings.supportWhatsappUrl,
    gpsStaleAfterSeconds: patch.gpsStaleAfterSeconds ?? settings.gpsStaleAfterSeconds,
    locationPingIntervalSeconds: patch.locationPingIntervalSeconds ?? settings.locationPingIntervalSeconds,
    maintenanceApps: maintenance.apps,
    maintenanceDashboard: maintenance.dashboard,
    maintenanceMessageAr: maintenance.messageAr,
    maintenanceMessageEn: maintenance.messageEn,
    announcementEnabled: announcement.enabled,
    ...flattenCopy("announcement", announcement),
    fcmParents: fcm.parents,
    fcmUniversity: fcm.university,
    fcmDrivers: fcm.drivers,
    fcmAttendants: fcm.attendants,
    fcmAdmins: fcm.admins,
    ...flattenCopy("templateDelay", templates.delay),
    ...flattenCopy("templateEmergency", templates.emergency),
    ...flattenCopy("templateArrival", templates.arrivalSoon),
    ...flattenApp("driver", nextApps.driver),
    ...flattenApp("attendant", nextApps.attendant),
    ...flattenApp("parent", nextApps.parent),
    ...flattenApp("university", nextApps.university),
  };
}

function fieldValue(release: AppRelease, field: FieldKey): string | null {
  switch (field) {
    case "iosMinVersion":
      return release.ios.minVersion;
    case "iosLatestVersion":
      return release.ios.latestVersion;
    case "iosUrl":
      return release.ios.storeUrl;
    case "androidMinVersion":
      return release.android.minVersion;
    case "androidLatestVersion":
      return release.android.latestVersion;
    case "androidUrl":
      return release.android.storeUrl;
    case "forceMessage":
      return release.forceMessage;
  }
}

function patchRelease(release: AppRelease, field: FieldKey, value: string): AppRelease {
  const store = (current: StoreRelease, next: Partial<StoreRelease>): StoreRelease => ({ ...current, ...next });
  if (field === "iosMinVersion") return { ...release, ios: store(release.ios, { minVersion: value }) };
  if (field === "iosLatestVersion") return { ...release, ios: store(release.ios, { latestVersion: value }) };
  if (field === "iosUrl") return { ...release, ios: store(release.ios, { storeUrl: value || null }) };
  if (field === "androidMinVersion") return { ...release, android: store(release.android, { minVersion: value }) };
  if (field === "androidLatestVersion") return { ...release, android: store(release.android, { latestVersion: value }) };
  if (field === "androidUrl") return { ...release, android: store(release.android, { storeUrl: value || null }) };
  return { ...release, forceMessage: value || null };
}

export function AdminPlatformView() {
  const t = useTranslations("PlatformSettings");
  const query = useQuery({
    queryKey: qk.admin.platformSettings,
    queryFn: adminApi.platformSettings,
  });

  return (
    <PageSection>
      <PageHeader icon="platform" title={t("title")} subtitle={t("subtitle")} />
      <QueryBoundary query={query}>{(data) => <PlatformForm settings={withPlatformDefaults(data)} />}</QueryBoundary>
    </PageSection>
  );
}

function PlatformForm({ settings }: { settings: PlatformSettings }) {
  const t = useTranslations("PlatformSettings");
  const tCommon = useTranslations("Common");
  const [editor, setEditor] = useState<string | null>(null);
  const save = useApiMutation({
    mutationFn: (body: ReturnType<typeof flattenUpdate>) => adminApi.updatePlatformSettings(body),
    invalidate: [qk.admin.platformSettings, qk.public.appConfig, qk.public.supportContact],
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-start text-lg font-semibold text-text-primary">{t("opsTitle")}</h2>
        <p className="text-start text-sm text-text-secondary">{t("opsHint")}</p>
        <ul className="settings-stack">
          <SettingRow title={t("supportPhone")} description={t("supportPhoneHint")} value={settings.supportPhone} onEdit={() => setEditor("supportPhone")} />
          <SettingRow title={t("supportUrl")} description={t("supportUrlHint")} value={settings.supportWhatsappUrl} onEdit={() => setEditor("supportUrl")} />
          <ToggleRow title={t("maintenanceApps")} description={t("maintenanceAppsHint")} on={settings.maintenance.apps} saving={save.isPending} onChange={(apps) => save.mutate(flattenUpdate(settings, { maintenance: { ...settings.maintenance, apps } }))} />
          <ToggleRow title={t("maintenanceDashboard")} description={t("maintenanceDashboardHint")} on={settings.maintenance.dashboard} saving={save.isPending} onChange={(dashboard) => save.mutate(flattenUpdate(settings, { maintenance: { ...settings.maintenance, dashboard } }))} />
          <SettingRow title={t("maintenanceMessageAr")} description={t("maintenanceMessageArHint")} value={settings.maintenance.messageAr} onEdit={() => setEditor("maintAr")} />
          <SettingRow title={t("maintenanceMessageEn")} description={t("maintenanceMessageEnHint")} value={settings.maintenance.messageEn} onEdit={() => setEditor("maintEn")} />
          <ToggleRow title={t("announcementEnabled")} description={t("announcementEnabledHint")} on={settings.announcement.enabled} saving={save.isPending} onChange={(enabled) => save.mutate(flattenUpdate(settings, { announcement: { ...settings.announcement, enabled } }))} />
          <SettingRow title={t("announcementCopy")} description={t("announcementCopyHint")} value={settings.announcement.titleAr || settings.announcement.titleEn} onEdit={() => setEditor("announcement")} />
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-start text-lg font-semibold text-text-primary">{t("trackingTitle")}</h2>
        <p className="text-start text-sm text-text-secondary">{t("trackingHint")}</p>
        <ul className="settings-stack">
          <SettingRow
            title={t("pingInterval")}
            description={t("pingIntervalHint")}
            value={`${settings.locationPingIntervalSeconds} ${tCommon("unitSeconds")}`}
            onEdit={() => setEditor("ping")}
          />
          <SettingRow
            title={t("gpsStale")}
            description={t("gpsStaleHint")}
            value={`${settings.gpsStaleAfterSeconds} ${tCommon("unitSeconds")}`}
            onEdit={() => setEditor("stale")}
          />
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-start text-lg font-semibold text-text-primary">{t("appsTitle")}</h2>
        <p className="text-start text-sm text-text-secondary">{t("appsHint")}</p>
        {APP_KEYS.map((app) => (
          <div key={app} className="flex flex-col gap-2">
            <h3 className="text-start text-base font-semibold text-text-primary">{t(`apps.${app}`)}</h3>
            <AppRows app={app} release={settings.apps[app]} onEdit={setEditor} />
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-start text-lg font-semibold text-text-primary">{t("notifyTitle")}</h2>
        <p className="text-start text-sm text-text-secondary">{t("notifyHint")}</p>
        <ul className="settings-stack">
          <ToggleRow title={t("fcmParents")} description={t("fcmParentsHint")} on={settings.fcm.parents} saving={save.isPending} onChange={(parents) => save.mutate(flattenUpdate(settings, { fcm: { ...settings.fcm, parents } }))} />
          <ToggleRow title={t("fcmUniversity")} description={t("fcmUniversityHint")} on={settings.fcm.university} saving={save.isPending} onChange={(university) => save.mutate(flattenUpdate(settings, { fcm: { ...settings.fcm, university } }))} />
          <ToggleRow title={t("fcmDrivers")} description={t("fcmDriversHint")} on={settings.fcm.drivers} saving={save.isPending} onChange={(drivers) => save.mutate(flattenUpdate(settings, { fcm: { ...settings.fcm, drivers } }))} />
          <ToggleRow title={t("fcmAttendants")} description={t("fcmAttendantsHint")} on={settings.fcm.attendants} saving={save.isPending} onChange={(attendants) => save.mutate(flattenUpdate(settings, { fcm: { ...settings.fcm, attendants } }))} />
          <ToggleRow title={t("fcmAdmins")} description={t("fcmAdminsHint")} on={settings.fcm.admins} saving={save.isPending} onChange={(admins) => save.mutate(flattenUpdate(settings, { fcm: { ...settings.fcm, admins } }))} />
          <SettingRow title={t("templateDelay")} description={t("templateDelayHint")} value={settings.templates.delay.titleAr} onEdit={() => setEditor("tplDelay")} />
          <SettingRow title={t("templateEmergency")} description={t("templateEmergencyHint")} value={settings.templates.emergency.titleAr} onEdit={() => setEditor("tplEmergency")} />
          <SettingRow title={t("templateArrival")} description={t("templateArrivalHint")} value={settings.templates.arrivalSoon.titleAr} onEdit={() => setEditor("tplArrival")} />
        </ul>
      </section>

      {editor === "ping" ? (
        <NumberEditor
          title={t("pingInterval")}
          hint={t("secondsRange", { min: 5, max: 120 })}
          value={String(settings.locationPingIntervalSeconds)}
          min={5}
          max={120}
          unit={tCommon("unitSeconds")}
          schema={trackingSchema.pick({ locationPingIntervalSeconds: true })}
          field="locationPingIntervalSeconds"
          onClose={() => setEditor(null)}
          saving={save.isPending}
          onSave={async (locationPingIntervalSeconds) => {
            await save.mutateAsync(flattenUpdate(settings, { locationPingIntervalSeconds }));
            setEditor(null);
          }}
        />
      ) : null}
      {editor === "stale" ? (
        <NumberEditor
          title={t("gpsStale")}
          hint={t("secondsRange", { min: 15, max: 600 })}
          value={String(settings.gpsStaleAfterSeconds)}
          min={15}
          max={600}
          step={5}
          unit={tCommon("unitSeconds")}
          schema={trackingSchema.pick({ gpsStaleAfterSeconds: true })}
          field="gpsStaleAfterSeconds"
          onClose={() => setEditor(null)}
          saving={save.isPending}
          onSave={async (gpsStaleAfterSeconds) => {
            await save.mutateAsync(flattenUpdate(settings, { gpsStaleAfterSeconds }));
            setEditor(null);
          }}
        />
      ) : null}
      {editor === "supportPhone" ? (
        <TextEditor
          title={t("supportPhone")}
          value={settings.supportPhone ?? ""}
          schema={z.object({ value: v.optionalPhone() })}
          onClose={() => setEditor(null)}
          saving={save.isPending}
          phone
          onSave={async (value) => {
            await save.mutateAsync(flattenUpdate(settings, { supportPhone: value ?? null }));
            setEditor(null);
          }}
        />
      ) : null}
      {editor === "supportUrl" ? (
        <TextEditor
          title={t("supportUrl")}
          value={settings.supportWhatsappUrl ?? ""}
          schema={z.object({ value: optionalUrl })}
          onClose={() => setEditor(null)}
          saving={save.isPending}
          onSave={async (value) => {
            await save.mutateAsync(flattenUpdate(settings, { supportWhatsappUrl: value ?? null }));
            setEditor(null);
          }}
        />
      ) : null}
      {editor === "maintAr" ? (
        <TextEditor
          title={t("maintenanceMessageAr")}
          value={settings.maintenance.messageAr ?? ""}
          schema={z.object({ value: z.string().trim().max(500, "max500").transform((item) => item || null) })}
          area
          onClose={() => setEditor(null)}
          saving={save.isPending}
          onSave={async (value) => {
            await save.mutateAsync(flattenUpdate(settings, { maintenance: { ...settings.maintenance, messageAr: value } }));
            setEditor(null);
          }}
        />
      ) : null}
      {editor === "maintEn" ? (
        <TextEditor
          title={t("maintenanceMessageEn")}
          value={settings.maintenance.messageEn ?? ""}
          schema={z.object({ value: z.string().trim().max(500, "max500").transform((item) => item || null) })}
          area
          onClose={() => setEditor(null)}
          saving={save.isPending}
          onSave={async (value) => {
            await save.mutateAsync(flattenUpdate(settings, { maintenance: { ...settings.maintenance, messageEn: value } }));
            setEditor(null);
          }}
        />
      ) : null}
      {editor === "announcement" ? (
        <CopyEditor
          title={t("announcementCopy")}
          copy={settings.announcement}
          onClose={() => setEditor(null)}
          saving={save.isPending}
          onSave={async (copy) => {
            await save.mutateAsync(flattenUpdate(settings, { announcement: { ...settings.announcement, ...copy } }));
            setEditor(null);
          }}
        />
      ) : null}
      {editor === "tplDelay" ? (
        <CopyEditor
          title={t("templateDelay")}
          copy={settings.templates.delay}
          hint={t("templateVarsHint")}
          onClose={() => setEditor(null)}
          saving={save.isPending}
          onSave={async (copy) => {
            await save.mutateAsync(flattenUpdate(settings, { templates: { ...settings.templates, delay: copy } }));
            setEditor(null);
          }}
        />
      ) : null}
      {editor === "tplEmergency" ? (
        <CopyEditor
          title={t("templateEmergency")}
          copy={settings.templates.emergency}
          onClose={() => setEditor(null)}
          saving={save.isPending}
          onSave={async (copy) => {
            await save.mutateAsync(flattenUpdate(settings, { templates: { ...settings.templates, emergency: copy } }));
            setEditor(null);
          }}
        />
      ) : null}
      {editor === "tplArrival" ? (
        <CopyEditor
          title={t("templateArrival")}
          copy={settings.templates.arrivalSoon}
          hint={t("templateVarsHint")}
          onClose={() => setEditor(null)}
          saving={save.isPending}
          onSave={async (copy) => {
            await save.mutateAsync(flattenUpdate(settings, { templates: { ...settings.templates, arrivalSoon: copy } }));
            setEditor(null);
          }}
        />
      ) : null}
      {APP_KEYS.map((app) =>
        editor?.startsWith(`${app}:`) ? (
          <ReleaseEditor
            key={editor}
            app={app}
            field={editor.slice(app.length + 1) as FieldKey}
            release={settings.apps[app]}
            onClose={() => setEditor(null)}
            saving={save.isPending}
            onSave={async (next) => {
              await save.mutateAsync(flattenUpdate(settings, { apps: { ...settings.apps, [app]: next } }));
              setEditor(null);
            }}
          />
        ) : null,
      )}
    </div>
  );
}

function AppRows({
  app,
  release,
  onEdit,
}: {
  app: AppKey;
  release: AppRelease;
  onEdit: (id: string) => void;
}) {
  const t = useTranslations("PlatformSettings");
  return (
    <ul className="settings-stack">
      {FIELD_KEYS.map((field) => (
        <SettingRow
          key={field}
          title={t(field)}
          description={t(`${field}Hint`)}
          value={fieldValue(release, field)}
          onEdit={() => onEdit(`${app}:${field}`)}
        />
      ))}
    </ul>
  );
}

function SettingRow({
  title,
  description,
  value,
  onEdit,
}: {
  title: string;
  description: string;
  value: string | number | null;
  onEdit: () => void;
}) {
  const t = useTranslations("PlatformSettings");
  return (
    <li className="settings-row">
      <div className="min-w-0 text-start">
        <p className="font-semibold text-text-primary">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span dir="ltr" className="max-w-[220px] truncate text-sm font-medium text-text-muted">
          {value || t("notSet")}
        </span>
        <button type="button" className="settings-edit" onClick={onEdit} aria-label={t("edit")}>
          <Edit size={16} color="currentColor" variant="Linear" />
        </button>
      </div>
    </li>
  );
}

function ToggleRow({
  title,
  description,
  on,
  saving,
  onChange,
}: {
  title: string;
  description: string;
  on: boolean;
  saving: boolean;
  onChange: (next: boolean) => void;
}) {
  const t = useTranslations("PlatformSettings");
  return (
    <li className="settings-row">
      <div className="min-w-0 text-start">
        <p className="font-semibold text-text-primary">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
      <button type="button" className="settings-edit min-w-16" disabled={saving} onClick={() => onChange(!on)}>
        <span className={on ? "text-sm font-semibold text-accent" : "text-sm font-medium text-text-muted"}>{on ? t("on") : t("off")}</span>
      </button>
    </li>
  );
}

function TextEditor({
  title,
  value,
  schema,
  area,
  phone,
  onClose,
  saving,
  onSave,
}: {
  title: string;
  value: string;
  schema: z.ZodType<{ value: string | null | undefined }>;
  area?: boolean;
  phone?: boolean;
  onClose: () => void;
  saving: boolean;
  onSave: (value: string | null) => void | Promise<void>;
}) {
  const tCommon = useTranslations("Common");
  const form = useFormState({ value });
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(schema);
        if (data) onSave(data.value ?? null);
      }}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {tCommon("cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? tCommon("saving") : tCommon("save")}
          </button>
        </>
      }
    >
      <ValidationList errors={form.serverErrors} />
      <Field label={title} error={form.errors.value}>
        {area ? (
          <TextArea rows={4} value={form.values.value} onChange={(event) => form.set("value", event.target.value)} />
        ) : (
          <TextInput
            dir="ltr"
            type={phone ? "tel" : "text"}
            value={form.values.value}
            onChange={(event) => form.set("value", event.target.value)}
          />
        )}
      </Field>
    </Modal>
  );
}

const copySchema = z.object({
  titleAr: z.string().trim().max(120, "max120"),
  bodyAr: z.string().trim().max(1000, "max1000"),
  titleEn: z.string().trim().max(120, "max120"),
  bodyEn: z.string().trim().max(1000, "max1000"),
});

function CopyEditor({
  title,
  copy,
  hint,
  onClose,
  saving,
  onSave,
}: {
  title: string;
  copy: LocalizedCopy;
  hint?: string;
  onClose: () => void;
  saving: boolean;
  onSave: (copy: LocalizedCopy) => void | Promise<void>;
}) {
  const t = useTranslations("PlatformSettings");
  const tCommon = useTranslations("Common");
  const form = useFormState({ ...copy });
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(copySchema);
        if (data) onSave(data);
      }}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {tCommon("cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? tCommon("saving") : tCommon("save")}
          </button>
        </>
      }
    >
      <ValidationList errors={form.serverErrors} />
      {hint ? <p className="text-start text-sm text-text-secondary">{hint}</p> : null}
      <Field label={t("titleAr")} error={form.errors.titleAr}>
        <TextInput value={form.values.titleAr} onChange={(event) => form.set("titleAr", event.target.value)} />
      </Field>
      <Field label={t("bodyAr")} error={form.errors.bodyAr}>
        <TextArea rows={3} value={form.values.bodyAr} onChange={(event) => form.set("bodyAr", event.target.value)} />
      </Field>
      <Field label={t("titleEn")} error={form.errors.titleEn}>
        <TextInput dir="ltr" value={form.values.titleEn} onChange={(event) => form.set("titleEn", event.target.value)} />
      </Field>
      <Field label={t("bodyEn")} error={form.errors.bodyEn}>
        <TextArea rows={3} dir="ltr" value={form.values.bodyEn} onChange={(event) => form.set("bodyEn", event.target.value)} />
      </Field>
    </Modal>
  );
}

function NumberEditor({
  title,
  hint,
  value,
  min,
  max,
  step,
  unit,
  schema,
  field,
  onClose,
  saving,
  onSave,
}: {
  title: string;
  hint: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  unit: string;
  schema: z.ZodType<Record<string, number>>;
  field: "locationPingIntervalSeconds" | "gpsStaleAfterSeconds";
  onClose: () => void;
  saving: boolean;
  onSave: (value: number) => void | Promise<void>;
}) {
  const tCommon = useTranslations("Common");
  const form = useFormState({ [field]: value } as Record<string, string>);
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(schema);
        if (data) {
          onSave(data[field]);
        }
      }}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {tCommon("cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? tCommon("saving") : tCommon("save")}
          </button>
        </>
      }
    >
      <Field label={title} hint={hint} error={form.errors[field]}>
        <NumberInput min={min} max={max} step={step} unit={unit} value={String(form.values[field] ?? "")} onChange={(next) => form.set(field, next)} invalid={!!form.errors[field]} />
      </Field>
    </Modal>
  );
}

function ReleaseEditor({
  app,
  field,
  release,
  onClose,
  saving,
  onSave,
}: {
  app: AppKey;
  field: FieldKey;
  release: AppRelease;
  onClose: () => void;
  saving: boolean;
  onSave: (release: AppRelease) => void | Promise<void>;
}) {
  const t = useTranslations("PlatformSettings");
  const tCommon = useTranslations("Common");
  const form = useFormState({ value: fieldValue(release, field) ?? "" });
  const isUrl = field === "iosUrl" || field === "androidUrl";
  const isVersion = field.endsWith("Version");
  const fieldSchema =
    field === "forceMessage"
      ? z.object({
          value: z
            .string()
            .trim()
            .max(500, "max500")
            .transform((value) => value || null),
        })
      : isUrl
        ? z.object({ value: optionalUrl })
        : z.object({ value: versionSchema });

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t(`apps.${app}`)} — ${t(field)}`}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(fieldSchema);
        if (data) {
          onSave(patchRelease(release, field, data.value ?? ""));
        }
      }}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {tCommon("cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? tCommon("saving") : tCommon("save")}
          </button>
        </>
      }
    >
      <ValidationList errors={form.serverErrors} />
      {field === "forceMessage" ? (
        <Field label={t(field)} error={form.errors.value}>
          <TextArea rows={4} value={form.values.value} onChange={(event) => form.set("value", event.target.value)} />
        </Field>
      ) : (
        <Field label={t(field)} error={form.errors.value}>
          <TextInput
            dir="ltr"
            value={form.values.value ?? ""}
            onChange={(event) => form.set("value", event.target.value)}
            placeholder={isUrl ? "https://" : isVersion ? "1.0.0" : undefined}
          />
        </Field>
      )}
    </Modal>
  );
}
