"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type Tone = "success" | "danger" | "warning" | "info" | "muted";

const TONES: Record<string, Tone> = {
  ACTIVE: "success",
  COMPLETED: "success",
  BOARDED: "info",
  DROPPED_OFF: "success",
  ARRIVED: "success",
  RESOLVED: "success",
  SENT: "success",
  DELIVERED: "success",
  SUSPENDED: "danger",
  CANCELLED: "danger",
  NOT_BOARDED: "danger",
  FAILED: "danger",
  OPEN: "danger",
  EXPIRED: "muted",
  INACTIVE: "muted",
  SKIPPED: "muted",
  UNDER_MAINTENANCE: "warning",
  STOPPED_TODAY: "warning",
  TEMPORARILY_UNAVAILABLE: "warning",
  UNDER_EDIT: "warning",
  PENDING: "warning",
  SCHEDULED: "info",
  IN_PROGRESS: "info",
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const t = useTranslations("Enums.status");
  if (!status) return <span className="text-text-muted">—</span>;
  const tone = TONES[status] ?? "muted";
  return (
    <span className={cn("status-badge", `status-badge--${tone}`, className)}>
      {t.has(status) ? t(status) : status}
    </span>
  );
}

export function Chip({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={cn("status-badge status-badge--plain", `status-badge--${tone}`, className)}>
      {children}
    </span>
  );
}

export function useEnumOptions(group: string, values: readonly string[]) {
  const label = useEnumLabel(group);
  return values.map((value) => ({ value, label: label(value) }));
}

/** Label for any enum group defined under `Enums.<group>`. */
export function useEnumLabel(group: string) {
  const t = useTranslations(`Enums.${group}` as "Enums.status");
  return (value: string | null | undefined) => {
    if (!value) return "—";
    return t.has(value) ? t(value) : value;
  };
}
