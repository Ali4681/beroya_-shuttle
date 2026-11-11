"use client";

import { ArrowUp } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/presentation/components/layout/language-switcher";
import { ThemeToggle } from "@/presentation/components/theme/theme-toggle";
import { cn } from "@/shared/lib/cn";
import { LandingClosing } from "./landing-closing";
import { LandingFeatures } from "./landing-features";
import { LandingHero } from "./landing-hero";
import { useActiveSection, useIdleZones, useReveal, useScrollEffects } from "./landing-hooks";
import { LandingShowcase } from "./landing-showcase";
import { BrandLockup } from "@/presentation/components/brand/brand-logo";
import { ArrowIcon } from "./landing-ui";

const SECTIONS = ["features", "ecosystem", "how", "apps", "safety", "faq"] as const;

type LandingViewProps = {
  year: number;
  dashboardHref: string;
  signedIn: boolean;
};

export function LandingView({ year, dashboardHref, signedIn }: LandingViewProps) {
  const rootRef = useRef<HTMLElement>(null);
  const scrolled = useScrollEffects(rootRef);
  const active = useActiveSection(rootRef, SECTIONS);
  useReveal(rootRef);
  useIdleZones(rootRef, ".ld-hero, .ld-section");

  function scrollToId(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const target = rootRef.current?.querySelector<HTMLElement>(`#${id}`);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main ref={rootRef} className="ld-root relative min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto">
      <LandingNav
        scrolled={scrolled}
        active={active}
        signedIn={signedIn}
        dashboardHref={dashboardHref}
        onNavigate={scrollToId}
      />

      <LandingHero onNavigate={scrollToId} />
      <LandingFeatures />
      <LandingShowcase />
      <LandingClosing onNavigate={scrollToId} />

      <LandingFooter year={year} dashboardHref={dashboardHref} onNavigate={scrollToId} />
    </main>
  );
}

type NavigateHandler = (event: MouseEvent<HTMLAnchorElement>, id: string) => void;

function LandingNav({
  scrolled,
  active,
  signedIn,
  dashboardHref,
  onNavigate,
}: {
  scrolled: boolean;
  active: string | null;
  signedIn: boolean;
  dashboardHref: string;
  onNavigate: NavigateHandler;
}) {
  const t = useTranslations("Landing.nav");
  const tApp = useTranslations("App");
  const [open, setOpen] = useState(false);

  function navigate(event: MouseEvent<HTMLAnchorElement>, id: string) {
    setOpen(false);
    onNavigate(event, id);
  }

  return (
    <header className={cn("ld-nav", scrolled && "is-scrolled", open && "is-open")}>
      <div className="ld-nav-inner">
        <a
          href="#top"
          className="ld-nav-brand"
          aria-label={t("home")}
          onClick={(event) => navigate(event, "top")}
        >
          <BrandLockup />
        </a>

        <nav className="ld-nav-links" aria-label={tApp("name")}>
          {SECTIONS.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(event) => navigate(event, id)}
              className={cn("ld-nav-link", active === id && "is-active")}
            >
              {t(id)}
            </a>
          ))}
        </nav>

        <div className="ld-nav-actions">
          <div className="hidden items-center gap-2 sm:flex">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <Link href={dashboardHref} className="ld-btn ld-btn--sm ld-btn--primary ld-nav-cta">
            <span>{signedIn ? t("dashboard") : t("login")}</span>
            <ArrowIcon />
          </Link>
          <button
            type="button"
            className="ld-nav-burger"
            aria-expanded={open}
            aria-label={open ? t("closeMenu") : t("openMenu")}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="ld-burger" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          </button>
        </div>
      </div>

      <div className="ld-nav-sheet" aria-hidden={!open}>
        <div className="ld-nav-sheet-inner">
          {SECTIONS.map((id, index) => (
            <a
              key={id}
              href={`#${id}`}
              tabIndex={open ? 0 : -1}
              onClick={(event) => navigate(event, id)}
              className={cn("ld-nav-sheet-link", active === id && "is-active")}
              style={{ "--i": index } as CSSProperties}
            >
              {t(id)}
            </a>
          ))}
          <div className="flex items-center gap-2 pt-3 sm:hidden">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <Link
            href={dashboardHref}
            tabIndex={open ? 0 : -1}
            className="ld-btn ld-btn--primary ld-nav-sheet-cta"
          >
            <span>{signedIn ? t("dashboard") : t("login")}</span>
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}

function LandingFooter({
  year,
  dashboardHref,
  onNavigate,
}: {
  year: number;
  dashboardHref: string;
  onNavigate: NavigateHandler;
}) {
  const t = useTranslations("Landing.footer");
  const tNav = useTranslations("Landing.nav");
  const tApp = useTranslations("App");

  return (
    <footer className="ld-footer">
      <div className="ld-footer-word" aria-hidden>
        BEROYA
      </div>
      <div className="ld-container ld-footer-grid">
        <div className="flex flex-col gap-4">
          <div className="ld-nav-brand">
            <BrandLockup />
          </div>
          <p className="max-w-xs text-sm leading-7 text-text-secondary">{t("tagline")}</p>
        </div>

        <div className="ld-footer-col">
          <h3>{t("product")}</h3>
          {SECTIONS.map((id) => (
            <a key={id} href={`#${id}`} onClick={(event) => onNavigate(event, id)}>
              {tNav(id)}
            </a>
          ))}
        </div>

        <div className="ld-footer-col">
          <h3>{t("access")}</h3>
          <Link href={dashboardHref}>{tNav("dashboard")}</Link>
          <Link href="/login">{tNav("login")}</Link>
        </div>

        <div className="ld-footer-col">
          <h3>{t("legal")}</h3>
          <Link href="/privacy-policy">{t("privacyPolicy")}</Link>
          <Link href="/terms-of-use">{t("termsOfUse")}</Link>
        </div>
      </div>

      <div className="ld-container">
        <div className="ld-footer-bottom">
          <span>{t("rights", { year })}</span>
          <a href="#top" className="ld-footer-top" onClick={(event) => onNavigate(event, "top")}>
            {t("backToTop")}
            <ArrowUp size={16} color="currentColor" variant="Linear" />
          </a>
        </div>
      </div>
    </footer>
  );
}
