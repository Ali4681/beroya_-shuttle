"use client";

import { Moon, Sun } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { useTheme } from "@/presentation/components/theme/theme-provider";

export function ThemeToggle() {
  const t = useTranslations("Common");
  const { resolvedTheme, toggleTheme, hydrated } = useTheme();
  const isDark = hydrated && resolvedTheme === "dark";

  function onToggle(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    toggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      data-state={isDark ? "dark" : "light"}
      aria-label={isDark ? t("lightMode") : t("darkMode")}
      title={isDark ? t("lightMode") : t("darkMode")}
      className="theme-toggle"
    >
      <span className="theme-icon theme-icon--sun" aria-hidden>
        <Sun size={19} color="currentColor" variant="Linear" />
      </span>
      <span className="theme-icon theme-icon--moon" aria-hidden>
        <Moon size={19} color="currentColor" variant="Linear" />
      </span>
    </button>
  );
}
