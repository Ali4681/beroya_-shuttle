"use client";

import { useTranslations } from "next-intl";
import { z } from "zod";
import { toast } from "@/application/stores/toast-store";
import type { InstitutionSettings } from "@/domain/models/entities";
import { Field, FormGrid, NumberInput, ValidationList } from "@/presentation/components/ui/form";
import { useErrorMessage } from "@/presentation/hooks/use-error-message";
import { useFormState } from "@/presentation/hooks/use-form-state";
import { v } from "@/shared/lib/validation";

const schema = z.object({
  defaultDelayThresholdMinutes: v.int(1, 180),
  defaultParentArrivalAlertMinutes: v.int(1, 180),
  gpsStaleAfterSeconds: v.int(15, 600),
  locationPingIntervalSeconds: v.int(5, 120),
});

export function SettingsForm({
  settings,
  saving,
  onSave,
}: {
  settings: InstitutionSettings | null;
  saving: boolean;
  onSave: (input: Partial<InstitutionSettings>) => Promise<unknown>;
}) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const messageFor = useErrorMessage();
  const form = useFormState({
    defaultDelayThresholdMinutes: String(settings?.defaultDelayThresholdMinutes ?? 10),
    defaultParentArrivalAlertMinutes: String(settings?.defaultParentArrivalAlertMinutes ?? 10),
    gpsStaleAfterSeconds: String(settings?.gpsStaleAfterSeconds ?? 120),
    locationPingIntervalSeconds: String(settings?.locationPingIntervalSeconds ?? 15),
  });
  const { values, set, errors } = form;

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(schema);
        if (!data) return;
        onSave(data).catch((error) => {
          if (!form.captureServerError(error)) toast.error(messageFor(error));
        });
      }}
    >
      <ValidationList errors={form.serverErrors} />
      <FormGrid>
        <Field label={t("delayThreshold")} required error={errors.defaultDelayThresholdMinutes} hint={t("minutesRange", { min: 1, max: 180 })}>
          <NumberInput min={1} max={180} unit={tCommon("unitMinutes")} value={values.defaultDelayThresholdMinutes} onChange={(value) => set("defaultDelayThresholdMinutes", value)} invalid={!!errors.defaultDelayThresholdMinutes} />
        </Field>
        <Field label={t("parentArrivalAlert")} required error={errors.defaultParentArrivalAlertMinutes} hint={t("minutesRange", { min: 1, max: 180 })}>
          <NumberInput min={1} max={180} unit={tCommon("unitMinutes")} value={values.defaultParentArrivalAlertMinutes} onChange={(value) => set("defaultParentArrivalAlertMinutes", value)} invalid={!!errors.defaultParentArrivalAlertMinutes} />
        </Field>
        <Field label={t("gpsStaleAfter")} required error={errors.gpsStaleAfterSeconds} hint={t("secondsRange", { min: 15, max: 600 })}>
          <NumberInput min={15} max={600} step={5} unit={tCommon("unitSeconds")} value={values.gpsStaleAfterSeconds} onChange={(value) => set("gpsStaleAfterSeconds", value)} invalid={!!errors.gpsStaleAfterSeconds} />
        </Field>
        <Field label={t("pingInterval")} required error={errors.locationPingIntervalSeconds} hint={t("secondsRange", { min: 5, max: 120 })}>
          <NumberInput min={5} max={120} unit={tCommon("unitSeconds")} value={values.locationPingIntervalSeconds} onChange={(value) => set("locationPingIntervalSeconds", value)} invalid={!!errors.locationPingIntervalSeconds} />
        </Field>
      </FormGrid>
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? tCommon("saving") : tCommon("save")}
        </button>
      </div>
    </form>
  );
}
