"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { AppHeader } from "@/presentation/components/layout/app-header";
import { LanguageSwitcher } from "@/presentation/components/layout/language-switcher";
import type { NavSection } from "@/presentation/components/sidebar/nav";
import { Sidebar } from "@/presentation/components/sidebar/sidebar";
import { AppScrollArea } from "@/presentation/components/ui/app-scroll-area";
import { cn } from "@/shared/lib/cn";

export function PanelShell({
  sections,
  basePath,
  brandName,
  logoUrl,
  children,
}: {
  sections: NavSection[];
  basePath: "/admin" | "/institution";
  brandName?: string | null;
  logoUrl?: string | null;
  children: ReactNode;
}) {
  const t = useTranslations("Common");
  const pathname = usePathname();
  const [navOpenedAt, setNavOpenedAt] = useState<string | null>(null);
  const navOpen = navOpenedAt === pathname;
  const closeNav = useCallback(() => setNavOpenedAt(null), []);

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("close")}
        onClick={closeNav}
        className={cn(
          "fixed inset-0 z-40 bg-overlay transition-opacity duration-300 lg:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <Sidebar
        sections={sections}
        brandName={brandName}
        logoUrl={logoUrl}
        mobileOpen={navOpen}
        onMobileClose={closeNav}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader
          basePath={basePath}
          languageSwitcher={<LanguageSwitcher />}
          onMenuClick={() => setNavOpenedAt(pathname)}
        />
        <AppScrollArea as="main" className="min-h-0 min-w-0 flex-1">
          {children}
        </AppScrollArea>
      </div>
    </>
  );
}

export function ShellLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <span className="panel-spinner" aria-hidden />
    </div>
  );
}
