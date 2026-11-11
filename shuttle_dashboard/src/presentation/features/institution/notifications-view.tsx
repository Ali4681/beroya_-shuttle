"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Send } from "iconsax-react-v2";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  NOTIFICATION_AUDIENCES,
  ROUTE_AUDIENCES,
  type NotificationAudience,
} from "@/domain/models/enums";
import { newIdempotencyKey } from "@/infrastructure/http/client";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { Chip, StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { DataTable } from "@/presentation/components/ui/data-table";
import {
  EnumSelect,
  Field,
  scheduleFocusFirstInvalidField,
  SelectInput,
  TextArea,
  TextInput,
} from "@/presentation/components/ui/form";
import { Drawer } from "@/presentation/components/ui/overlay";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, ConfirmDialog, KeyValue, PageSection, Tabs } from "@/presentation/components/ui/panel";
import { ErrorState, LoadingState } from "@/presentation/components/ui/states";
import { useInstitution, useRouteOptions } from "@/presentation/features/institution/use-institution";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useListParams } from "@/presentation/hooks/use-list-params";
import { formatDateTime } from "@/shared/lib/format";
import { combineNotificationLocales, pickNotificationLocale } from "@/shared/lib/notification-i18n";

function audiencesFor(type: string): readonly NotificationAudience[] {
  if (type === "SCHOOL") return ["ALL_PARENTS", "ROUTE_PARENTS"];
  if (type === "UNIVERSITY") return ["ALL_UNIVERSITY_STUDENTS", "ROUTE_UNIVERSITY_STUDENTS"];
  return NOTIFICATION_AUDIENCES;
}

export function NotificationsView() {
  const t = useTranslations("Notifications");
  const locale = useLocale();
  const audienceLabel = useEnumLabel("audience");
  const originLabel = useEnumLabel("origin");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { setPage, query } = useListParams({});

  const list = useQuery({
    queryKey: qk.institution.notifications(query),
    queryFn: () => institutionApi.notifications(query),
    placeholderData: keepPreviousData,
  });

  return (
    <PageSection>
      <PageHeader icon="bell" title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ComposeCard />
        <Card title={t("log")}>
          <DataTable
            rows={list.data?.data}
            meta={list.data?.meta}
            onPageChange={setPage}
            isLoading={list.isPending}
            error={list.error}
            onRetry={() => list.refetch()}
            rowKey={(row) => row.id}
            onRowClick={(row) => setSelectedId(row.id)}
            emptyTitle={t("empty")}
            minWidth={720}
            columns={[
              { key: "title", header: t("titleField"), cell: (row) => <span className="cell-strong" dir="auto">{pickNotificationLocale(row.title, row.body, locale).title}</span> },
              { key: "audience", header: t("audience"), cell: (row) => audienceLabel(row.audience) },
              { key: "origin", header: t("origin"), cell: (row) => <Chip tone={row.origin === "SYSTEM" ? "info" : "muted"}>{originLabel(row.origin)}</Chip> },
              {
                key: "delivery",
                header: t("delivery"),
                cell: (row) => (
                  <span className="text-sm">
                    {row.sentCount}/{row.recipientsCount}
                    {row.failedCount ? <span className="text-danger"> · {t("failedCount", { count: row.failedCount })}</span> : null}
                  </span>
                ),
              },
              { key: "at", header: t("sentAt"), cell: (row) => formatDateTime(row.createdAt, locale) },
            ]}
          />
        </Card>
      </div>
      <NotificationDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </PageSection>
  );
}

type Draft = {
  audience: NotificationAudience | "";
  routeId: string;
  titleAr: string;
  bodyAr: string;
  titleEn: string;
  bodyEn: string;
};
const EMPTY: Draft = { audience: "", routeId: "", titleAr: "", bodyAr: "", titleEn: "", bodyEn: "" };

