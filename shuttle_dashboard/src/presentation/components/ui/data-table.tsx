"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { PageMeta } from "@/domain/models/entities";
import { EmptyState, ErrorState } from "@/presentation/components/ui/states";
import { cn } from "@/shared/lib/cn";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  meta?: PageMeta;
  onPageChange?: (page: number) => void;
  minWidth?: number;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  onRowClick,
  meta,
  onPageChange,
  minWidth = 760,
}: DataTableProps<T>) {
  const colSpan = columns.length;

  let body: ReactNode;
  if (isLoading) {
    body = Array.from({ length: 5 }, (_, index) => (
      <tr key={`skeleton-${index}`}>
        <td colSpan={colSpan}>
          <div className="skeleton h-7 w-full" />
        </td>
      </tr>
    ));
  } else if (error) {
    body = (
      <tr>
        <td colSpan={colSpan}>
          <ErrorState error={error} onRetry={onRetry} />
        </td>
      </tr>
    );
  } else if (!rows || rows.length === 0) {
    body = (
      <tr>
        <td colSpan={colSpan}>
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </td>
      </tr>
    );
  } else {
    body = rows.map((row) => (
      <tr
        key={rowKey(row)}
        className={cn("data-row", onRowClick && "data-row--clickable")}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
      >
        {columns.map((column) => (
          <td key={column.key} className={column.className}>
            {column.cell(row)}
          </td>
        ))}
      </tr>
    ));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="data-table-shell">
        <table className="data-table" style={{ minWidth: rows?.length && !error ? minWidth : undefined }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={column.className}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
      {meta && onPageChange ? <Pagination meta={meta} onPageChange={onPageChange} /> : null}
    </div>
  );
}

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("Common");
  const { page, totalPages, total } = meta;
  if (totalPages <= 1) {
    return total > 0 ? (
      <p className="text-center text-xs text-text-muted">{t("totalCount", { count: total })}</p>
    ) : null;
  }

  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let p = start; p <= Math.min(totalPages, start + 4); p += 1) pages.push(p);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-text-muted">{t("totalCount", { count: total })}</p>
      <div className="flex items-center gap-1">
        <PageButton label="‹" disabled={page <= 1} onClick={() => onPageChange(page - 1)} rtlFlip />
        {pages.map((p) => (
          <PageButton key={p} label={String(p)} active={p === page} onClick={() => onPageChange(p)} />
        ))}
        <PageButton
          label="›"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          rtlFlip
        />
      </div>
    </div>
  );
}

function PageButton({
  label,
  active,
  disabled,
  onClick,
  rtlFlip,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  rtlFlip?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition",
        active
          ? "bg-accent text-white"
          : "text-text-secondary hover:bg-surface-muted",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
      )}
    >
      <span className={cn(rtlFlip && "rtl:-scale-x-100 inline-block")}>{label}</span>
    </button>
  );
}
