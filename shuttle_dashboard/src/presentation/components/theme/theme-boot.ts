export const THEME_STORAGE_KEY = "beroya-theme";
export const LOCALE_TRANSITION_KEY = "beroya-locale-transition";

export const themeBootScript = `
(() => {
  try {
    const stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    const mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const resolved = mode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;

    const localeTransition = sessionStorage.getItem("${LOCALE_TRANSITION_KEY}");
    if (localeTransition === "to-rtl" || localeTransition === "to-ltr") {
      document.documentElement.dataset.localeTransition = localeTransition;
      document.documentElement.classList.add("is-locale-enter-pending");
    }
  } catch (_) {}
})();
`;
