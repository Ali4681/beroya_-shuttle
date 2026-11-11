"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ChevronIcon } from "@/presentation/components/sidebar/icons";
import { cn } from "@/shared/lib/cn";

export type AppSelectOption = {
  value: string;
  label: string;
};

type AppSelectProps = {
  placeholder: string;
  options?: AppSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  size?: "md" | "sm";
  className?: string;
  disabled?: boolean;
};

type PanelRect = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  openUp: boolean;
};

export function AppSelect({
  placeholder,
  options = [],
  value = "",
  onChange,
  size = "md",
  className,
  disabled = false,
}: AppSelectProps) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [panelRect, setPanelRect] = useState<PanelRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const canPortal = typeof document !== "undefined";

  useLayoutEffect(() => {
    if (!open) return;

    function updatePanelRect() {
      const trigger = rootRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const panelHeight = Math.min(224, Math.max(48, options.length * 42 + 16));
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const openUp = spaceBelow < panelHeight && rect.top > spaceBelow;

      setPanelRect({
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        left: rect.left,
        width: rect.width,
        openUp,
      });
    }

    updatePanelRect();

    window.addEventListener("resize", updatePanelRect);
    window.addEventListener("scroll", updatePanelRect, true);

    return () => {
      window.removeEventListener("resize", updatePanelRect);
      window.removeEventListener("scroll", updatePanelRect, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (!options.length) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const start = selectedIndex >= 0 ? selectedIndex : -1;
        const nextIndex =
          (start + direction + options.length) % options.length;
        onChange?.(options[nextIndex].value);
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, options, selectedIndex, onChange]);

  const panelStyle: CSSProperties | undefined = panelRect
    ? {
        position: "fixed",
        top: panelRect.top,
        bottom: panelRect.bottom,
        left: panelRect.left,
        width: panelRect.width,
        zIndex: 80,
      }
    : undefined;

  const panel =
    open && panelRect && canPortal
      ? createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className={cn(
              "transition duration-200",
              panelRect.openUp ? "origin-bottom" : "origin-top",
            )}
          >
            <ul
              id={listId}
              role="listbox"
              className="app-scroll max-h-56 overflow-auto rounded-[10px] border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-lg)]"
            >
            {options.length === 0 ? (
              <li className="px-3 py-2.5 text-center text-sm text-[var(--text-muted)]">
                {t("noOptions")}
              </li>
            ) : (
                options.map((option) => {
                  const active = option.value === value;

                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onChange?.(option.value);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-start text-sm transition",
                          active
                            ? "bg-accent-soft font-medium text-accent-strong"
                            : "text-text-primary hover:bg-surface-muted",
                        )}
                      >
                        <span className="min-w-0 truncate">{option.label}</span>
                        {active ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={cn("relative", open && "z-30", className)}
    >
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "group/select flex w-full items-center gap-3 border bg-surface text-start transition-all duration-200",
          "border-border",
          "hover:border-accent hover:bg-field-hover hover:shadow-[0_4px_12px_var(--accent-glow)]",
          "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25",
          open &&
            "border-accent bg-field-hover shadow-[0_4px_12px_var(--accent-glow)] ring-2 ring-accent/20",
          size === "md" && "h-11 rounded-lg px-3",
          size === "sm" && "h-10 rounded-lg px-3",
          disabled &&
            "cursor-not-allowed opacity-50 hover:border-border hover:bg-surface hover:shadow-none",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            selected ? "font-medium text-text-primary" : "text-text-muted",
          )}
        >
          {selected?.label ?? placeholder}
        </span>

        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md transition-all duration-200",
            open
              ? "bg-accent text-white shadow-[0_2px_6px_var(--accent-glow)]"
              : "bg-chip text-text-secondary group-hover/select:bg-accent-soft group-hover/select:text-accent",
          )}
        >
          <ChevronIcon
            className={cn(
              "size-[10px] transition-transform duration-200",
              open ? "rotate-180" : "rotate-0",
            )}
          />
        </span>
      </button>

      {panel}
    </div>
  );
}
