import type { InstitutionType } from "@/domain/models/enums";
import type { IconName } from "@/presentation/components/sidebar/icons";

export type NavChild = {
  id: string;
  labelKey: string;
  href: string;
};

export type NavItem = {
  id: string;
  labelKey: string;
  icon: IconName;
  href?: string;
  children?: NavChild[];
  /** Restricts the entry to these institution types (institution panel only). */
  types?: InstitutionType[];
};

export type NavSection = {
  id: string;
  labelKey?: string;
  items: NavItem[];
};

export const adminNav: NavSection[] = [
  {
    id: "home",
    items: [{ id: "dashboard", labelKey: "dashboard", icon: "home", href: "/admin" }],
  },
  {
    id: "customers",
    labelKey: "customers",
    items: [
      {
        id: "institutions",
        labelKey: "institutions",
        icon: "building",
        children: [
          { id: "all", labelKey: "allInstitutions", href: "/admin/institutions" },
          { id: "schools", labelKey: "schools", href: "/admin/institutions?type=SCHOOL" },
          { id: "universities", labelKey: "universities", href: "/admin/institutions?type=UNIVERSITY" },
          { id: "companies", labelKey: "companies", href: "/admin/institutions?type=COMPANY" },
        ],
      },
      {
        id: "subscriptions",
        labelKey: "subscriptions",
        icon: "subscription",
        children: [
          { id: "current", labelKey: "currentSubscriptions", href: "/admin/subscriptions?status=ACTIVE" },
          { id: "expired", labelKey: "expiredSubscriptions", href: "/admin/subscriptions?status=EXPIRED" },
          { id: "expiring", labelKey: "expiringSubscriptions", href: "/admin/subscriptions?tab=expiring" },
        ],
      },
    ],
  },
  {
    id: "beroya-operations",
    labelKey: "beroyaOperations",
    items: [
      {
        id: "beroya-resources",
        labelKey: "beroyaResources",
        icon: "vehicle",
        children: [
          { id: "drivers", labelKey: "drivers", href: "/admin/drivers" },
          { id: "vehicles", labelKey: "vehicles", href: "/admin/vehicles" },
        ],
      },
      {
        id: "live-ops",
        labelKey: "liveOperations",
        icon: "live",
        children: [
          { id: "trips", labelKey: "trips", href: "/admin/trips" },
          { id: "live-map", labelKey: "directMap", href: "/admin/live-map" },
          { id: "incidents", labelKey: "incidents", href: "/admin/incidents" },
        ],
      },
    ],
  },
  {
    id: "system",
    labelKey: "systemAdmin",
    items: [
      { id: "audit", labelKey: "activityLog", icon: "history", href: "/admin/audit-logs" },
      { id: "platform", labelKey: "platformSettings", icon: "platform", href: "/admin/platform" },
      { id: "app-branding", labelKey: "appBranding", icon: "branding", href: "/admin/app-branding" },
      { id: "settings", labelKey: "settings", icon: "settings", href: "/admin/settings" },
      { id: "support", labelKey: "support", icon: "support", href: "/admin/support" },
    ],
  },
];

export const institutionNav: NavSection[] = [
  {
    id: "home",
    items: [{ id: "dashboard", labelKey: "dashboard", icon: "home", href: "/institution" }],
  },
  {
    id: "live",
    labelKey: "operations",
    items: [
      { id: "live-map", labelKey: "liveMap", icon: "live", href: "/institution/live-map" },
      { id: "trips", labelKey: "trips", icon: "car", href: "/institution/trips" },
      { id: "incidents", labelKey: "incidents", icon: "incident", href: "/institution/incidents" },
      { id: "notifications", labelKey: "notifications", icon: "bell", href: "/institution/notifications" },
    ],
  },
  {
    id: "network",
    labelKey: "network",
    items: [
      { id: "routes", labelKey: "routes", icon: "route", href: "/institution/routes" },
      { id: "branches", labelKey: "branches", icon: "branch", href: "/institution/branches" },
      { id: "meeting-points", labelKey: "meetingPoints", icon: "location", href: "/institution/meeting-points" },
    ],
  },
  {
    id: "people",
    labelKey: "people",
    items: [
      {
        id: "students",
        labelKey: "students",
        icon: "student",
        href: "/institution/students",
        types: ["SCHOOL"],
      },
      {
        id: "parents",
        labelKey: "parents",
        icon: "people",
        href: "/institution/parents",
        types: ["SCHOOL"],
      },
      {
        id: "university-students",
        labelKey: "universityStudents",
        icon: "university",
        href: "/institution/university-students",
        types: ["UNIVERSITY"],
      },
    ],
  },
  {
    id: "resources",
    labelKey: "resources",
    items: [
      { id: "drivers", labelKey: "drivers", icon: "driver", href: "/institution/drivers" },
      { id: "vehicles", labelKey: "vehicles", icon: "vehicle", href: "/institution/vehicles" },
      { id: "attendants", labelKey: "attendants", icon: "attendant", href: "/institution/attendants" },
    ],
  },
  {
    id: "admin",
    labelKey: "administration",
    items: [
      { id: "search", labelKey: "search", icon: "search", href: "/institution/search" },
      { id: "audit", labelKey: "auditLogs", icon: "history", href: "/institution/audit-logs" },
      { id: "settings", labelKey: "settings", icon: "settings", href: "/institution/settings" },
    ],
  },
];

const PANEL_ROOTS = new Set(["/admin", "/institution"]);

export function isLinkActive(href: string | undefined, pathname: string) {
  if (!href) return false;
  if (href === pathname) return true;
  if (PANEL_ROOTS.has(href)) return false;
  return pathname.startsWith(`${href}/`);
}

function splitHref(href: string) {
  const [path, query = ""] = href.split("?");
  return { path, params: [...new URLSearchParams(query).entries()] };
}

export function isGroupActive(item: NavItem, pathname: string) {
  return item.children?.some((child) => isLinkActive(splitHref(child.href).path, pathname)) ?? false;
}

/**
 * Children may carry a query string (e.g. `?type=SCHOOL`). A child with a query wins when all of its
 * params match; a plain child is active only when none of its siblings' query keys are set.
 */
export function findActiveChildId(
  item: NavItem,
  pathname: string,
  search: Pick<URLSearchParams, "get" | "has">,
) {
  const children = (item.children ?? []).map((child) => ({ id: child.id, ...splitHref(child.href) }));
  const exact = children.find(
    (child) =>
      child.params.length > 0 &&
      child.path === pathname &&
      child.params.every(([key, value]) => search.get(key) === value),
  );
  if (exact) return exact.id;

  const siblingKeys = new Set(children.flatMap((child) => child.params.map(([key]) => key)));
  const plain = children.find(
    (child) =>
      child.params.length === 0 &&
      isLinkActive(child.path, pathname) &&
      (child.path !== pathname || ![...siblingKeys].some((key) => search.has(key))),
  );
  return plain?.id ?? null;
}

export function findActiveGroupId(sections: NavSection[], pathname: string) {
  for (const section of sections) {
    for (const item of section.items) {
      if (isGroupActive(item, pathname)) return item.id;
    }
  }
  return null;
}

export function filterNav(sections: NavSection[], type: InstitutionType | null | undefined) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.types || !type || item.types.includes(type)),
    }))
    .filter((section) => section.items.length > 0);
}
