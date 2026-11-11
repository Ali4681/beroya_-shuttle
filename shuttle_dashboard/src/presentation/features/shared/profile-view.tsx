"use client";

import { Logout, ShieldTick } from "iconsax-react-v2";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useBrandingStore } from "@/application/stores/branding-store";
import { useSessionStore } from "@/application/stores/session-store";
import { userInitials } from "@/presentation/components/layout/user-menu";
import { StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, ConfirmDialog, KeyValue, PageSection } from "@/presentation/components/ui/panel";
import { AppearanceCard } from "@/presentation/features/admin/admin-settings-view";
import { useLogout } from "@/presentation/hooks/use-logout";
import { formatDateTime } from "@/shared/lib/format";

export function ProfileView() {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const roleLabel = useEnumLabel("role");
  const user = useSessionStore((state) => state.user);
  const institution = useBrandingStore((state) => state.institution);
  const { logout, pending } = useLogout();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <PageSection>
      <PageHeader icon="profile" title={t("title")} subtitle={t("subtitle")} />

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent-strong ring-4 ring-accent/20"
            aria-hidden
          >
            {userInitials(user?.fullName) || "—"}
          </span>
          <div className="flex min-w-0 flex-col gap-1 text-start">
            <span className="truncate text-lg font-bold text-text-primary">{user?.fullName ?? "—"}</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-text-muted">{roleLabel(user?.role)}</span>
              <StatusBadge status={user?.status} />
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <KeyValue
            items={[
              { label: t("fullName"), value: user?.fullName },
              { label: t("phone"), value: user ? <span dir="ltr">{user.phone}</span> : null },
              { label: t("role"), value: roleLabel(user?.role) },
              ...(institution
                ? [{ label: t("institution"), value: institution.displayName || institution.name }]
                : []),
              { label: t("lastLogin"), value: formatDateTime(user?.lastLoginAt, locale) },
              { label: t("phoneVerified"), value: formatDateTime(user?.phoneVerifiedAt, locale) },
            ]}
          />
        </div>
        <p className="text-start text-xs text-text-muted">{t("editHint")}</p>
      </Card>

      <AppearanceCard />

      <Card title={t("securityTitle")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3 text-start">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
              <ShieldTick size={20} color="currentColor" variant="Bulk" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-text-primary">{t("logoutAllTitle")}</span>
              <span className="text-xs text-text-muted">{t("logoutAllHint")}</span>
            </span>
          </div>
          <button type="button" className="btn btn-danger" disabled={pending} onClick={() => setConfirmOpen(true)}>
            <Logout size={16} color="currentColor" variant="Linear" className="rtl:-scale-x-100" />
            {t("logoutAll")}
          </button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("logoutAllConfirmTitle")}
        description={t("logoutAllConfirm")}
        confirmLabel={t("logoutAll")}
        danger
        pending={pending}
        onConfirm={() => void logout({ everywhere: true })}
      />
    </PageSection>
  );
}
