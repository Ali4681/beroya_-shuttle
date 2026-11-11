"use client";

import { useQuery } from "@tanstack/react-query";
import { DocumentUpload, Trash } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import { toast } from "@/application/stores/toast-store";
import type { Pickup, StudentDetail } from "@/domain/models/entities";
import {
  PICKUP_TYPES,
  STUDENT_SUBSCRIPTION_TYPES,
  type PickupType,
  type StudentSubscriptionType,
} from "@/domain/models/enums";
import {
  institutionApi,
  type CreateStudentInput,
  type PickupInput,
  type StudentInput,
} from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { mediaUrl, uploadImage } from "@/infrastructure/api/uploads";
import { LocationPickerMap } from "@/presentation/components/map/location-picker-map";
import {
  EnumSelect,
  Field,
  FormGrid,
  PasswordInput,
  scheduleFocusFirstInvalidField,
  SelectInput,
  TextInput,
  ValidationList,
} from "@/presentation/components/ui/form";
import { Drawer, Modal } from "@/presentation/components/ui/overlay";
import { useBranchOptions, useInstitution } from "@/presentation/features/institution/use-institution";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useErrorMessage } from "@/presentation/hooks/use-error-message";
import { useFormState, useResetOnKey } from "@/presentation/hooks/use-form-state";
import { v } from "@/shared/lib/validation";

export type PickupDraft = {
  pickupType: PickupType;
  meetingPointId: string;
  latitude: number;
  longitude: number;
  addressLabel: string;
};

export function pickupDraft(pickup: Pickup | null | undefined, fallback: { lat: number; lng: number }): PickupDraft {
  return {
    pickupType: pickup?.pickupType ?? "HOME",
    meetingPointId: pickup?.meetingPointId ?? "",
    latitude: pickup?.latitude ?? fallback.lat,
    longitude: pickup?.longitude ?? fallback.lng,
    addressLabel: pickup?.addressLabel ?? "",
  };
}

/** HOME needs coordinates, MEETING_POINT needs an id; other fields are not sent. */
export function toPickupInput(draft: PickupDraft): PickupInput | null {
  if (draft.pickupType === "MEETING_POINT") {
    return draft.meetingPointId ? { pickupType: "MEETING_POINT", meetingPointId: draft.meetingPointId } : null;
  }
  if (!Number.isFinite(draft.latitude) || !Number.isFinite(draft.longitude)) return null;
  return {
    pickupType: "HOME",
    latitude: draft.latitude,
    longitude: draft.longitude,
    addressLabel: draft.addressLabel.trim() || undefined,
  };
}

export function studentKeys(studentId?: string) {
  return [
    qk.institution.students(),
    ["parents"],
    ["routes"],
    ...(studentId ? [qk.institution.student(studentId)] : []),
  ];
}

export function PickupFields({
  value,
  onChange,
  branchId,
  error,
}: {
  value: PickupDraft;
  onChange: (next: PickupDraft) => void;
  branchId: string;
  error?: string;
}) {
  const t = useTranslations("Students");
  const points = useQuery({ queryKey: qk.institution.meetingPoints, queryFn: () => institutionApi.meetingPoints() });
  const options = (points.data ?? [])
    .filter((point) => point.status === "ACTIVE" && (!point.branchId || point.branchId === branchId))
    .map((point) => ({ value: point.id, label: point.name }));

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <Field label={t("pickupType")} required>
        <EnumSelect
          group="pickupType"
          values={PICKUP_TYPES}
          value={value.pickupType}
          onChange={(next) => onChange({ ...value, pickupType: next as PickupType })}
        />
      </Field>
      {value.pickupType === "MEETING_POINT" ? (
        <Field label={t("meetingPoint")} required error={error} hint={options.length ? undefined : t("noMeetingPoints")}>
          <SelectInput value={value.meetingPointId} onChange={(next) => onChange({ ...value, meetingPointId: next })} options={options} />
        </Field>
      ) : (
        <>
          <Field label={t("addressLabel")}>
            <TextInput value={value.addressLabel} onChange={(event) => onChange({ ...value, addressLabel: event.target.value })} />
          </Field>
          <Field label={t("homeLocation")} required error={error}>
            <LocationPickerMap
              compact
              lat={value.latitude}
              lng={value.longitude}
              onChange={(coords) => onChange({ ...value, latitude: coords.lat, longitude: coords.lng })}
            />
          </Field>
        </>
      )}
    </div>
  );
}

