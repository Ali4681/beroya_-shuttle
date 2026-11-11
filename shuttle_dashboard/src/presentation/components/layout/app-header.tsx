"use client";

import { Menu, SearchNormal } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { NotificationBell } from "@/presentation/components/layout/notification-bell";
import { UserMenu } from "@/presentation/components/layout/user-menu";
import { ThemeToggle } from "@/presentation/components/theme/theme-toggle";
import { usePushNotifications } from "@/presentation/hooks/use-push-notifications";

type AppHeaderProps = {
  languageSwitcher?: ReactNode;
  /** Panel root, e.g. `/admin` or `/institution`. */
  basePath: "/admin" | "/institution";
  /** Opens the sidebar drawer on screens below `lg`. */
  onMenuClick?: () => void;
};

export function AppHeader({ languageSwitcher, basePath, onMenuClick }: AppHeaderProps) {
  const t = useTranslations("Common");
  const tNav = useTranslations("Nav");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const push = usePushNotifications();

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    router.push(`${basePath}/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur-md sm:h-[72px] sm:gap-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={tNav("expandMenu")}
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-primary transition hover:bg-surface-muted hover:text-accent lg:hidden"
      >
        <Menu size={22} color="currentColor" variant="Linear" />
      </button>

      <form onSubmit={onSearch} className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
        <div className="relative w-full max-w-[320px]">
          <SearchNormal
            size={18}
            color="currentColor"
            variant="Linear"
            className="pointer-events-none absolute top-1/2 end-3 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 w-full rounded-full border border-border bg-surface-muted pe-10 ps-4 text-sm text-text-primary outline-none transition focus:border-accent/50 focus:bg-surface"
          />
        </div>
      </form>
      <div className="flex-1 md:hidden" />

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Link
          href={`${basePath}/search`}
          aria-label={t("search")}
          className="flex size-10 items-center justify-center rounded-full text-text-secondary transition hover:bg-surface-muted hover:text-accent md:hidden"
        >
          <SearchNormal size={20} color="currentColor" variant="Linear" />
        </Link>
        {push.permission === "unsupported" ? null : (
          <NotificationBell permission={push.permission} />
        )}
        {languageSwitcher}
        <ThemeToggle />
        <UserMenu basePath={basePath} />
      </div>
    </header>
  );
}
