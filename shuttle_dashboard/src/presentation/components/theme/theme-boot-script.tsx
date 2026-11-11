"use client";

import { useSyncExternalStore } from "react";
import { themeBootScript } from "@/presentation/components/theme/theme-boot";

function subscribe() {
  return () => {};
}

/**
 * Emits the FOUC-prevention theme script during SSR + hydration only.
 * After hydration it returns null so React 19 doesn't warn about client <script>s.
 */
export function ThemeBootScript() {
  const isServerOrHydrating = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );

  if (!isServerOrHydrating) {
    return null;
  }

  return (
    <script
      id="beroya-theme-boot"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeBootScript }}
    />
  );
}
