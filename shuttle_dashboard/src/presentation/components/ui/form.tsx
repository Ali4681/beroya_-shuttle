"use client";

import { Add, Copy, CopySuccess, Eye, EyeSlash, Minus } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { AppSelect } from "@/presentation/components/ui/app-select";
import { useEnumOptions } from "@/presentation/components/ui/badge";
import { cn } from "@/shared/lib/cn";

const FOCUSABLE =
  "input:not([type='hidden']):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Scrolls to and focuses the first invalid field after validation fails. */
export function focusFirstInvalidField(root?: ParentNode | null) {
  if (typeof document === "undefined") return;

  const scope = root ?? document;
  const field =
    scope.querySelector<HTMLElement>("[data-field-invalid='true']") ??
    scope.querySelector<HTMLElement>("[aria-invalid='true']");
  if (!field) return;

  const target =
    field.matches(FOCUSABLE) ? field : field.querySelector<HTMLElement>(FOCUSABLE) ?? field;

  field.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    try {
      target.focus({ preventScroll: true });
    } catch {
      // Ignore elements that cannot take focus.
    }
  }, 120);
}

/** Waits for React to commit error markup, then focuses the first invalid field. */
export function scheduleFocusFirstInvalidField(root?: ParentNode | null) {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => focusFirstInvalidField(root));
  });
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const tv = useTranslations("Validation");
  let message: string | null = null;
  if (error?.startsWith("range:")) {
    const [, min, max] = error.split(":");
    message = tv("range", { min, max });
  } else if (error) {
    message = tv.has(error) ? tv(error) : error;
  }

  return (
    <div
      data-field-invalid={error ? "true" : undefined}
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
    >
      <span className="text-start text-sm font-medium text-text-primary">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {message ? (
        <p role="alert" className="text-start text-xs text-danger">
          {message}
        </p>
      ) : hint ? (
        <p className="text-start text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  invalid,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn("field-input", invalid && "field-input--error", className)}
    />
  );
}

export function PasswordInput({
  invalid,
  value,
  onChange,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean }) {
  const t = useTranslations("Common");
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = typeof value === "string" ? value : "";

  async function copy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative" dir="ltr">
      <input
        {...props}
        value={value}
        onChange={onChange}
        type={visible ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn("field-input pe-[4.5rem]", invalid && "field-input--error", className)}
      />
      <span className="absolute inset-y-0 end-1 flex items-center">
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          title={visible ? t("hidePassword") : t("showPassword")}
          className="flex size-8 items-center justify-center rounded-md text-text-muted transition hover:bg-surface-muted hover:text-accent"
        >
          {visible ? <EyeSlash size={16} color="currentColor" variant="Linear" /> : <Eye size={16} color="currentColor" variant="Linear" />}
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!text}
          aria-label={copied ? t("passwordCopied") : t("copyPassword")}
          title={copied ? t("passwordCopied") : t("copyPassword")}
          className="flex size-8 items-center justify-center rounded-md text-text-muted transition hover:bg-surface-muted hover:text-accent disabled:opacity-40"
        >
          {copied ? <CopySuccess size={16} color="currentColor" variant="Bold" /> : <Copy size={16} color="currentColor" variant="Linear" />}
        </button>
      </span>
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  placeholder,
  invalid,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("Common");
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const repeat = useRef<{ timeout?: number; interval?: number }>({});

  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const current = value === "" ? null : Number(value);
  const atMin = min != null && current != null && current <= min;
  const atMax = max != null && current != null && current >= max;

  function bump(direction: 1 | -1) {
    const raw = valueRef.current;
    const base = raw === "" || Number.isNaN(Number(raw)) ? null : Number(raw);
    const next = base == null ? (direction > 0 ? (min ?? 0) : (max ?? min ?? 0)) : clamp(base + direction * step);
    const text = String(next);
    valueRef.current = text;
    onChange(text);
  }

  function stop() {
    window.clearTimeout(repeat.current.timeout);
    window.clearInterval(repeat.current.interval);
    repeat.current = {};
  }

  function start(direction: 1 | -1) {
    bump(direction);
    stop();
    repeat.current.timeout = window.setTimeout(() => {
      repeat.current.interval = window.setInterval(() => bump(direction), 70);
    }, 380);
  }

  useEffect(() => stop, []);

  const stepButton = (direction: 1 | -1, blocked: boolean) => (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled || blocked}
      aria-label={direction > 0 ? t("increase") : t("decrease")}
      onPointerDown={(event) => {
        event.preventDefault();
        start(direction);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="number-field-btn"
    >
      {direction > 0 ? <Add size={16} color="currentColor" variant="Linear" /> : <Minus size={16} color="currentColor" variant="Linear" />}
    </button>
  );

  return (
    <div dir="ltr" className={cn("number-field", invalid && "is-invalid", disabled && "is-disabled")}>
      {stepButton(-1, atMin)}
      <div className="number-field-value">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              bump(event.key === "ArrowUp" ? 1 : -1);
            }
          }}
          onBlur={() => {
            if (value !== "" && !Number.isNaN(Number(value))) onChange(String(clamp(Number(value))));
          }}
          className="number-field-input"
          style={{ width: `${Math.max(2, (value || placeholder || "").length) + 1}ch` }}
        />
        {unit ? <span className="number-field-unit">{unit}</span> : null}
      </div>
      {stepButton(1, atMax)}
    </div>
  );
}

export function TextArea({
  invalid,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn("field-input", invalid && "field-input--error", className)}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  size,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  size?: "md" | "sm";
  className?: string;
}) {
  const t = useTranslations("Common");
  return (
    <AppSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder ?? t("choose")}
      disabled={disabled}
      size={size}
      className={className}
    />
  );
}

export function EnumSelect({
  group,
  values,
  ...props
}: Omit<Parameters<typeof SelectInput>[0], "options"> & { group: string; values: readonly string[] }) {
  return <SelectInput {...props} options={useEnumOptions(group, values)} />;
}

export function CheckboxField({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="field-check">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
      </label>
      {hint ? <p className="ps-7 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

/** Unified `notify_users` checkbox used by every dialog that may notify parents / riders. */
export function NotifyUsersCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const t = useTranslations("Common");
  return (
    <div className="rounded-lg border border-border bg-surface-muted px-3 py-3">
      <CheckboxField
        checked={checked}
        onChange={onChange}
        label={t("notifyUsers")}
        hint={t("notifyUsersHint")}
      />
    </div>
  );
}

/** Lists `details.errors` returned with VALIDATION_ERROR. */
export function ValidationList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="list-inside list-disc rounded-lg bg-danger-soft px-4 py-3 text-start text-xs text-danger" dir="auto">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}
