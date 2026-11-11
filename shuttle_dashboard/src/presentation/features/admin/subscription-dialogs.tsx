"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import { toast } from "@/application/stores/toast-store";
import type { Subscription } from "@/domain/models/entities";
import { BILLING_PERIODS, type BillingPeriod } from "@/domain/models/enums";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { AppDatePicker } from "@/presentation/components/ui/app-date-picker";
import { useEnumOptions } from "@/presentation/components/ui/badge";
import { Field, FormGrid, SelectInput, TextArea, TextInput, ValidationList } from "@/presentation/components/ui/form";
import { Drawer, Modal } from "@/presentation/components/ui/overlay";
import { ConfirmDialog } from "@/presentation/components/ui/panel";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useFormState } from "@/presentation/hooks/use-form-state";
import { addMonthsISO, isoToDateInput, todayISO } from "@/shared/lib/format";
import { v } from "@/shared/lib/validation";

const CURRENCIES = ["SYP", "USD"] as const;

const subscriptionSchema = z
  .object({
    billingPeriod: z.enum(BILLING_PERIODS, { message: "required" }),
    startsAt: v.date(),
    endsAt: v.date(),
    agreedAmount: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "amount")
      .transform(Number)
      .refine((value) => value <= 1_000_000, "amount"),
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, "currency")
      .transform((value) => value.toUpperCase()),
    notes: v.optionalText(),
  })
  .refine((data) => data.endsAt > data.startsAt, { path: ["endsAt"], message: "endAfterStart" });

