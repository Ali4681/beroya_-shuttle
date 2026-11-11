"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/presentation/components/ui/panel";

export function SearchGroup({ title, count, children }: { title: ReactNode; count: number; children: ReactNode }) {
  const t = useTranslations("Search");
  return (
    <Card title={<>{title} <span className="text-sm font-normal text-text-muted">({count})</span></>}>
      {count ? <ul className="flex flex-col divide-y divide-border">{children}</ul> : <p className="text-start text-sm text-text-muted">{t("none")}</p>}
    </Card>
  );
}

export function SearchRow({
  href,
  title,
  meta,
  trailing,
}: {
  href: string;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 py-2.5 text-start transition hover:text-accent">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-text-primary">{title}</span>
          {meta ? <span className="truncate text-xs text-text-muted">{meta}</span> : null}
        </span>
        {trailing}
      </Link>
    </li>
  );
}
