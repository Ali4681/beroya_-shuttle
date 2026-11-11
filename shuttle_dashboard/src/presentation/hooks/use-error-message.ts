"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { isApiError } from "@/infrastructure/http/client";

export function errorCode(error: unknown) {
  if (isApiError(error)) return error.code;
  return "INTERNAL_ERROR";
}

export function isForbidden(error: unknown) {
  return isApiError(error) && (error.status === 403 || error.code === "FORBIDDEN");
}

/** Prefers the API message (already localized) then the panel catalog for the `error.code`. */
export function useErrorMessage() {
  const t = useTranslations("Errors");

  return useCallback(
    (error: unknown) => {
      const code = errorCode(error);
      if (isApiError(error) && error.message && error.message !== code) return error.message;
      if (t.has(code)) return t(code);
      return t("INTERNAL_ERROR");
    },
    [t],
  );
}