export function PhotoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const t = useTranslations("Students");
  const messageFor = useErrorMessage();
  const [uploading, setUploading] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(
        file,
        "student_photo",
        (contentType, byteSize) => institutionApi.presign("student_photo", contentType, byteSize),
        (objectKey) => institutionApi.completeUpload("student_photo", objectKey),
      );
      onChange(url);
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <label className="relative flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border-strong bg-surface-muted text-text-muted transition hover:border-accent">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by backend storage
          <img src={mediaUrl(value)} alt={t("photo")} className="absolute inset-0 size-full object-cover" />
        ) : (
          <DocumentUpload size={24} color="currentColor" variant="Linear" />
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-overlay">
            <span className="panel-spinner" />
          </span>
        ) : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      <div className="flex flex-col gap-1 text-start">
        <span className="text-sm font-medium text-text-primary">{t("photo")}</span>
        <span className="text-xs text-text-muted">{t("photoHint")}</span>
        {value ? (
          <button type="button" className="btn btn-ghost btn-sm w-fit" onClick={() => onChange("")}>
            <Trash size={14} color="currentColor" variant="Linear" />
            {t("removePhoto")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const studentSchema = z.object({
  fullName: v.name(),
  branchId: v.uuid(),
  grade: v.optionalText(),
  section: v.optionalText(),
  subscriptionType: z.enum(STUDENT_SUBSCRIPTION_TYPES),
  photoUrl: v.optionalText(),
});

function guardianSchema(editing: boolean) {
  return z.object({
    guardianName: v.name(),
    guardianPhone: v.phone(),
    guardianEmail: v.email(),
    guardianPassword: editing ? v.optionalPassword() : v.password(),
  });
}

/** Create (with guardian + pickup) or edit the student's own fields. */
export function StudentDrawer({
  open,
  onClose,
  student,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  student?: StudentDetail;
  onCreated?: (student: StudentDetail) => void;
}) {
  const t = useTranslations("Students");
  const tCommon = useTranslations("Common");
  const { branches } = useInstitution();
  const branchOptions = useBranchOptions();
  const initial = {
    fullName: student?.fullName ?? "",
    branchId: student?.branchId ?? branches[0]?.id ?? "",
    grade: student?.grade ?? "",
    section: student?.section ?? "",
    subscriptionType: (student?.subscriptionType ?? "ROUND_TRIP") as StudentSubscriptionType,
    photoUrl: student?.photoUrl ?? "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    guardianPassword: "",
  };
  const form = useFormState(initial);
  const branch = branches.find((item) => item.id === form.values.branchId) ?? branches[0];
  const fallback = { lat: branch?.latitude ?? 36.19934, lng: branch?.longitude ?? 37.15822 };
  const [pickup, setPickup] = useState<PickupDraft>(() => pickupDraft(null, fallback));
  const [pickupError, setPickupError] = useState<string>();
  const key = open ? (student?.id ?? "new") : null;
  const [synced, setSynced] = useState<string | null>(null);
  if (key !== synced) {
    setSynced(key);
    if (open) {
      setPickup(pickupDraft(null, fallback));
      setPickupError(undefined);
    }
  }
  useResetOnKey(key, form.reset, initial);
  const { values, set, errors } = form;

  const save = useApiMutation({
    mutationFn: (input: StudentInput | CreateStudentInput) =>
      student ? institutionApi.updateStudent(student.id, input) : institutionApi.createStudent(input as CreateStudentInput),
    invalidate: studentKeys(student?.id),
    onError: form.captureServerError,
    onSuccess: (saved) => {
      onClose();
      if (!student) onCreated?.(saved);
    },
  });

  function submit() {
    const data = form.validate(studentSchema);
    if (!data) return;
    if (student) {
      save.mutate({ ...data, photoUrl: values.photoUrl !== (student.photoUrl ?? "") ? values.photoUrl : undefined });
      return;
    }
    const guardian = guardianSchema(false).safeParse(values);
    const pickupInput = toPickupInput(pickup);
    if (!guardian.success || !pickupInput) {
      if (!guardian.success) {
        const next: Record<string, string> = {};
        for (const issue of guardian.error.issues) next[String(issue.path[0])] ??= issue.message;
        form.setErrors((current) => ({ ...current, ...next }));
      }
      if (!pickupInput) setPickupError("required");
      scheduleFocusFirstInvalidField();
      return;
    }
    save.mutate({
      ...data,
      guardian: {
        fullName: guardian.data.guardianName,
        phone: guardian.data.guardianPhone,
        email: guardian.data.guardianEmail,
        password: guardian.data.guardianPassword ?? "",
      },
      pickup: pickupInput,
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={student ? t("edit") : t("add")}
      subtitle={student ? undefined : t("addHint")}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
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
      <PhotoField value={values.photoUrl} onChange={(url) => set("photoUrl", url)} />
      <FormGrid>
        <Field label={t("fullName")} required error={errors.fullName}>
          <TextInput value={values.fullName} onChange={(e) => set("fullName", e.target.value)} invalid={!!errors.fullName} />
        </Field>
        <Field label={t("branch")} required error={errors.branchId}>
          <SelectInput value={values.branchId} onChange={(value) => set("branchId", value)} options={branchOptions} />
        </Field>
        <Field label={t("grade")}>
          <TextInput value={values.grade} onChange={(e) => set("grade", e.target.value)} />
        </Field>
        <Field label={t("section")}>
          <TextInput value={values.section} onChange={(e) => set("section", e.target.value)} />
        </Field>
        <Field label={t("subscriptionType")} required>
          <EnumSelect
            group="subscriptionType"
            values={STUDENT_SUBSCRIPTION_TYPES}
            value={values.subscriptionType}
            onChange={(value) => set("subscriptionType", value as StudentSubscriptionType)}
          />
        </Field>
      </FormGrid>
      {student ? null : (
        <>
          <h3 className="text-start text-sm font-semibold text-text-primary">{t("guardian")}</h3>
          <FormGrid>
            <Field label={t("guardianName")} required error={errors.guardianName}>
              <TextInput value={values.guardianName} onChange={(e) => set("guardianName", e.target.value)} invalid={!!errors.guardianName} />
            </Field>
            <Field label={t("guardianPhone")} required error={errors.guardianPhone}>
              <TextInput dir="ltr" type="tel" value={values.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} invalid={!!errors.guardianPhone} />
            </Field>
            <Field label={t("email")} required error={errors.guardianEmail} hint={t("loginHint")}>
              <TextInput dir="ltr" type="email" autoComplete="off" value={values.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} invalid={!!errors.guardianEmail} />
            </Field>
            <Field label={t("password")} required error={errors.guardianPassword}>
              <PasswordInput autoComplete="new-password" value={values.guardianPassword} onChange={(e) => set("guardianPassword", e.target.value)} invalid={!!errors.guardianPassword} />
            </Field>
          </FormGrid>
          <h3 className="text-start text-sm font-semibold text-text-primary">{t("pickup")}</h3>
          <PickupFields
            value={pickup}
            onChange={(next) => {
              setPickup(next);
              setPickupError(undefined);
            }}
            branchId={values.branchId}
            error={pickupError}
          />
        </>
      )}
    </Drawer>
  );
}

export function GuardianModal({ student, open, onClose }: { student: StudentDetail; open: boolean; onClose: () => void }) {
  const t = useTranslations("Students");
  const tCommon = useTranslations("Common");
  const initial = {
    guardianName: student.guardian?.fullName ?? "",
    guardianPhone: student.guardian?.phone ?? "",
    guardianEmail: student.guardian?.email ?? "",
    guardianPassword: "",
  };
  const form = useFormState(initial);
  useResetOnKey(open ? student.id : null, form.reset, initial);
  const { values, set, errors } = form;

  const save = useApiMutation({
    mutationFn: (input: { fullName: string; phone: string; email: string; password?: string }) =>
      institutionApi.updateGuardian(student.id, input),
    invalidate: studentKeys(student.id),
    onError: form.captureServerError,
    onSuccess: onClose,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("editGuardian")}
      subtitle={t("guardianHint")}
      onSubmit={(event) => {
        event.preventDefault();
        const data = form.validate(guardianSchema(true));
        if (data) {
          save.mutate({
            fullName: data.guardianName,
            phone: data.guardianPhone,
            email: data.guardianEmail,
            password: data.guardianPassword,
          });
        }
      }}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {tCommon("cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? tCommon("saving") : tCommon("save")}
          </button>
        </>
      }
    >
      <ValidationList errors={form.serverErrors} />
      <Field label={t("guardianName")} required error={errors.guardianName}>
        <TextInput value={values.guardianName} onChange={(e) => set("guardianName", e.target.value)} invalid={!!errors.guardianName} />
      </Field>
      <Field label={t("guardianPhone")} required error={errors.guardianPhone}>
        <TextInput dir="ltr" type="tel" value={values.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} invalid={!!errors.guardianPhone} />
      </Field>
      <Field label={t("email")} required error={errors.guardianEmail} hint={t("loginHint")}>
        <TextInput dir="ltr" type="email" autoComplete="off" value={values.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} invalid={!!errors.guardianEmail} />
      </Field>
      <Field label={t("password")} error={errors.guardianPassword} hint={t("passwordKeepHint")}>
        <PasswordInput autoComplete="new-password" value={values.guardianPassword} onChange={(e) => set("guardianPassword", e.target.value)} invalid={!!errors.guardianPassword} />
      </Field>
    </Modal>
  );
}

export function PickupDrawer({ student, open, onClose }: { student: StudentDetail; open: boolean; onClose: () => void }) {
  const t = useTranslations("Students");
  const tCommon = useTranslations("Common");
  const { branches } = useInstitution();
  const branch = branches.find((item) => item.id === student.branchId);
  const fallback = { lat: branch?.latitude ?? 36.19934, lng: branch?.longitude ?? 37.15822 };
  const [pickup, setPickup] = useState<PickupDraft>(() => pickupDraft(student.pickup, fallback));
  const [error, setError] = useState<string>();
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPickup(pickupDraft(student.pickup, fallback));
      setError(undefined);
    }
  }

  const save = useApiMutation({
    mutationFn: (input: PickupInput) => institutionApi.updatePickup(student.id, input),
    invalidate: [...studentKeys(student.id), ["route"]],
    successMessage: t("pickupSaved"),
    onSuccess: onClose,
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={t("editPickup")}
      subtitle={t("pickupHint")}
      onSubmit={(event) => {
        event.preventDefault();
        const input = toPickupInput(pickup);
        if (!input) {
          setError("required");
          return;
        }
        save.mutate(input);
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
      <PickupFields
        value={pickup}
        onChange={(next) => {
          setPickup(next);
          setError(undefined);
        }}
        branchId={student.branchId}
        error={error}
      />
    </Drawer>
  );
}