export function SubscriptionDrawer({
  open,
  onClose,
  institutionId,
  subscription,
}: {
  open: boolean;
  onClose: () => void;
  institutionId: string;
  subscription?: Subscription | null;
}) {
  const t = useTranslations("Subscriptions");
  const tCommon = useTranslations("Common");
  const periodOptions = useEnumOptions("billingPeriod", BILLING_PERIODS);
  const period = (subscription?.billingPeriod ?? "MONTHLY") as BillingPeriod;
  const startsAt = isoToDateInput(subscription?.startsAt) || todayISO();
  const initial = {
    billingPeriod: period as BillingPeriod | "",
    startsAt,
    endsAt: subscription
      ? isoToDateInput(subscription.endsAt)
      : period === "MONTHLY"
        ? addMonthsISO(startsAt, 1)
        : "",
    agreedAmount: subscription?.agreedAmount ?? "",
    currencyCode: subscription?.currencyCode ?? "USD",
    notes: subscription?.notes ?? "",
  };
  const form = useFormState(initial);
  const [syncedId, setSyncedId] = useState<string | null | undefined>(undefined);
  const key = open ? (subscription?.id ?? "new") : undefined;
  if (key !== syncedId) {
    setSyncedId(key);
    if (open) form.reset(initial);
  }
  const { values, set, errors } = form;

  function onPeriod(value: string) {
    const next = value as BillingPeriod;
    set("billingPeriod", next);
    if (next === "MONTHLY" && values.startsAt) set("endsAt", addMonthsISO(values.startsAt, 1));
  }

  function onStart(value: string) {
    set("startsAt", value);
    if (values.billingPeriod === "MONTHLY" && value) set("endsAt", addMonthsISO(value, 1));
  }
  const currencyOptions: { value: string; label: string }[] = CURRENCIES.map((code) => ({ value: code, label: t(`currencies.${code}`) }));
  if (values.currencyCode && !(CURRENCIES as readonly string[]).includes(values.currencyCode)) {
    currencyOptions.push({ value: values.currencyCode, label: values.currencyCode });
  }
  const invalidate = [qk.admin.institution(institutionId), qk.admin.subscriptions(), qk.admin.dashboard];

  const save = useApiMutation({
    mutationFn: (input: z.infer<typeof subscriptionSchema>) =>
      subscription
        ? adminApi.updateSubscription(institutionId, subscription.id, input)
        : adminApi.createSubscription(institutionId, input),
    invalidate,
    successMessage: subscription ? undefined : t("created"),
    onError: form.captureServerError,
    onSuccess: onClose,
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={subscription ? t("editTitle") : t("createTitle")}
      subtitle={t("createHint")}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(subscriptionSchema);
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
        <Field label={t("billingPeriod")} required error={errors.billingPeriod} className="sm:col-span-2">
          <SelectInput value={values.billingPeriod} onChange={onPeriod} options={periodOptions} />
        </Field>
        <Field label={t("startsAt")} required error={errors.startsAt}>
          <AppDatePicker value={values.startsAt} onChange={onStart} invalid={!!errors.startsAt} />
        </Field>
        <Field label={t("endsAt")} required error={errors.endsAt}>
          <AppDatePicker value={values.endsAt} min={values.startsAt || undefined} onChange={(value) => set("endsAt", value)} invalid={!!errors.endsAt} />
        </Field>
        <Field label={t("agreedAmount")} required error={errors.agreedAmount}>
          <TextInput dir="ltr" inputMode="decimal" value={values.agreedAmount} onChange={(e) => set("agreedAmount", e.target.value)} invalid={!!errors.agreedAmount} />
        </Field>
        <Field label={t("currency")} required error={errors.currencyCode}>
          <SelectInput value={values.currencyCode} onChange={(value) => set("currencyCode", value)} options={currencyOptions} />
        </Field>
        <Field label={t("notes")} className="sm:col-span-2">
          <TextArea value={values.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </FormGrid>
    </Drawer>
  );
}

/** Activate / cancel / extend actions with client-side date checks before calling the API. */
export function SubscriptionActions({ subscription }: { subscription: Subscription }) {
  const t = useTranslations("Subscriptions");
  const tCommon = useTranslations("Common");
  const [dialog, setDialog] = useState<"activate" | "cancel" | "extend" | "edit" | null>(null);
  const [newEndDate, setNewEndDate] = useState("");
  const [extendError, setExtendError] = useState<string>();
  const institutionId = subscription.institutionId;
  const invalidate = [qk.admin.institution(institutionId), qk.admin.subscriptions(), qk.admin.dashboard];
  const close = () => setDialog(null);

  const activate = useApiMutation({
    mutationFn: () => adminApi.activateSubscription(institutionId, subscription.id),
    invalidate,
    successMessage: t("activated"),
    onSuccess: close,
  });
  const cancel = useApiMutation({
    mutationFn: (reason: string) => adminApi.cancelSubscription(institutionId, subscription.id, reason),
    invalidate,
    successMessage: t("cancelled"),
    onSuccess: close,
  });
  const extend = useApiMutation({
    mutationFn: (date: string) => adminApi.extendSubscription(institutionId, subscription.id, date),
    invalidate,
    successMessage: t("extended"),
    onSuccess: close,
  });

  const endsAt = isoToDateInput(subscription.endsAt);
  const canEdit = subscription.status === "PENDING";
  const canActivate = subscription.status === "PENDING";
  const canCancel = subscription.status === "PENDING" || subscription.status === "ACTIVE";
  const canExtend = subscription.status === "ACTIVE";

  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      {canEdit ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog("edit")}>
          {tCommon("edit")}
        </button>
      ) : null}
      {canActivate ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (endsAt <= todayISO()) {
              toast.error(t("windowPassed"));
              return;
            }
            if (endsAt <= isoToDateInput(subscription.startsAt)) {
              toast.error(t("invalidWindow"));
              return;
            }
            setDialog("activate");
          }}
        >
          {t("activate")}
        </button>
      ) : null}
      {canExtend ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setNewEndDate("");
            setExtendError(undefined);
            setDialog("extend");
          }}
        >
          {t("extend")}
        </button>
      ) : null}
      {canCancel ? (
        <button type="button" className="btn btn-danger btn-sm" onClick={() => setDialog("cancel")}>
          {tCommon("cancel")}
        </button>
      ) : null}

      <SubscriptionDrawer
        open={dialog === "edit"}
        onClose={close}
        institutionId={institutionId}
        subscription={subscription}
      />

      <ConfirmDialog
        open={dialog === "activate"}
        onClose={close}
        title={t("activateTitle")}
        description={t("activateConfirm")}
        pending={activate.isPending}
        onConfirm={() => activate.mutate()}
      />

      <ConfirmDialog
        open={dialog === "cancel"}
        onClose={close}
        title={t("cancelTitle")}
        description={t("cancelConfirm")}
        danger
        withReason
        reasonRequired
        pending={cancel.isPending}
        onConfirm={({ reason }) => cancel.mutate(reason)}
      />

      <Modal
        open={dialog === "extend"}
        onClose={close}
        title={t("extendTitle")}
        onSubmit={(event) => {
          event.preventDefault();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(newEndDate)) {
            setExtendError("date");
            return;
          }
          if (newEndDate <= endsAt) {
            setExtendError("extendAfterCurrent");
            return;
          }
          extend.mutate(newEndDate);
        }}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close}>
              {tCommon("cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={extend.isPending}>
              {extend.isPending ? tCommon("saving") : t("extend")}
            </button>
          </>
        }
      >
        <p className="text-start text-sm text-text-secondary">{t("currentEnd", { date: endsAt })}</p>
        <Field label={t("newEndDate")} required error={extendError}>
          <AppDatePicker
            min={endsAt}
            value={newEndDate}
            invalid={!!extendError}
            onChange={(value) => {
              setNewEndDate(value);
              setExtendError(undefined);
            }}
          />
        </Field>
      </Modal>
    </div>
  );
}
