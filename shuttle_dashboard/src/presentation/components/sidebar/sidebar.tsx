"use client";

import { CloseCircle } from "iconsax-react-v2";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useSyncExternalStore } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { mediaUrl } from "@/infrastructure/api/uploads";
import { cn } from "@/shared/lib/cn";
import { ChevronIcon, NavIcon } from "@/presentation/components/sidebar/icons";
import {
  findActiveChildId,
  isGroupActive,
  isLinkActive,
  type NavItem,
  type NavSection,
} from "@/presentation/components/sidebar/nav";
import { BrandLockup } from "@/presentation/components/brand/brand-logo";
import { AppScrollArea } from "@/presentation/components/ui/app-scroll-area";

const OPEN_GROUPS_KEY = "beroya-sidebar-open-groups-v2";
const COLLAPSED_KEY = "beroya-sidebar-collapsed";

const defaultOpenGroups: Record<string, boolean> = {};

let openGroupsSnapshot = defaultOpenGroups;
const openGroupListeners = new Set<() => void>();

let collapsedSnapshot = false;
const collapsedListeners = new Set<() => void>();

function emitOpenGroups() {
  for (const listener of openGroupListeners) listener();
}

function emitCollapsed() {
  for (const listener of collapsedListeners) listener();
}

function readStoredOpenGroups() {
  try {
    const raw = window.localStorage.getItem(OPEN_GROUPS_KEY);
    if (!raw) return defaultOpenGroups;

    const stored = JSON.parse(raw) as Record<string, boolean>;
    return { ...defaultOpenGroups, ...stored };
  } catch {
    return defaultOpenGroups;
  }
}

function readStoredCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function getOpenGroupsSnapshot() {
  return openGroupsSnapshot;
}

function getOpenGroupsServerSnapshot() {
  return defaultOpenGroups;
}

