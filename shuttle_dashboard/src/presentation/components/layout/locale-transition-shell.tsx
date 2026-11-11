"use client";

import { useLocale } from "next-intl";
import { useLayoutEffect, type ReactNode } from "react";
import { syncDocumentTheme } from "@/presentation/components/theme/theme-dom";
import { playLocaleEnter } from "@/shared/lib/locale-transition";

export function LocaleTransitionShell({ children }: { children: ReactNode }) {
  const locale = useLocale();

  useLayoutEffect(() => {
    // Re-apply dark/light before the enter fade reveals the page.
    syncDocumentTheme();
    playLocaleEnter();
  }, [locale]);

  return children;
}
