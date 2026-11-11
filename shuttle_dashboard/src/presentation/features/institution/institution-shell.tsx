"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useBrandingStore } from "@/application/stores/branding-store";
import { useSessionStore } from "@/application/stores/session-store";
import type { PlatformSettings } from "@/domain/models/entities";
import { http } from "@/infrastructure/http/client";
import { qk } from "@/infrastructure/api/query-keys";
import { applyInstitutionEvent } from "@/infrastructure/realtime/invalidate";
import { PanelShell, ShellLoading } from "@/presentation/components/layout/panel-shell";
import { filterNav, institutionNav } from "@/presentation/components/sidebar/nav";
import { ErrorState } from "@/presentation/components/ui/states";
import { useInstitutionBootstrap } from "@/presentation/features/institution/use-institution";
import { useRealtime } from "@/presentation/hooks/use-realtime";
import { updateSessionUser } from "@/shared/lib/session";

export function InstitutionShell({ children }: { children: ReactNode }) {
  const bootstrap = useInstitutionBootstrap();
  const setBranding = useBrandingStore((state) => state.setBranding);
  const setUser = useSessionStore((state) => state.setUser);
  const data = bootstrap.data;

  useEffect(() => {
    if (!data) return;
    setBranding(data.institution, data.branding);
    setUser(data.user);
    updateSessionUser(data.user);
  }, [data, setBranding, setUser]);

  const rooms = useMemo(() => (data ? [`institution:${data.institution.id}`] : []), [data]);
  useRealtime(rooms, applyInstitutionEvent);
  const sections = useMemo(() => filterNav(institutionNav, data?.institution.type), [data?.institution.type]);

  const brandName = data
    ? data.institution.displayName || data.institution.name
    : null;
  const logoUrl = data?.branding?.useInstitutionIdentity === false ? null : data?.branding?.logoUrl;

  const locale = useLocale();
  const t = useTranslations("PlatformSettings");
  const config = useQuery({
    queryKey: qk.public.appConfig,
    queryFn: () => http.getPublic<PlatformSettings>("/public/app-config"),
    staleTime: 30_000,
  });
  const maintenance = config.data?.maintenance;
  const blocked = Boolean(maintenance?.dashboard);
  const blockedMessage =
    locale === "en"
      ? maintenance?.messageEn || maintenance?.messageAr || t("dashboardBlockedFallback")
      : maintenance?.messageAr || maintenance?.messageEn || t("dashboardBlockedFallback");

  return (
    <PanelShell
      sections={sections}
      basePath="/institution"
      brandName={brandName}
      logoUrl={logoUrl}
    >
      {bootstrap.isPending ? (
        <ShellLoading />
      ) : bootstrap.isError ? (
        <ErrorState error={bootstrap.error} onRetry={() => bootstrap.refetch()} className="min-h-[60vh]" />
      ) : blocked ? (
        <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 p-8 text-center">
          <h1 className="text-xl font-semibold text-text-primary">{t("dashboardBlockedTitle")}</h1>
          <p className="text-text-secondary">{blockedMessage}</p>
        </div>
      ) : (
        children
      )}
    </PanelShell>
  );
}
