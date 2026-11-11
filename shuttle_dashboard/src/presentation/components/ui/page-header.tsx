import type { ReactNode } from "react";
import { icons, type IconName } from "@/presentation/components/sidebar/icons";

type PageHeaderProps = {
  icon: IconName;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ icon, title, subtitle, meta, actions }: PageHeaderProps) {
  const Icon = icons[icon];

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
      <div className="page-title min-w-0">
        <span className="page-title-icon" aria-hidden>
          <span className="page-title-icon-inner">
            <Icon size={24} color="currentColor" variant="Linear" />
          </span>
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="page-title-text">{title}</h1>
            {meta}
          </div>
          {subtitle ? <div className="text-[13px] text-text-muted">{subtitle}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
