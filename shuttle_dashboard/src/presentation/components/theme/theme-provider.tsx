"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";

import { THEME_STORAGE_KEY } from "@/presentation/components/theme/theme-boot";
import {
  getSystemTheme,
  readStoredTheme,
  resolveTheme,
  syncDocumentTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "@/presentation/components/theme/theme-dom";

export type { ThemeMode, ResolvedTheme };

const STORAGE_KEY = THEME_STORAGE_KEY;
const THEME_CHANGE_EVENT = "beroya-theme-change";

type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  hydrated: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: (origin?: { x: number; y: number }) => void;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

function revealTheme(update: () => void, origin?: { x: number; y: number }) {
  const doc = document as ViewTransitionDocument;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || !origin || reduceMotion) {
    update();
    return;
  }

  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );
  const transition = doc.startViewTransition(() => flushSync(update));
  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: 650,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {});
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

function writeStoredTheme(theme: ThemeMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function subscribeTheme(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => {
    media.removeEventListener("change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function subscribeHydrated() {
  return () => {};
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribeHydrated,
    () => true,
    () => false,
  );

  const theme = useSyncExternalStore(
    subscribeTheme,
    readStoredTheme,
    () => "system" as ThemeMode,
  );

  const resolvedTheme = useSyncExternalStore(
    subscribeTheme,
    () => resolveTheme(),
    () => "light" as ResolvedTheme,
  );

  // Before paint — critical after locale navigations that remount the tree.
  useLayoutEffect(() => {
    syncDocumentTheme();
  }, [theme, resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme: hydrated ? resolvedTheme : "light",
      hydrated,
      setTheme: (next) => {
        writeStoredTheme(next);
        applyTheme(next === "system" ? getSystemTheme() : next);
      },
      toggleTheme: (origin) => {
        const current = resolveTheme();
        const next: ThemeMode = current === "dark" ? "light" : "dark";
        revealTheme(() => {
          writeStoredTheme(next);
          applyTheme(next);
        }, origin);
      },
    }),
    [theme, resolvedTheme, hydrated],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
