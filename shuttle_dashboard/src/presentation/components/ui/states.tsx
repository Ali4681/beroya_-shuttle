"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Danger, DocumentText, ShieldCross } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { errorCode, isForbidden, useErrorMessage } from "@/presentation/hooks/use-error-message";
import { cn } from "@/shared/lib/cn";

export function LoadingState({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 py-2", className)} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton h-11 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("States");
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-4 py-14 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-text-muted">
        <DocumentText size={22} color="currentColor" variant="Linear" />
      </span>
      <p className="text-[15px] font-semibold text-text-primary">{title ?? t("emptyTitle")}</p>
      {description ? <p className="max-w-md text-sm text-text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function ForbiddenState({ className }: { className?: string }) {
  const t = useTranslations("States");
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-4 py-14 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <ShieldCross size={22} color="currentColor" variant="Bold" />
      </span>
      <p className="text-[15px] font-semibold text-text-primary">{t("forbiddenTitle")}</p>
      <p className="max-w-md text-sm text-text-muted">{t("forbiddenDescription")}</p>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useTranslations("States");
  const messageFor = useErrorMessage();

  if (isForbidden(error)) return <ForbiddenState className={className} />;

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-4 py-14 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <Danger size={22} color="currentColor" variant="Bold" />
      </span>
      <p className="text-[15px] font-semibold text-text-primary">{messageFor(error)}</p>
      <p className="font-mono text-xs text-text-muted" dir="ltr">
        {errorCode(error)}
      </p>
      {onRetry ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          {t("retry")}
        </button>
      ) : null}
    </div>
  );
}

/** Renders the four mandatory states (loading / empty / error / forbidden) around query data. */
export function QueryBoundary<T>({
  query,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  loadingRows,
  children,
}: {
  query: UseQueryResult<T>;
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  loadingRows?: number;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <LoadingState rows={loadingRows} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data as T;
  if (isEmpty?.(data)) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }
  return <>{children(data)}</>;
}
