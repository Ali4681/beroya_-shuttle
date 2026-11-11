"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { runLocaleTransition } from "@/shared/lib/locale-transition";
import { cn } from "@/shared/lib/cn";

export function LanguageSwitcher() {
  const t = useTranslations("Common");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchLocale(nextLocale: AppLocale) {
    if (nextLocale === locale || pending) return;

    runLocaleTransition(() => {
      startTransition(() => {
        router.replace(pathname, { locale: nextLocale });
      });
    }, nextLocale === "ar" ? "to-rtl" : "to-ltr");
  }

  return (
    <div
      className="flex items-center rounded-full border border-border bg-surface-muted p-0.5"
      role="group"
      aria-label={t("language")}
      aria-busy={pending}
    >
      {routing.locales.map((item) => {
        const active = item === locale;
        const label = item === "ar" ? t("arabic") : t("english");

        return (
          <button
            key={item}
            type="button"
            disabled={pending}
            aria-label={label}
            onClick={() => switchLocale(item)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200",
              active
                ? "bg-accent text-white shadow-[0_2px_6px_var(--accent-glow)]"
                : "text-text-secondary hover:text-text-primary",
              pending && !active && "opacity-50",
            )}
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{item === "ar" ? "ع" : "EN"}</span>
          </button>
        );
      })}
    </div>
  );
}
