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
import { ArrowLeft2, ArrowRight2, Calendar, CloseCircle } from "iconsax-react-v2";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/shared/lib/cn";
import { localeTag, todayISO } from "@/shared/lib/format";

type AppDatePickerProps = {
  /** YYYY-MM-DD, or "" when empty. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  clearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  size?: "md" | "sm";
  className?: string;
};

type View = "days" | "months" | "years";

type PanelRect = { top?: number; bottom?: number; left: number; width: number; openUp: boolean };

const PANEL_WIDTH = 312;
const PANEL_HEIGHT = 404;

function parse(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function toISO(y: number, m: number, d: number) {
  return todayISO(new Date(y, m, d));
}

export function AppDatePicker({
  value,
  onChange,
  placeholder,
  min,
  max,
  clearable = false,
  invalid,
  disabled = false,
  size = "md",
  className,
}: AppDatePickerProps) {
  const t = useTranslations("DatePicker");
  const locale = useLocale();
  const tag = localeTag(locale);
  const rtl = locale === "ar";
  const weekStart = rtl ? 6 : 1;

  const today = todayISO();
  const selected = parse(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [cursor, setCursor] = useState(() => {
    const base = selected ?? parse(today)!;
    return { y: base.y, m: base.m };
  });
  const [focused, setFocused] = useState(value || today);
  const [panelRect, setPanelRect] = useState<PanelRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const canPortal = typeof document !== "undefined";

  const isDisabledDay = (iso: string) => Boolean((min && iso < min) || (max && iso > max));

  function openPanel() {
    const base = parse(value) ?? parse(today)!;
    setCursor({ y: base.y, m: base.m });
    setFocused(value || today);
    setView("days");
    setOpen(true);
  }

  function pick(iso: string) {
    if (isDisabledDay(iso)) return;
    onChange(iso);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const next = new Date(current.y, current.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  }

  function shift(delta: number) {
    if (view === "days") shiftMonth(delta);
    else if (view === "months") setCursor((c) => ({ ...c, y: c.y + delta }));
    else setCursor((c) => ({ ...c, y: c.y + delta * 12 }));
  }

  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const trigger = rootRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const openUp = spaceBelow < PANEL_HEIGHT && rect.top > spaceBelow;
      const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
      const preferred = rtl ? rect.right - width : rect.left;
      const left = Math.min(Math.max(8, preferred), window.innerWidth - width - 8);
      setPanelRect({
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        left,
        width,
        openUp,
      });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, rtl]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (view !== "days") return;
      const steps: Record<string, number> = {
        ArrowLeft: rtl ? 1 : -1,
        ArrowRight: rtl ? -1 : 1,
        ArrowUp: -7,
        ArrowDown: 7,
      };
      if (event.key in steps) {
        event.preventDefault();
        const base = parse(focused) ?? parse(today)!;
        const next = new Date(base.y, base.m, base.d + steps[event.key]);
        setFocused(toISO(next.getFullYear(), next.getMonth(), next.getDate()));
        setCursor({ y: next.getFullYear(), m: next.getMonth() });
      } else if (event.key === "Enter") {
        event.preventDefault();
        pick(focused);
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  const monthTitle = new Intl.DateTimeFormat(tag, { month: "long" }).format(new Date(cursor.y, cursor.m, 1));
  const display = selected
    ? new Intl.DateTimeFormat(tag, { year: "numeric", month: "long", day: "numeric" }).format(
        new Date(selected.y, selected.m, selected.d),
      )
    : null;

  const weekdayFormat = new Intl.DateTimeFormat(tag, { weekday: "short" });
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    // 2024-01-01 is a Monday (ISO weekday 1).
    const offset = (weekStart - 1 + i) % 7;
    return weekdayFormat.format(new Date(2024, 0, 1 + offset));
  });

  const firstOfMonth = new Date(cursor.y, cursor.m, 1);
  const lead = (firstOfMonth.getDay() - (weekStart % 7) + 7) % 7;
  const days = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(cursor.y, cursor.m, 1 - lead + i);
    return {
      iso: toISO(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      outside: date.getMonth() !== cursor.m,
    };
  });

  const monthFormat = new Intl.DateTimeFormat(tag, { month: "short" });
  const yearStart = cursor.y - (((cursor.y % 12) + 12) % 12);

  const PrevIcon = rtl ? ArrowRight2 : ArrowLeft2;
  const NextIcon = rtl ? ArrowLeft2 : ArrowRight2;

  const panelStyle: CSSProperties | undefined = panelRect
    ? {
        position: "fixed",
        top: panelRect.top,
        bottom: panelRect.bottom,
        left: panelRect.left,
        width: panelRect.width,
        zIndex: 90,
      }
    : undefined;

  const panel =
    open && panelRect && canPortal
      ? createPortal(
          <div
            ref={panelRef}
            id={dialogId}
            role="dialog"
            aria-label={t("aria")}
            dir={rtl ? "rtl" : "ltr"}
            style={panelStyle}
            className={cn("app-date-panel", panelRect.openUp ? "is-up" : "is-down")}
          >
            <div className="app-date-header">
              <button type="button" className="app-date-nav" onClick={() => shift(-1)} aria-label={t("previous")}>
                <PrevIcon size={16} color="currentColor" variant="Linear" />
              </button>
              <div className="flex items-center gap-1">
                {view === "years" ? (
                  <span className="app-date-title">
                    {yearStart} – {yearStart + 11}
                  </span>
                ) : (
                  <>
                    {view === "days" ? (
                      <button type="button" className="app-date-title" onClick={() => setView("months")}>
                        {monthTitle}
                      </button>
                    ) : null}
                    <button type="button" className="app-date-title" onClick={() => setView("years")}>
                      {cursor.y}
                    </button>
                  </>
                )}
              </div>
              <button type="button" className="app-date-nav" onClick={() => shift(1)} aria-label={t("next")}>
                <NextIcon size={16} color="currentColor" variant="Linear" />
              </button>
            </div>

            {view === "days" ? (
              <div key={`${cursor.y}-${cursor.m}`} className="app-date-body">
                <div className="app-date-weekdays">
                  {weekdays.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
                <div className="app-date-grid" role="grid">
                  {days.map((item) => {
                    const isSelected = item.iso === value;
                    const isToday = item.iso === today;
                    const blocked = isDisabledDay(item.iso);
                    return (
                      <button
                        key={item.iso}
                        type="button"
                        role="gridcell"
                        aria-selected={isSelected}
                        disabled={blocked}
                        onClick={() => pick(item.iso)}
                        onMouseEnter={() => setFocused(item.iso)}
                        className={cn(
                          "app-date-day",
                          item.outside && "is-outside",
                          isToday && "is-today",
                          isSelected && "is-selected",
                          item.iso === focused && !isSelected && "is-focused",
                        )}
                      >
                        {item.day}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : view === "months" ? (
              <div key={`m-${cursor.y}`} className="app-date-body app-date-cells">
                {Array.from({ length: 12 }, (_, m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setCursor((c) => ({ ...c, m }));
                      setView("days");
                    }}
                    className={cn(
                      "app-date-cell",
                      selected?.y === cursor.y && selected.m === m && "is-selected",
                      parse(today)!.y === cursor.y && parse(today)!.m === m && "is-today",
                    )}
                  >
                    {monthFormat.format(new Date(cursor.y, m, 1))}
                  </button>
                ))}
              </div>
            ) : (
              <div key={`y-${yearStart}`} className="app-date-body app-date-cells">
                {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setCursor((c) => ({ ...c, y }));
                      setView("months");
                    }}
                    className={cn(
                      "app-date-cell",
                      selected?.y === y && "is-selected",
                      parse(today)!.y === y && "is-today",
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            <div className="app-date-footer">
              <button
                type="button"
                className="app-date-chip is-primary"
                disabled={isDisabledDay(today)}
                onClick={() => pick(today)}
              >
                {t("today")}
              </button>
              {clearable && value ? (
                <button
                  type="button"
                  className="app-date-chip"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  {t("clear")}
                </button>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", open && "z-30", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={cn(
          "group/date flex w-full items-center gap-3 border bg-surface text-start transition-all duration-200",
          invalid ? "border-danger" : "border-border",
          "hover:border-accent hover:bg-field-hover hover:shadow-[0_4px_12px_var(--accent-glow)]",
          "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25",
          open && "border-accent bg-field-hover shadow-[0_4px_12px_var(--accent-glow)] ring-2 ring-accent/20",
          size === "md" ? "h-11 rounded-lg ps-3 pe-1.5" : "h-10 rounded-lg ps-3 pe-1.5",
          disabled && "cursor-not-allowed opacity-50 hover:border-border hover:bg-surface hover:shadow-none",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate text-sm", display ? "font-medium text-text-primary" : "text-text-muted")}>
          {display ?? placeholder ?? t("placeholder")}
        </span>
        {clearable && value && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={t("clear")}
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-text-muted transition hover:bg-danger-soft hover:text-danger"
          >
            <CloseCircle size={15} color="currentColor" variant="Linear" />
          </span>
        ) : null}
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md transition-all duration-200",
            open
              ? "bg-accent text-white shadow-[0_2px_6px_var(--accent-glow)]"
              : "bg-chip text-text-secondary group-hover/date:bg-accent-soft group-hover/date:text-accent",
          )}
        >
          <Calendar size={16} color="currentColor" variant={open ? "Bold" : "Linear"} />
        </span>
      </button>
      {panel}
    </div>
  );
}