function ComposeCard() {
  const t = useTranslations("Notifications");
  const locale = useLocale();
  const { institution } = useInstitution();
  const routeOptions = useRouteOptions();
  const audiences = audiencesFor(institution.type);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [lang, setLang] = useState<"ar" | "en">(locale === "en" ? "en" : "ar");
  const [errors, setErrors] = useState<Partial<Record<keyof Draft | "languages", string>>>({});
  const [preview, setPreview] = useState<{ key: string; count: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Stable across retries of the same message so the backend can deduplicate. */
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const needsRoute = draft.audience !== "" && ROUTE_AUDIENCES.includes(draft.audience);
  const audienceKey = `${draft.audience}:${needsRoute ? draft.routeId : ""}`;
  const previewValid = preview?.key === audienceKey;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setIdempotencyKey(newIdempotencyKey());
  }

  function validate(full: boolean) {
    const next: Partial<Record<keyof Draft | "languages", string>> = {};
    if (!draft.audience) next.audience = "required";
    if (needsRoute && !draft.routeId) next.routeId = "required";
    if (full) {
      const ar = { title: draft.titleAr.trim(), body: draft.bodyAr.trim() };
      const en = { title: draft.titleEn.trim(), body: draft.bodyEn.trim() };
      const hasAr = ar.title.length >= 2 && ar.body.length >= 2;
      const hasEn = en.title.length >= 2 && en.body.length >= 2;
      if (ar.title && ar.title.length < 2) next.titleAr = "min2";
      if (ar.body && ar.body.length < 2) next.bodyAr = "min2";
      if (en.title && en.title.length < 2) next.titleEn = "min2";
      if (en.body && en.body.length < 2) next.bodyEn = "min2";
      if ((ar.title.length >= 2) !== (ar.body.length >= 2)) {
        if (ar.title.length < 2) next.titleAr = "min2";
        if (ar.body.length < 2) next.bodyAr = "min2";
      }
      if ((en.title.length >= 2) !== (en.body.length >= 2)) {
        if (en.title.length < 2) next.titleEn = "min2";
        if (en.body.length < 2) next.bodyEn = "min2";
      }
      if (!hasAr && !hasEn) next.languages = t("needOneLanguage");
      else {
        const packed = combineNotificationLocales(ar, en);
        if (packed.title.length > 120) next.languages = t("combinedTitleTooLong");
        else if (packed.body.length > 1000) next.languages = t("combinedBodyTooLong");
      }
    }
    setErrors(next);
    if (Object.keys(next).length) scheduleFocusFirstInvalidField();
    return Object.keys(next).length === 0;
  }

  const previewMutation = useApiMutation({
    mutationFn: () => institutionApi.audiencePreview(draft.audience as NotificationAudience, needsRoute ? draft.routeId : undefined),
    successMessage: false,
    onSuccess: (data) => setPreview({ key: audienceKey, count: data.recipientsCount }),
  });

  const send = useApiMutation({
    mutationFn: () =>
      institutionApi.sendNotification(
        {
          audience: draft.audience as NotificationAudience,
          routeId: needsRoute ? draft.routeId : undefined,
          ...combineNotificationLocales(
            { title: draft.titleAr, body: draft.bodyAr },
            { title: draft.titleEn, body: draft.bodyEn },
          ),
        },
        idempotencyKey,
      ),
    invalidate: [qk.institution.notifications()],
    successMessage: t("sent"),
    onSuccess: () => {
      setConfirmOpen(false);
      setDraft(EMPTY);
      setPreview(null);
      setIdempotencyKey(newIdempotencyKey());
    },
  });

  return (
    <Card title={t("compose")}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!validate(true)) return;
          if (!previewValid) {
            previewMutation.mutate();
            return;
          }
          setConfirmOpen(true);
        }}
      >
        <Field label={t("audience")} required error={errors.audience}>
          <EnumSelect
            group="audience"
            values={audiences}
            value={draft.audience}
            onChange={(value) => update("audience", value as NotificationAudience)}
          />
        </Field>
        {needsRoute ? (
          <Field label={t("route")} required error={errors.routeId}>
            <SelectInput value={draft.routeId} onChange={(value) => update("routeId", value)} options={routeOptions} />
          </Field>
        ) : null}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2.5">
          <span className="text-start text-sm text-text-secondary">
            {previewValid ? t("recipients", { count: preview.count }) : t("previewHint")}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={previewMutation.isPending}
            onClick={() => validate(false) && previewMutation.mutate()}
          >
            {previewMutation.isPending ? t("previewing") : t("preview")}
          </button>
        </div>
        <p className="text-start text-xs text-text-muted">{t("languageHint")}</p>
        <Tabs
          tabs={[
            { id: "ar", label: t("langAr") },
            { id: "en", label: t("langEn") },
          ]}
          value={lang}
          onChange={setLang}
        />
        {lang === "ar" ? (
          <>
            <Field label={t("titleAr")} required error={errors.titleAr} hint={`${draft.titleAr.trim().length}/120`}>
              <TextInput dir="rtl" value={draft.titleAr} maxLength={120} onChange={(event) => update("titleAr", event.target.value)} invalid={Boolean(errors.titleAr)} />
            </Field>
            <Field label={t("bodyAr")} required error={errors.bodyAr} hint={`${draft.bodyAr.trim().length}/1000`}>
              <TextArea dir="rtl" rows={5} value={draft.bodyAr} maxLength={1000} onChange={(event) => update("bodyAr", event.target.value)} invalid={Boolean(errors.bodyAr)} />
            </Field>
          </>
        ) : (
          <>
            <Field label={t("titleEn")} required error={errors.titleEn} hint={`${draft.titleEn.trim().length}/120`}>
              <TextInput dir="ltr" value={draft.titleEn} maxLength={120} onChange={(event) => update("titleEn", event.target.value)} invalid={Boolean(errors.titleEn)} />
            </Field>
            <Field label={t("bodyEn")} required error={errors.bodyEn} hint={`${draft.bodyEn.trim().length}/1000`}>
              <TextArea dir="ltr" rows={5} value={draft.bodyEn} maxLength={1000} onChange={(event) => update("bodyEn", event.target.value)} invalid={Boolean(errors.bodyEn)} />
            </Field>
          </>
        )}
        {errors.languages ? <p className="text-start text-xs text-danger">{errors.languages}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={send.isPending || previewMutation.isPending || (previewValid && preview.count === 0)}>
          <Send size={16} color="currentColor" variant="Linear" />
          {previewValid ? t("send") : t("previewAndSend")}
        </button>
        {previewValid && preview.count === 0 ? <p className="text-start text-xs text-warning">{t("noRecipients")}</p> : null}
      </form>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("confirmTitle")}
        description={t("confirmSend", { count: preview?.count ?? 0 })}
        confirmLabel={t("send")}
        pending={send.isPending}
        onConfirm={() => send.mutate()}
      />
    </Card>
  );
}

function NotificationDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("Notifications");
  const locale = useLocale();
  const audienceLabel = useEnumLabel("audience");
  const originLabel = useEnumLabel("origin");
  const roleLabel = useEnumLabel("role");
  const detail = useQuery({
    queryKey: qk.institution.notification(id ?? ""),
    queryFn: () => institutionApi.notification(id!),
    enabled: Boolean(id),
  });
  const data = detail.data;

  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={data ? pickNotificationLocale(data.title, data.body, locale).title : t("detail")} wide>
      {detail.isPending ? (
        <LoadingState rows={5} />
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : data ? (
        <>
          <KeyValue
            items={[
              { label: t("audience"), value: audienceLabel(data.audience) },
              { label: t("origin"), value: originLabel(data.origin) },
              { label: t("sentAt"), value: formatDateTime(data.createdAt, locale) },
              { label: t("recipientsLabel"), value: data.recipientsCount },
              { label: t("sentCount"), value: data.sentCount },
              { label: t("failedLabel"), value: data.failedCount },
            ]}
          />
          <p className="whitespace-pre-wrap rounded-lg bg-surface-muted p-3 text-start text-sm text-text-secondary" dir="auto">
            {pickNotificationLocale(data.title, data.body, locale).body}
          </p>
          {data.recipients?.length ? (
            <DataTable
              rows={data.recipients}
              rowKey={(row) => row.id}
              minWidth={560}
              columns={[
                {
                  key: "user",
                  header: t("recipient"),
                  cell: (row) =>
                    row.user ? (
                      <span className="flex flex-col">
                        <span className="cell-strong">{row.user.fullName}</span>
                        <span className="text-xs text-text-muted">
                          {roleLabel(row.user.role)} · <span dir="ltr">{row.user.phone}</span>
                        </span>
                      </span>
                    ) : (
                      "—"
                    ),
                },
                { key: "status", header: t("deliveryStatus"), cell: (row) => <StatusBadge status={row.status} /> },
                { key: "at", header: t("sentAt"), cell: (row) => formatDateTime(row.sentAt, locale) },
              ]}
            />
          ) : null}
        </>
      ) : null}
    </Drawer>
  );
}
