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
import { Clock } from "iconsax-react-v2";
import { cn } from "@/shared/lib/cn";

type AppTimePickerProps = {
  value?: string;
  onChange?: (value: string) => void;
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

type Meridiem = "AM" | "PM";

const hours = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const minutes = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, "0"),
);

function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return { hour12: "12", minute: "00", meridiem: "AM" as Meridiem };
  }

  const hour24 = Number(match[1]);
  const minuteNumber = Number(match[2]);
  const meridiem: Meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12Number = hour24 % 12 || 12;
  const snappedMinute = String(
    Math.min(55, Math.round(minuteNumber / 5) * 5),
  ).padStart(2, "0");

  return {
    hour12: String(hour12Number).padStart(2, "0"),
    minute: snappedMinute,
    meridiem,
  };
}

function toValue24(hour12: string, minute: string, meridiem: Meridiem) {
  let hour = Number(hour12) % 12;
  if (meridiem === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function formatDisplay(hour12: string, minute: string, meridiem: Meridiem) {
  return `${hour12}:${minute} ${meridiem === "AM" ? "ص" : "م"}`;
}

export function AppTimePicker({
  value = "12:00",
  onChange,
  className,
  disabled = false,
}: AppTimePickerProps) {
  const { hour12, minute, meridiem } = parseTime(value);
  const [open, setOpen] = useState(false);
  const [panelRect, setPanelRect] = useState<PanelRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const canPortal = typeof document !== "undefined";

  useLayoutEffect(() => {
    if (!open) return;

    function updatePanelRect() {
      const trigger = rootRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const panelHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const openUp = spaceBelow < panelHeight && rect.top > spaceBelow;

      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 16);
      setPanelRect({
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
        width,
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
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function commit(nextHour: string, nextMinute: string, nextMeridiem: Meridiem) {
    onChange?.(toValue24(nextHour, nextMinute, nextMeridiem));
  }

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
            style={panelStyle}
            className="app-time-panel"
            id={listId}
            role="dialog"
            aria-label="اختيار الوقت"
          >
            <div className="app-time-summary">
              <span className="app-time-chip is-active">{hour12}</span>
              <span className="app-time-separator">:</span>
              <span className="app-time-chip is-active">{minute}</span>
              <span className="app-time-chip is-active app-time-chip--period">
                {meridiem === "AM" ? "ص" : "م"}
              </span>
            </div>

            <div className="app-time-columns">
              <TimeColumn
                label="ساعة"
                values={hours}
                active={hour12}
                onSelect={(next) => commit(next, minute, meridiem)}
              />
              <TimeColumn
                label="دقيقة"
                values={minutes}
                active={minute}
                onSelect={(next) => commit(hour12, next, meridiem)}
              />
              <TimeColumn
                label="فترة"
                values={["AM", "PM"]}
                labels={{ AM: "ص", PM: "م" }}
                active={meridiem}
                onSelect={(next) => commit(hour12, minute, next as Meridiem)}
              />
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
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "icon-field group/icon-field w-full text-start",
          open && "is-open",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <span className="icon-field-badge" aria-hidden>
          <Clock size={18} color="currentColor" variant="Bold" />
        </span>
        <span className="icon-field-input flex items-center">
          {formatDisplay(hour12, minute, meridiem)}
        </span>
      </button>
      {panel}
    </div>
  );
}

function TimeColumn({
  label,
  values,
  labels,
  active,
  onSelect,
}: {
  label: string;
  values: string[];
  labels?: Record<string, string>;
  active: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="app-time-column">
      <p className="app-time-column-label">{label}</p>
      <div className="app-time-column-list">
        {values.map((item) => {
          const selected = item === active;

          return (
            <button
              key={item}
              type="button"
              onClick={() => onSelect(item)}
              className={cn("app-time-option", selected && "is-selected")}
            >
              {labels?.[item] ?? item}
            </button>
          );
        })}
      </div>
    </div>
  );
}
