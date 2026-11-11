"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";
import { isApiError } from "@/infrastructure/http/client";
import { scheduleFocusFirstInvalidField } from "@/presentation/components/ui/form";

type Errors<T> = Partial<Record<keyof T, string>>;

/** Small controlled-form helper: values, per-field errors (zod) and server validation messages. */
export function useFormState<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  }, []);

  const reset = useCallback((next?: T) => {
    setValues(next ?? initial);
    setErrors({});
    setServerErrors([]);
    // `initial` is only the fallback for the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate<S>(schema: z.ZodType<S>): S | null {
    setServerErrors([]);
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data;
    }
    const next: Errors<T> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof T | undefined;
      if (key !== undefined && !next[key]) next[key] = issue.message;
    }
    setErrors(next);
    scheduleFocusFirstInvalidField();
    return null;
  }

  /** Returns true when the error was a VALIDATION_ERROR and is now displayed in the form. */
  function captureServerError(error: unknown) {
    if (isApiError(error) && error.code === "VALIDATION_ERROR" && error.validationErrors.length) {
      setServerErrors(error.validationErrors);
      return true;
    }
    return false;
  }

  return { values, set, setValues, errors, setErrors, serverErrors, reset, validate, captureServerError };
}

/** Resets the form to `initial` whenever `key` changes to a non-null value (e.g. a drawer opening for a record). */
export function useResetOnKey<T extends Record<string, unknown>>(
  key: string | null,
  reset: (next?: T) => void,
  initial: T,
) {
  const [synced, setSynced] = useState<string | null>(null);
  if (key !== synced) {
    setSynced(key);
    if (key !== null) reset(initial);
  }
}
