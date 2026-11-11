"use client";

import { ArrowDown2, Logout, ProfileCircle } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useSessionStore } from "@/application/stores/session-store";
import { Link, usePathname } from "@/i18n/navigation";
import { useEnumLabel } from "@/presentation/components/ui/badge";
import { useLogout } from "@/presentation/hooks/use-logout";
import { cn } from "@/shared/lib/cn";

export function userInitials(fullName: string | undefined) {
  return (fullName ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

export function UserMenu({ basePath }: { basePath: "/admin" | "/institution" }) {
  const t = useTranslations("Common");
  const user = useSessionStore((state) => state.user);
  const roleLabel = useEnumLabel("role");
  const pathname = usePathname();
  const { logout, pending } = useLogout();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const initials = userInitials(user?.fullName);

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
    <div ref={rootRef} className="relative ms-1 sm:ms-2 sm:border-s sm:border-border sm:ps-3">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={user?.fullName ?? t("profile")}
        onClick={() => setOpenedAt(open ? null : pathname)}
        className={cn(
          "flex items-center gap-3 rounded-full p-0.5 text-start transition sm:rounded-xl sm:py-1 sm:ps-1 sm:pe-2",
          open ? "bg-surface-muted" : "hover:bg-surface-muted",
        )}
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-strong ring-2 ring-accent/25"
          aria-hidden
        >
          {initials || "—"}
        </span>
        <span className="hidden min-w-0 md:block">
          <span className="block max-w-[180px] truncate text-sm font-medium text-text-primary">{user?.fullName ?? "—"}</span>
          <span className="block text-xs text-text-muted">{user ? roleLabel(user.role) : "—"}</span>
        </span>
        <ArrowDown2
          size={14}
          color="currentColor"
          variant="Linear"
          className={cn("hidden text-text-muted transition-transform duration-200 sm:block", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="user-menu absolute top-full end-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-center gap-3 px-3 pt-2 pb-3 text-start">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-strong">
              {initials || "—"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-text-primary">{user?.fullName ?? "—"}</span>
              <span className="block truncate text-xs text-text-muted" dir="ltr">
                {user?.email ?? user?.phone ?? ""}
              </span>
            </span>
          </div>
          <div className="mx-1.5 mb-1 h-px bg-border" />
          <Link
            role="menuitem"
            href={`${basePath}/profile`}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface-muted hover:text-accent-strong"
          >
            <ProfileCircle size={18} color="currentColor" variant="Linear" />
            {t("profile")}
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => void logout()}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm font-medium text-danger transition hover:bg-danger-soft disabled:opacity-60"
          >
            <Logout size={18} color="currentColor" variant="Linear" className="rtl:-scale-x-100" />
            {t("logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