function subscribeOpenGroups(listener: () => void) {
  openGroupListeners.add(listener);

  if (openGroupListeners.size === 1) {
    openGroupsSnapshot = readStoredOpenGroups();
  }

  return () => {
    openGroupListeners.delete(listener);
  };
}

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeDesktop(listener: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getDesktopServerSnapshot() {
  return true;
}

function getCollapsedSnapshot() {
  return collapsedSnapshot;
}

function getCollapsedServerSnapshot() {
  return false;
}

function subscribeCollapsed(listener: () => void) {
  collapsedListeners.add(listener);

  if (collapsedListeners.size === 1) {
    collapsedSnapshot = readStoredCollapsed();
  }

  return () => {
    collapsedListeners.delete(listener);
  };
}

function setOpenGroupsState(
  updater:
    | Record<string, boolean>
    | ((current: Record<string, boolean>) => Record<string, boolean>),
) {
  const next =
    typeof updater === "function" ? updater(openGroupsSnapshot) : updater;
  openGroupsSnapshot = next;

  try {
    window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures and keep the in-memory snapshot.
  }

  emitOpenGroups();
}

function setCollapsedState(next: boolean) {
  collapsedSnapshot = next;

  try {
    window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    // Ignore storage failures and keep the in-memory snapshot.
  }

  emitCollapsed();
}

export function Sidebar({
  sections,
  brandName,
  logoUrl,
  mobileOpen = false,
  onMobileClose,
}: {
  sections: NavSection[];
  brandName?: string | null;
  logoUrl?: string | null;
  /** Below `lg` the sidebar is an off-canvas drawer controlled by the header menu button. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const t = useTranslations("Nav");
  const tc = useTranslations("Common");
  const pathname = usePathname();
  const desktop = useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getDesktopServerSnapshot);
  const storedCollapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );
  const collapsed = desktop && storedCollapsed;
  const drawerOpen = !desktop && mobileOpen;

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onMobileClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, onMobileClose]);
  const openGroups = useSyncExternalStore(
    subscribeOpenGroups,
    getOpenGroupsSnapshot,
    getOpenGroupsServerSnapshot,
  );

  function toggleGroup(id: string) {
    if (collapsed) {
      setCollapsedState(false);
      setOpenGroupsState((current) => ({ ...current, [id]: true }));
      return;
    }

    setOpenGroupsState((current) => ({
      ...current,
      [id]: !(current[id] ?? false),
    }));
  }

  return (
    <aside
      inert={!desktop && !drawerOpen}
      onClick={(event) => {
        if (drawerOpen && (event.target as Element).closest("a")) onMobileClose?.();
      }}
      className={cn(
        "flex h-dvh shrink-0 flex-col overflow-hidden border-e border-border bg-surface pb-[10px] shadow-[var(--sidebar-shadow)]",
        "max-lg:fixed max-lg:inset-y-0 max-lg:start-0 max-lg:z-50 max-lg:w-[280px] max-lg:max-w-[86vw] max-lg:transition-transform max-lg:duration-300 max-lg:ease-out",
        !drawerOpen && "max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full",
        "lg:sticky lg:top-0 lg:z-20 lg:bg-surface/95 lg:backdrop-blur-md lg:transition-[width] lg:duration-300 lg:ease-out",
        collapsed ? "lg:w-[76px]" : "lg:w-[262px]",
      )}
    >
      <div
        dir="ltr"
        className={cn(
          "relative flex h-16 shrink-0 items-center gap-2 px-3 sm:h-[72px]",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {desktop ? (
          <button
            type="button"
            onClick={() => setCollapsedState(!collapsed)}
            aria-label={collapsed ? t("expandMenu") : t("collapseMenu")}
            className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-primary shadow-sm transition-all duration-200 hover:border-accent/55 hover:text-accent hover:shadow-[0_4px_10px_var(--accent-glow)]"
          >
            <ChevronIcon
              className={cn(
                "size-[11px] text-text-primary transition-transform duration-300 ease-out",
                collapsed ? "rotate-90" : "-rotate-90",
              )}
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label={tc("close")}
            className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-surface-muted hover:text-text-primary"
          >
            <CloseCircle size={22} color="currentColor" variant="Linear" />
          </button>
        )}
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center justify-end gap-3 overflow-visible transition-all duration-300",
            collapsed && "pointer-events-none absolute opacity-0",
          )}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo is served by the backend storage (MinIO/local)
            <img
              src={mediaUrl(logoUrl)}
              alt=""
              className="size-16 shrink-0 rounded-xl bg-white object-contain p-1 shadow-[var(--shadow-md)] ring-1 ring-border sm:size-[88px]"
            />
          ) : brandName ? null : (
            <BrandLockup />
          )}
          {brandName ? (
            <p className="min-w-0 truncate text-end text-[19px] font-bold tracking-tight text-accent">
              {brandName}
            </p>
          ) : null}
        </div>
      </div>

      <AppScrollArea
        as="nav"
        fade
        className="sidebar-scroll min-h-0 flex-1 px-[11px]"
      >
        {sections.map((section) => (
          <div key={section.id} className="mt-2 first:mt-0.5">
            {section.labelKey && !collapsed ? (
              <p className="px-4 pt-1.5 pb-1 text-start text-[12px] font-medium tracking-[0.01em] text-text-muted">
                {t(section.labelKey)}
              </p>
            ) : null}

            {collapsed && section.labelKey ? (
              <div className="mx-auto my-2 h-px w-8 bg-border" />
            ) : null}

            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <SidebarEntry
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  open={openGroups[item.id] ?? false}
                  onToggle={() => toggleGroup(item.id)}
                  t={t}
                />
              ))}
            </div>
          </div>
        ))}
      </AppScrollArea>
    </aside>
  );
}

function SidebarEntry({
  item,
  pathname,
  collapsed,
  open,
  onToggle,
  t,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  const groupActive = isGroupActive(item, pathname);
  const linkActive = isLinkActive(item.href, pathname);
  const label = t(item.labelKey);

  if (item.children) {
    return (
      <div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          title={collapsed ? label : undefined}
          className={cn(
            "group flex h-[38px] items-center gap-2 rounded-[6px] text-[13.5px] font-medium transition-all duration-200",
            collapsed ? "w-10 justify-center px-0" : "w-full px-4 py-2",
            groupActive
              ? "sidebar-item-active shadow-[0_2px_10px_var(--accent-glow)]"
              : "text-text-primary hover:bg-surface-muted",
          )}
        >
          <NavIcon
            name={item.icon}
            className={cn(
              "size-5 shrink-0 transition-transform duration-200",
              !groupActive && "group-hover:scale-105",
            )}
          />
          {collapsed ? null : (
            <>
              <span className="flex-1 text-start">{label}</span>
              <ChevronIcon
                className={cn(
                  "transition-transform duration-300 ease-out",
                  groupActive ? "text-white" : "text-text-primary",
                  open ? "rotate-0" : "rotate-90",
                )}
              />
            </>
          )}
        </button>

        {collapsed ? null : (
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out",
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              <Suspense fallback={<ChildLinks item={item} activeId={null} t={t} />}>
                <ActiveChildLinks item={item} pathname={pathname} t={t} />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href ?? "/"}
      aria-current={linkActive ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex h-[38px] items-center gap-2 rounded-[6px] text-[13.5px] font-medium transition-all duration-200",
        collapsed ? "w-10 justify-center px-0" : "w-full px-4 py-2",
        linkActive
          ? "sidebar-item-active shadow-[0_2px_10px_var(--accent-glow)]"
          : "text-text-primary hover:bg-surface-muted",
      )}
    >
      <NavIcon
        name={item.icon}
        className={cn(
          "size-5 shrink-0 transition-transform duration-200",
          !linkActive && "group-hover:scale-105",
        )}
      />
      {collapsed ? null : <span className="text-start">{label}</span>}
    </Link>
  );
}

function ActiveChildLinks({ item, pathname, t }: { item: NavItem; pathname: string; t: (key: string) => string }) {
  const search = useSearchParams();
  return <ChildLinks item={item} activeId={findActiveChildId(item, pathname, search)} t={t} />;
}

function ChildLinks({ item, activeId, t }: { item: NavItem; activeId: string | null; t: (key: string) => string }) {
  return (
    <div className="flex flex-col py-0.5">
      {item.children?.map((child) => {
        const active = child.id === activeId;

        return (
          <Link
            key={child.id}
            href={child.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group/child flex items-center gap-2.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-all duration-200",
              active
                ? "bg-accent-soft text-text-primary"
                : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center">
              <span className="relative size-[10px]">
                <span
                  className={cn(
                    "absolute top-[1.25px] left-[1.25px] size-[7.5px] rounded-full border-[1.5px] border-solid border-text-primary transition-all duration-200",
                    active ? "bg-text-primary/10" : "group-hover/child:border-accent",
                  )}
                />
              </span>
            </span>
            <span className="text-start leading-5">{t(child.labelKey)}</span>
          </Link>
        );
      })}
    </div>
  );
}
