import { THEME_STORAGE_KEY } from "@/presentation/components/theme/theme-boot";

export type ResolvedTheme = "light" | "dark";
export type ThemeMode = "light" | "dark" | "system";

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function readStoredTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // ignore
  }
  return "system";
}

export function resolveTheme(mode: ThemeMode = readStoredTheme()): ResolvedTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

/** Apply stored theme to <html> before paint — prevents light flash on locale nav. */
export function syncDocumentTheme() {
  if (typeof document === "undefined") return;

  const resolved = resolveTheme();
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}
