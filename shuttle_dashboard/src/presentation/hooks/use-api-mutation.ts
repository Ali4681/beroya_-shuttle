"use client";

import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "@/application/stores/toast-store";
import { useErrorMessage } from "@/presentation/hooks/use-error-message";

type Options<TVars, TData> = {
  mutationFn: (vars: TVars) => Promise<TData>;
  invalidate?: QueryKey[];
  successMessage?: string | false;
  onSuccess?: (data: TData, vars: TVars) => void;
  /** Return true to mark the error as handled (no toast). */
  onError?: (error: unknown) => boolean | void;
};

/** Mutation with cache invalidation and localized success / error toasts. */
export function useApiMutation<TVars = void, TData = unknown>({
  mutationFn,
  invalidate = [],
  successMessage,
  onSuccess,
  onError,
}: Options<TVars, TData>) {
  const client = useQueryClient();
  const messageFor = useErrorMessage();
  const t = useTranslations("Common");

  return useMutation({
    mutationFn,
    onSuccess: async (data, vars) => {
      await Promise.all(invalidate.map((queryKey) => client.invalidateQueries({ queryKey })));
      if (successMessage !== false) toast.success(successMessage ?? t("savedSuccessfully"));
      onSuccess?.(data, vars);
    },
    onError: (error) => {
      if (onError?.(error)) return;
      toast.error(messageFor(error));
    },
  });
}
