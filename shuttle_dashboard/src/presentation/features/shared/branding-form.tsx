"use client";

import { DocumentUpload, Trash } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import { toast } from "@/application/stores/toast-store";
import type { Branding } from "@/domain/models/entities";
import type { BrandingInput } from "@/infrastructure/api/admin.api";
import { mediaUrl } from "@/infrastructure/api/uploads";
import { ColorField } from "@/presentation/components/ui/color-field";
import { CheckboxField, Field, FormGrid, TextArea, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { useErrorMessage } from "@/presentation/hooks/use-error-message";
import { useFormState } from "@/presentation/hooks/use-form-state";
import { v } from "@/shared/lib/validation";

const schema = z.object({
  useInstitutionIdentity: z.boolean(),
  primaryColor: v.hex(),
  secondaryColor: v.hex(),
  welcomeMessage: z
    .string()
    .trim()
    .max(140, "max140")
    .refine((value) => !/[<>]/.test(value), "noHtml")
    .transform((value) => value || undefined),
  supportPhone: v.optionalPhone(),
});

type BrandingFormProps = {
  branding: Branding | null;
  saving: boolean;
  onSave: (input: BrandingInput) => Promise<unknown>;
  uploadLogo: (file: File) => Promise<string>;
};

export function BrandingForm({ branding, saving, onSave, uploadLogo }: BrandingFormProps) {
  const t = useTranslations("Branding");
  const tCommon = useTranslations("Common");
  const messageFor = useErrorMessage();
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(branding?.logoUrl ?? null);
  const form = useFormState({
    useInstitutionIdentity: branding?.useInstitutionIdentity ?? true,
    primaryColor: branding?.primaryColor ?? "#22E0EE",
    secondaryColor: branding?.secondaryColor ?? "#10111F",
    welcomeMessage: branding?.welcomeMessage ?? "",
    supportPhone: branding?.supportPhone ?? "",
  });
  const { values, set, errors } = form;

  function setColor(key: "primaryColor" | "secondaryColor", value: string) {
    set(key, value);
    if (value !== values[key]) set("useInstitutionIdentity", true);
  }

  async function onPickLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      await onSave({ logoUrl: url, useInstitutionIdentity: true });
      setLogoUrl(url);
      set("useInstitutionIdentity", true);
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    try {
      await onSave({ logoUrl: null });
      setLogoUrl(null);
    } catch (error) {
      toast.error(messageFor(error));
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(schema);
        if (!data) return;
        onSave({ ...data, primaryColor: data.primaryColor.toUpperCase(), secondaryColor: data.secondaryColor.toUpperCase() }).catch(
          (error) => {
            if (!form.captureServerError(error)) toast.error(messageFor(error));
          },
        );
      }}
    >
      <ValidationList errors={form.serverErrors} />
      <div className="grid gap-6 lg:grid-cols-[1fr_200px]">
        <div className="flex flex-col gap-4">
          <CheckboxField
            checked={values.useInstitutionIdentity}
            onChange={(checked) => set("useInstitutionIdentity", checked)}
            label={t("useInstitutionIdentity")}
            hint={t("useInstitutionIdentityHint")}
          />
          {values.useInstitutionIdentity ? null : (
            <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-start text-xs font-medium text-warning">
              {t("identityDisabledWarning")}
            </p>
          )}
          <FormGrid>
            <Field label={t("primaryColor")} required error={errors.primaryColor}>
              <ColorField value={values.primaryColor} onChange={(value) => setColor("primaryColor", value)} />
            </Field>
            <Field label={t("secondaryColor")} required error={errors.secondaryColor}>
              <ColorField value={values.secondaryColor} onChange={(value) => setColor("secondaryColor", value)} />
            </Field>
            <Field label={t("supportPhone")} error={errors.supportPhone}>
              <TextInput dir="ltr" type="tel" value={values.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} invalid={!!errors.supportPhone} />
            </Field>
            <Field
              label={t("welcomeMessage")}
              error={errors.welcomeMessage}
              hint={`${values.welcomeMessage.length}/140`}
              className="sm:col-span-2"
            >
              <TextArea
                maxLength={140}
                value={values.welcomeMessage}
                onChange={(e) => set("welcomeMessage", e.target.value)}
                invalid={!!errors.welcomeMessage}
              />
            </Field>
          </FormGrid>
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-medium text-text-primary">{t("logo")}</span>
          <label className="relative flex size-[160px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface-muted text-text-muted transition hover:border-accent">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- served by backend storage
              <img src={mediaUrl(logoUrl)} alt={t("logo")} className="absolute inset-0 size-full bg-white object-contain p-3" />
            ) : (
              <>
                <DocumentUpload size={30} color="currentColor" variant="Linear" />
                <span className="px-3 text-center text-xs">{t("uploadLogo")}</span>
              </>
            )}
            {uploading ? (
              <span className="absolute inset-0 flex items-center justify-center bg-overlay">
                <span className="panel-spinner" />
              </span>
            ) : null}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                void onPickLogo(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <p className="text-center text-xs text-text-muted">{t("logoHint")}</p>
          {logoUrl ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void removeLogo()}>
              <Trash size={14} color="currentColor" variant="Linear" />
              {t("removeLogo")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? tCommon("saving") : tCommon("save")}
        </button>
      </div>
    </form>
  );
}
