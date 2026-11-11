"use client";

import { Colorfilter } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { cn } from "@/shared/lib/cn";

type ColorFieldProps = {
  value: string;
  onChange: (value: string) => void;
  variant?: "detailed" | "compact";
};

export function ColorField({
  value,
  onChange,
  variant = "detailed",
}: ColorFieldProps) {
  const t = useTranslations("ColorField");
  const colorInputRef = useRef<HTMLInputElement>(null);
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000";

  function openPalette() {
    const input = colorInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  }

  return (
    <div className="group/color relative">
      <button
        type="button"
        onClick={openPalette}
        className={cn(
          "flex w-full items-center gap-3 border border-[var(--border)] bg-[var(--surface)] text-start transition-all duration-200",
          variant === "detailed" &&
            "h-12 rounded-xl px-3 shadow-[0_1px_2px_rgba(165,163,174,0.12)] hover:-translate-y-px hover:border-[var(--accent)] hover:bg-[var(--field-hover)] hover:shadow-[0_4px_12px_rgba(34,224,238,0.18)] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25",
          variant === "compact" &&
            "h-11 rounded-lg px-3 hover:border-[var(--accent)] hover:bg-[var(--field-hover)] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25",
        )}
      >
        <span className="relative size-7 shrink-0 overflow-hidden rounded-md border border-[var(--border)] shadow-inner">
          <span
            className="absolute inset-0 transition group-hover/color:scale-105"
            style={{ background: normalized }}
            aria-hidden
          />
          <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.35)_0%,transparent_45%)]" />
        </span>

        {variant === "detailed" ? (
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-[var(--text-muted)] transition group-hover/color:text-[var(--accent)]">
              {t("pickColor")}
            </span>
            <span className="block font-mono text-sm font-semibold tracking-wide text-[var(--text-primary)]">
              {normalized.toUpperCase()}
            </span>
          </span>
        ) : (
          <span className="min-w-0 flex-1 font-mono text-sm font-medium tracking-wide text-[var(--text-primary)]">
            {normalized.toUpperCase()}
          </span>
        )}

        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--chip-bg)] text-[var(--text-secondary)] transition group-hover/color:bg-[var(--accent)] group-hover/color:text-white">
          <Colorfilter size={16} color="currentColor" variant="Linear" />
        </span>
      </button>

      <input
        ref={colorInputRef}
        type="color"
        value={normalized}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="pointer-events-none absolute size-0 opacity-0"
        tabIndex={-1}
        aria-hidden
      />

      {variant === "detailed" ? (
        <label className="mt-1.5 flex items-center gap-2 px-1">
          <span className="text-[11px] text-[var(--text-muted)]">{t("enterHex")}</span>
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => {
              if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
                onChange(normalized.toUpperCase());
              }
            }}
            dir="ltr"
            className="h-7 w-[96px] rounded-md border border-transparent bg-[var(--surface-muted)] px-2 font-mono text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]/50 focus:bg-[var(--surface)]"
            spellCheck={false}
          />
        </label>
      ) : null}
    </div>
  );
}
