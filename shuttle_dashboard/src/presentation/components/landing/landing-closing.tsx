"use client";

import {
  Add,
  Bus,
  Danger,
  Gps,
  Location,
  Lock,
  NotificationBing,
  ShieldTick,
  TickCircle,
  UserTick,
  type Icon,
} from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useId, useState, type CSSProperties, type MouseEvent } from "react";
import { cn } from "@/shared/lib/cn";
import { useCycle, useMagnetic } from "./landing-hooks";
import { useSupportContact } from "@/presentation/hooks/use-support-contact";
import { LiveBadge, reveal, SectionHeading, WhatsAppIcon, whatsappHref } from "./landing-ui";

type ClosingProps = {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, id: string) => void;
};

export function LandingClosing({ onNavigate }: ClosingProps) {
  return (
    <>
      <Safety />
      <Faq />
      <FinalCta onNavigate={onNavigate} />
    </>
  );
}

const SAFETY_POINTS: { id: "emergency" | "tracking" | "corrections" | "access"; icon: Icon }[] = [
  { id: "emergency", icon: Danger },
  { id: "tracking", icon: Gps },
  { id: "corrections", icon: UserTick },
  { id: "access", icon: Lock },
];

const EVENTS: { id: string; icon: Icon; tone: string; time: string }[] = [
  { id: "started", icon: Bus, tone: "accent", time: "07:10" },
  { id: "arrived", icon: Location, tone: "accent", time: "07:18" },
  { id: "boarded", icon: TickCircle, tone: "success", time: "07:19" },
  { id: "delay", icon: Danger, tone: "warning", time: "07:27" },
  { id: "dropped", icon: UserTick, tone: "success", time: "07:42" },
  { id: "completed", icon: ShieldTick, tone: "success", time: "07:45" },
];

function Safety() {
  const t = useTranslations("Landing.safety");

  return (
    <section id="safety" className="ld-section">
      <div className="ld-container">
        <div className="ld-safety">
          <span className="ld-safety-aurora" aria-hidden />
          <div className="ld-safety-grid">
            <div className="flex flex-col gap-8">
              <SectionHeading eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} align="start" />
              <div className="ld-safety-points">
                {SAFETY_POINTS.map((point, index) => {
                  const PointIcon = point.icon;
                  return (
                    <div key={point.id} className="ld-safety-point" {...reveal(index * 90)}>
                      <span className="ld-icon-tile">
                        <PointIcon size={20} color="currentColor" variant="Bulk" />
                      </span>
                      <div>
                        <h3>{t(`points.${point.id}.title`)}</h3>
                        <p>{t(`points.${point.id}.desc`)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="ld-safety-visual" {...reveal(150, "scale")}>
              <div className="ld-shield" aria-hidden>
                <span className="ld-shield-ring" />
                <span className="ld-shield-ring ld-shield-ring--2" />
                <span className="ld-shield-core">
                  <ShieldTick size={34} color="currentColor" variant="Bold" />
                </span>
              </div>
              <EventLog />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventLog() {
  const t = useTranslations("Landing.safety.log");
  const [step] = useCycle(EVENTS.length + 3, 1300);
  const visible = Math.min(step + 1, EVENTS.length);

  return (
    <div className="ld-log" aria-hidden>
      <div className="ld-log-head">
        <span className="flex items-center gap-2 text-sm font-bold text-text-primary">
          <NotificationBing size={18} color="var(--accent)" variant="Bold" />
          {t("title")}
        </span>
        <LiveBadge label={t("live")} />
      </div>
      <ol className="ld-log-list">
        {EVENTS.slice(0, visible).map((event) => {
          const EventIcon = event.icon;
          return (
            <li key={event.id} className={cn("ld-log-item", `ld-tone--${event.tone}`)}>
              <span className="ld-log-icon">
                <EventIcon size={15} color="currentColor" variant="Bold" />
              </span>
              <span className="min-w-0 flex-1 truncate">{t(`events.${event.id}`)}</span>
              <span className="ld-log-time" dir="ltr">
                {event.time}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const FAQ_ITEMS = ["q1", "q2", "q3", "q4", "q5"] as const;

function Faq() {
  const t = useTranslations("Landing.faq");
  const [open, setOpen] = useState<string | null>("q1");
  const baseId = useId();

  return (
    <section id="faq" className="ld-section">
      <div className="ld-container ld-faq-wrap">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
        <div className="ld-faq">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = open === item;
            const panelId = `${baseId}-${item}`;
            return (
              <div key={item} className={cn("ld-faq-item", isOpen && "is-open")} {...reveal(index * 70)}>
                <button
                  type="button"
                  className="ld-faq-q"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : item)}
                >
                  <span>{t(`items.${item}.q`)}</span>
                  <span className="ld-faq-icon" aria-hidden>
                    <Add size={18} color="currentColor" variant="Linear" />
                  </span>
                </button>
                <div id={panelId} role="region" className="ld-faq-a">
                  <div>
                    <p>{t(`items.${item}.a`)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ onNavigate }: ClosingProps) {
  const t = useTranslations("Landing.cta");
  const tContact = useTranslations("Landing.contact");
  const support = useSupportContact();
  const whatsapp = whatsappHref(support.data?.supportPhone, tContact("message"), support.data?.supportWhatsappUrl);
  const magneticRef = useMagnetic<HTMLAnchorElement>();

  return (
    <section className="ld-section ld-section--cta">
      <div className="ld-container">
        <div className="ld-cta" {...reveal(0, "scale")}>
          <span className="ld-cta-border" aria-hidden />
          <span className="ld-cta-aurora" aria-hidden />
          <div className="ld-cta-icons" aria-hidden>
            {[Bus, Location, ShieldTick, NotificationBing, Gps, TickCircle].map((CtaIcon, index) => (
              <span key={index} style={{ "--i": index } as CSSProperties}>
                <CtaIcon size={20} color="currentColor" variant="Bulk" />
              </span>
            ))}
          </div>
          <div className="ld-cta-body">
            <h2 className="ld-cta-title">{t("title")}</h2>
            <p className="ld-cta-lead">{t("lead")}</p>
            <div className="ld-hero-ctas justify-center">
              <a
                ref={magneticRef}
                href={whatsapp ?? undefined}
                onClick={(event) => {
                  if (!whatsapp) event.preventDefault();
                }}
                target="_blank"
                rel="noopener noreferrer"
                className="ld-btn ld-btn--lg ld-btn--primary"
              >
                <span className="ld-btn-shine" aria-hidden />
                <span>{t("primary")}</span>
                <WhatsAppIcon />
              </a>
              <a
                href="#features"
                onClick={(event) => onNavigate(event, "features")}
                className="ld-btn ld-btn--lg ld-btn--ghost"
              >
                {t("secondary")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
