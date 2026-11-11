import { LOCALE_TRANSITION_KEY } from "@/presentation/components/theme/theme-boot";
import { syncDocumentTheme } from "@/presentation/components/theme/theme-dom";

export type LocaleTransitionDirection = "to-rtl" | "to-ltr";

const LEAVE_MS = 160;
const ENTER_MS = 300;

export function runLocaleTransition(
  update: () => void,
  direction: LocaleTransitionDirection,
) {
  if (typeof document === "undefined") {
    update();
    return;
  }

  const root = document.documentElement;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // Keep theme locked before the route swap.
  syncDocumentTheme();

  if (prefersReducedMotion) {
    update();
    return;
  }

  try {
    sessionStorage.setItem(LOCALE_TRANSITION_KEY, direction);
  } catch {
    // ignore
  }

  root.dataset.localeTransition = direction;
  root.classList.add("is-locale-leaving");
  root.classList.remove("is-locale-entering", "is-locale-enter-pending");

  window.setTimeout(() => {
    syncDocumentTheme();
    update();
  }, LEAVE_MS);
}

export function playLocaleEnter() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const pending = root.classList.contains("is-locale-enter-pending");

  let direction = root.dataset.localeTransition ?? null;
  try {
    const stored = sessionStorage.getItem(LOCALE_TRANSITION_KEY);
    if (stored) {
      direction = stored;
      sessionStorage.removeItem(LOCALE_TRANSITION_KEY);
    }
  } catch {
    // ignore
  }

  root.classList.remove("is-locale-leaving");

  if (!pending && !direction) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion) {
    root.classList.remove("is-locale-enter-pending", "is-locale-entering");
    delete root.dataset.localeTransition;
    return;
  }

  if (direction) {
    root.dataset.localeTransition = direction;
  }

  root.classList.remove("is-locale-enter-pending");
  void root.offsetWidth;
  root.classList.add("is-locale-entering");

  window.setTimeout(() => {
    root.classList.remove("is-locale-entering");
    delete root.dataset.localeTransition;
  }, ENTER_MS);
}
