"use client";

import { NotificationBing } from "iconsax-react-v2";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { ensureInboxHydrated, useInboxStore } from "@/application/stores/notification-inbox-store";
import { usePathname } from "@/i18n/navigation";
import type { PushPermission } from "@/presentation/hooks/use-push-notifications";
import { cn } from "@/shared/lib/cn";
import { formatDateTime, formatNumber } from "@/shared/lib/format";
import { pickNotificationLocale } from "@/shared/lib/notification-i18n";

type NotificationBellProps = {
  permission: PushPermission;
};

export function NotificationBell({ permission }: NotificationBellProps) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const pathname = usePathname();
  const items = useInboxStore((state) => state.items);
  const markRead = useInboxStore((state) => state.markRead);
  const markAllRead = useInboxStore((state) => state.markAllRead);
  const clear = useInboxStore((state) => state.clear);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const unread = items.filter((item) => !item.read).length;

  useEffect(() => {
    void ensureInboxHydrated();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenedAt(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenedAt(null);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("notifications")}
        title={t("notifications")}
        onClick={() => setOpenedAt(open ? null : pathname)}
        className={cn(
          "relative flex size-10 items-center justify-center rounded-full transition hover:bg-surface-muted hover:text-accent",
          open ? "bg-surface-muted text-accent" : "text-text-secondary",
        )}
      >
        <NotificationBing size={20} color="currentColor" variant={unread ? "Bold" : "Linear"} />
        {unread ? (
          <span className="absolute -top-0.5 -end-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-white ring-2 ring-surface">
            {unread > 9 ? "9+" : formatNumber(unread, locale)}
          </span>
        ) : permission === "default" ? (
          <span className="absolute top-2 end-2 size-2 rounded-full bg-danger ring-2 ring-surface" aria-hidden />
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("notifications")}
          className="absolute top-full end-0 z-50 mt-2 flex max-h-[70vh] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-text-primary">{t("notifications")}</span>
            {unread ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-accent-strong transition hover:underline"
              >
                {t("markAllRead")}
              </button>
            ) : null}
          </div>

          {permission === "denied" ? (
            <div className="border-b border-border bg-warning-soft px-4 py-3 text-xs text-text-primary">
              {t("notificationsBlocked")}
            </div>
          ) : null}

          {items.length ? (
            <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {items.map((item) => {
                const text = pickNotificationLocale(item.title, item.body, locale);
                return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => markRead(item.id)}
                    className={cn(
                      "flex w-full gap-3 rounded-lg px-3 py-2.5 text-start transition hover:bg-surface-muted",
                      !item.read && "bg-accent-soft/60",
                    )}
                  >
                    <span
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-accent")}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      {text.title ? (
                        <span className="block text-sm font-semibold text-text-primary">{text.title}</span>
                      ) : null}
                      {text.body ? (
                        <span className="mt-0.5 block whitespace-pre-line text-sm text-text-secondary">{text.body}</span>
                      ) : null}
                      <span className="mt-1 block text-xs text-text-muted">{formatDateTime(item.receivedAt, locale)}</span>
                    </span>
                  </button>
                </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-text-muted">
              <NotificationBing size={28} color="currentColor" variant="Linear" aria-hidden />
              {t("noNotifications")}
            </div>
          )}

          {items.length ? (
            <div className="border-t border-border p-1.5">
              <button
                type="button"
                onClick={clear}
                className="w-full rounded-lg px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft"
              >
                {t("clearNotifications")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
