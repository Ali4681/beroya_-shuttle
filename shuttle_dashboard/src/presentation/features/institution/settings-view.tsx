"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import type { InstitutionProfile } from "@/domain/models/entities";
import { institutionApi, type ProfileInput } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { uploadImage } from "@/infrastructure/api/uploads";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { Field, FormGrid, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, KeyValue, PageSection, Tabs } from "@/presentation/components/ui/panel";
import { EmptyState, QueryBoundary } from "@/presentation/components/ui/states";
import { BrandingForm } from "@/presentation/features/shared/branding-form";
import { SettingsForm } from "@/presentation/features/shared/settings-form";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState } from "@/presentation/hooks/use-form-state";
import { formatDate, formatMoney } from "@/shared/lib/format";
import { v } from "@/shared/lib/validation";

type Tab = "profile" | "branding" | "operations" | "subscription";

export function InstitutionSettingsView() {
  const t = useTranslations("InstitutionSettings");
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <PageSection>
      <PageHeader icon="settings" title={t("title")} subtitle={t("subtitle")} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "profile", label: t("tabProfile") },
          { id: "branding", label: t("tabBranding") },
          { id: "operations", label: t("tabOperations") },
          { id: "subscription", label: t("tabSubscription") },
        ]}
      />
      {tab === "profile" ? <ProfileTab /> : null}
      {tab === "branding" ? <BrandingTab /> : null}
      {tab === "operations" ? <OperationsTab /> : null}
      {tab === "subscription" ? <SubscriptionTab /> : null}
    </PageSection>
  );
}

function ProfileTab() {
  const profile = useQuery({ queryKey: qk.institution.profile, queryFn: institutionApi.profile });
  return (
    <Card>
      <QueryBoundary query={profile}>{(data) => <ProfileForm key={data.updatedAt} profile={data} />}</QueryBoundary>
    </Card>
  );
}

const profileSchema = z.object({
  name: v.name(),
  displayName: v.optionalText(),
  contactPhone: v.optionalPhone(),
  contactEmail: v.optionalEmail(),
  address: v.optionalText(),
});

function ProfileForm({ profile }: { profile: InstitutionProfile }) {
  const t = useTranslations("InstitutionSettings");
  const tCommon = useTranslations("Common");
  const typeLabel = useEnumLabel("institutionType");
  const modelLabel = useEnumLabel("operationModel");
  const form = useFormState({
    name: profile.name,
    displayName: profile.displayName ?? "",
    contactPhone: profile.contactPhone ?? "",
    contactEmail: profile.contactEmail ?? "",
    address: profile.address ?? "",
  });
  const { values, set, errors } = form;

  const save = useApiMutation({
    mutationFn: (input: ProfileInput) => institutionApi.updateProfile(input),
    invalidate: [qk.institution.profile, qk.institution.bootstrap],
    onError: form.captureServerError,
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(profileSchema);
        if (data) save.mutate(data);
      }}
    >
      <ValidationList errors={form.serverErrors} />
      <KeyValue
        items={[
          { label: t("type"), value: typeLabel(profile.type) },
          { label: t("operationModel"), value: modelLabel(profile.operationModel) },
          { label: t("status"), value: <StatusBadge status={profile.status} /> },
        ]}
      />
      <FormGrid>
        <Field label={t("name")} required error={errors.name}>
          <TextInput value={values.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
        </Field>
        <Field label={t("displayName")} hint={t("displayNameHint")}>
          <TextInput value={values.displayName} onChange={(e) => set("displayName", e.target.value)} />
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
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? tCommon("saving") : tCommon("save")}
        </button>
      </div>
    </form>
  );
}

function BrandingTab() {
  const t = useTranslations("Branding");
  const branding = useQuery({ queryKey: qk.institution.branding, queryFn: institutionApi.branding });
  const save = useApiMutation({
    mutationFn: institutionApi.updateBranding,
    invalidate: [qk.institution.branding, qk.institution.bootstrap],
    onError: () => true,
  });
  return (
    <Card title={t("title")}>
      <QueryBoundary query={branding}>
        {(data) => (
          <BrandingForm
            branding={data}
            saving={save.isPending}
            onSave={save.mutateAsync}
            uploadLogo={(file) =>
              uploadImage(
                file,
                "logo",
                (contentType, byteSize) => institutionApi.presign("logo", contentType, byteSize),
                (objectKey) => institutionApi.completeUpload("logo", objectKey),
              )
            }
          />
        )}
      </QueryBoundary>
    </Card>
  );
}

function OperationsTab() {
  const t = useTranslations("Settings");
  const settings = useQuery({ queryKey: qk.institution.settings, queryFn: institutionApi.settings });
  const save = useApiMutation({
    mutationFn: institutionApi.updateSettings,
    invalidate: [qk.institution.settings, qk.institution.bootstrap],
    onError: () => true,
  });
  return (
    <Card title={t("title")}>
      <QueryBoundary query={settings}>
        {(data) => <SettingsForm settings={data} saving={save.isPending} onSave={save.mutateAsync} />}
      </QueryBoundary>
    </Card>
  );
}

function SubscriptionTab() {
  const t = useTranslations("InstitutionSettings");
  const locale = useLocale();
  const periodLabel = useEnumLabel("billingPeriod");
  const subscription = useQuery({ queryKey: qk.institution.subscription, queryFn: institutionApi.subscription });
  return (
    <Card title={t("subscription")}>
      <QueryBoundary query={subscription}>
        {(data) =>
          data ? (
            <>
              <KeyValue
                items={[
                  { label: t("subscriptionStatus"), value: <StatusBadge status={data.status} /> },
                  { label: t("billingPeriod"), value: periodLabel(data.billingPeriod) },
                  { label: t("startsAt"), value: formatDate(data.startsAt, locale) },
                  { label: t("endsAt"), value: formatDate(data.endsAt, locale) },
                  {
                    label: t("daysRemaining"),
                    value:
                      data.daysRemaining != null ? (
                        <Chip tone={data.daysRemaining <= 7 ? "danger" : data.daysRemaining <= 30 ? "warning" : "success"}>
                          {t("days", { count: data.daysRemaining })}
                        </Chip>
                      ) : (
                        "—"
                      ),
                  },
                  { label: t("agreedAmount"), value: formatMoney(data.agreedAmount, data.currencyCode, locale) },
                ]}
              />
              <p className="text-start text-xs text-text-muted">{t("subscriptionHint")}</p>
            </>
          ) : (
            <EmptyState title={t("noSubscription")} description={t("subscriptionHint")} />
          )
        }
      </QueryBoundary>
    </Card>
  );
}
