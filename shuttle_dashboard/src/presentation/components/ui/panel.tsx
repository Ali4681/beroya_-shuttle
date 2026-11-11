"use client";

import { SearchNormal } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { icons, type IconName } from "@/presentation/components/sidebar/icons";
import { AppSelect } from "@/presentation/components/ui/app-select";
import { useEnumOptions } from "@/presentation/components/ui/badge";
import { Modal } from "@/presentation/components/ui/overlay";
import { Field, NotifyUsersCheckbox, TextArea } from "@/presentation/components/ui/form";
import { cn } from "@/shared/lib/cn";

export function PageSection({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-6 sm:py-6 lg:px-[25px]">{children}</section>;
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("panel-card", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="panel-card-title">{title}</h2> : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  tone,
  loading,
  hint,
}: {
  icon: IconName;
  label: ReactNode;
  value: ReactNode;
  tone?: "danger" | "warning" | "success";
  loading?: boolean;
  hint?: ReactNode;
}) {
  const Icon = icons[icon];
  return (
    <div className={cn("stat-card", tone && `stat-card--${tone}`)}>
      <span className="stat-card-icon" aria-hidden>
        <Icon size={22} color="currentColor" variant="Bulk" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 text-start">
        <span className="text-[13px] text-text-muted">{label}</span>
        {loading ? (
          <span className="skeleton h-7 w-16" />
        ) : (
          <span className="stat-card-value">{value}</span>
        )}
        {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
      </div>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 min-[340px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">{children}</div>;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="panel-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className="panel-tab"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="kv-grid">
      {items.map((item, index) => (
        <div key={index} className="kv-item text-start">
          <dt>{item.label}</dt>
          <dd>{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Search box that reports its value after the user stops typing. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const t = useTranslations("Common");
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);

  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => onChange(draft.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <div className={cn("relative w-full max-w-[340px]", className)}>
      <SearchNormal
        size={16}
        color="currentColor"
        variant="Linear"
        className="pointer-events-none absolute top-1/2 end-3 -translate-y-1/2 text-text-muted"
        aria-hidden
      />
      <input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder ?? t("search")}
        className="h-10 w-full rounded-lg border border-border bg-surface pe-9 ps-3 text-sm text-text-primary outline-none transition focus:border-accent/50"
      />
    </div>
  );
}

/** Select with a leading "All" option that clears the filter. */
export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
}) {
  const t = useTranslations("Common");
  return (
    <AppSelect
      size="sm"
      className={cn("w-full sm:w-[190px]", className)}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(next) => onChange(next || undefined)}
      options={[{ value: "", label: `${placeholder}: ${t("all")}` }, ...options]}
    />
  );
}

export function EnumFilterSelect({
  group,
  values,
  ...props
}: Omit<Parameters<typeof FilterSelect>[0], "options"> & { group: string; values: readonly string[] }) {
  return <FilterSelect {...props} options={useEnumOptions(group, values)} />;
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="panel-toolbar flex flex-wrap items-center gap-3">{children}</div>;
}

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  danger?: boolean;
  pending?: boolean;
  /** Shows a reason textarea; when `reasonRequired` the confirm needs ≥ 2 chars. */
  withReason?: boolean;
  reasonRequired?: boolean;
  reasonLabel?: ReactNode;
  withNotify?: boolean;
  onConfirm: (input: { reason: string; notifyUsers: boolean }) => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  danger,
  pending,
  withReason,
  reasonRequired,
  reasonLabel,
  withNotify,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const t = useTranslations("Common");
  const [reason, setReason] = useState("");
  const [notifyUsers, setNotifyUsers] = useState(false);
  const [error, setError] = useState<string>();
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setNotifyUsers(false);
      setError(undefined);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      onSubmit={(event) => {
        event.preventDefault();
        if (withReason && reasonRequired && reason.trim().length < 2) {
          setError("min2");
          return;
        }
        onConfirm({ reason: reason.trim(), notifyUsers });
      }}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={cn("btn", danger ? "btn-danger" : "btn-primary")} disabled={pending}>
            {pending ? t("saving") : (confirmLabel ?? t("confirm"))}
          </button>
        </>
      }
    >
      {description ? <p className="text-start text-sm leading-6 text-text-secondary">{description}</p> : null}
      {children}
      {withReason ? (
        <Field label={reasonLabel ?? t("reason")} required={reasonRequired} error={error}>
          <TextArea
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(undefined);
            }}
            invalid={Boolean(error)}
          />
        </Field>
      ) : null}
      {withNotify ? <NotifyUsersCheckbox checked={notifyUsers} onChange={setNotifyUsers} /> : null}
    </Modal>
  );
}
