"use client";

import { Monitor, Moon, Sun, type Icon } from "iconsax-react-v2";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useSessionStore } from "@/application/stores/session-store";
import { LanguageSwitcher } from "@/presentation/components/layout/language-switcher";
import type { ThemeMode } from "@/presentation/components/theme/theme-dom";
import { useTheme } from "@/presentation/components/theme/theme-provider";
import { StatusBadge, useEnumLabel } from "@/presentation/components/ui/badge";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, KeyValue, PageSection, Tabs } from "@/presentation/components/ui/panel";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/format";

const THEME_OPTIONS: { value: ThemeMode; icon: Icon }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

export function AdminSettingsView() {
  const t = useTranslations("AdminSettings");
  const [tab, setTab] = useState<"account" | "appearance">("account");

  return (
    <PageSection>
      <PageHeader icon="settings" title={t("title")} subtitle={t("subtitle")} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "account", label: t("tabAccount") },
          { id: "appearance", label: t("tabAppearance") },
        ]}
      />
      {tab === "account" ? <AccountCard /> : null}
      {tab === "appearance" ? <AppearanceCard /> : null}
    </PageSection>
  );
}

function AccountCard() {
  const t = useTranslations("AdminSettings");
  const locale = useLocale();
  const roleLabel = useEnumLabel("role");
  const user = useSessionStore((state) => state.user);
  return (
    <Card title={t("accountTitle")}>
      <KeyValue
        items={[
          { label: t("fullName"), value: user?.fullName },
          { label: t("phone"), value: user ? <span dir="ltr">{user.phone}</span> : null },
          { label: t("role"), value: roleLabel(user?.role) },
          { label: t("status"), value: <StatusBadge status={user?.status} /> },
          { label: t("lastLogin"), value: formatDateTime(user?.lastLoginAt, locale) },
        ]}
      />
      <p className="text-start text-xs text-text-muted">{t("accountHint")}</p>
    </Card>
  );
}

export function AppearanceCard() {
  const t = useTranslations("AdminSettings");
  const { theme, setTheme, hydrated } = useTheme();
  return (
    <Card title={t("appearanceTitle")}>
      <div className="flex flex-col gap-2">
        <span className="text-start text-sm font-semibold text-text-primary">{t("theme")}</span>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t("theme")}>
          {THEME_OPTIONS.map(({ value, icon: ThemeIcon }) => {
            const active = hydrated && theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-start transition",
                  active ? "border-accent bg-accent-soft text-accent" : "border-border text-text-secondary hover:border-accent/40",
                )}
              >
                <ThemeIcon size={22} color="currentColor" variant={active ? "Bold" : "Linear"} />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{t(`themes.${value}`)}</span>
                  <span className="text-xs text-text-muted">{t(`themeHints.${value}`)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="flex flex-col text-start">
          <span className="text-sm font-semibold text-text-primary">{t("language")}</span>
          <span className="text-xs text-text-muted">{t("languageHint")}</span>
        </span>
        <LanguageSwitcher />
      </div>
    </Card>
  );
}
