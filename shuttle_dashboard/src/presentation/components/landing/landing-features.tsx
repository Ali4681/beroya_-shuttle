"use client";

import {
  Brush,
  Building,
  Danger,
  DocumentText,
  Location,
  Map,
  NotificationBing,
  Routing,
  TickCircle,
  Wallet,
  type Icon,
} from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { BRAND_MARK } from "@/shared/brand-assets";
import { cn } from "@/shared/lib/cn";
import { useCountUp, useCycle, useGlowCards, useInView } from "./landing-hooks";
import { reveal, SectionHeading } from "./landing-ui";

const STATS = [
  { id: "types", value: 3 },
  { id: "roles", value: 7 },
  { id: "events", value: 19 },
  { id: "live", value: 24, suffix: "/7" },
] as const;

type FeatureId =
  | "tracking"
  | "boarding"
  | "notifications"
  | "incidents"
  | "routes"
  | "subscriptions"
  | "branches"
  | "audit"
  | "branding";

const FEATURES: { id: FeatureId; icon: Icon; span: string; tone: string }[] = [
  { id: "tracking", icon: Map, span: "ld-bento--hero", tone: "accent" },
  { id: "boarding", icon: TickCircle, span: "ld-bento--wide", tone: "success" },
  { id: "notifications", icon: NotificationBing, span: "", tone: "accent" },
  { id: "incidents", icon: Danger, span: "", tone: "danger" },
  { id: "routes", icon: Routing, span: "ld-bento--wide", tone: "accent" },
  { id: "subscriptions", icon: Wallet, span: "", tone: "warning" },
  { id: "branches", icon: Building, span: "", tone: "accent" },
  { id: "audit", icon: DocumentText, span: "ld-bento--wide", tone: "accent" },
  { id: "branding", icon: Brush, span: "ld-bento--wide", tone: "success" },
];

export function LandingFeatures() {
  return (
    <>
      <Stats />
      <Features />
    </>
  );
}

function Stats() {
  const t = useTranslations("Landing.stats");
  const [ref, inView] = useInView<HTMLDivElement>(0.4);

  return (
    <div ref={ref} className="ld-container ld-stats">
      {STATS.map((stat, index) => (
        <StatItem
          key={stat.id}
          label={t(stat.id)}
          value={stat.value}
          suffix={"suffix" in stat ? stat.suffix : undefined}
          active={inView}
          delay={index * 110}
        />
      ))}
    </div>
  );
}

function StatItem({
  label,
  value,
  suffix,
  active,
  delay,
}: {
  label: string;
  value: number;
  suffix?: string;
  active: boolean;
  delay: number;
}) {
  const count = useCountUp(value, active, 1600 + delay);

  return (
    <div className="ld-stat" {...reveal(delay)}>
      <span className="ld-stat-value" dir="ltr">
        {count}
        {suffix ? <span className="ld-stat-suffix">{suffix}</span> : null}
      </span>
      <span className="ld-stat-label">{label}</span>
    </div>
  );
}

function Features() {
  const t = useTranslations("Landing.features");
  const gridRef = useGlowCards<HTMLDivElement>();

  return (
    <section id="features" className="ld-section">
      <div className="ld-container">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

        <div ref={gridRef} className="ld-bento">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.id}
                data-glow
                className={cn("ld-card ld-bento-card", feature.span, `ld-tone--${feature.tone}`)}
                {...reveal((index % 4) * 90, "scale")}
              >
                <div className="ld-bento-visual">
                  <FeatureVisual id={feature.id} />
                </div>
                <div className="ld-bento-copy">
                  <span className="ld-icon-tile">
                    <Icon size={20} color="currentColor" variant="Bulk" />
                  </span>
                  <h3>{t(`items.${feature.id}.title`)}</h3>
                  <p>{t(`items.${feature.id}.desc`)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeatureVisual({ id }: { id: FeatureId }) {
  switch (id) {
    case "tracking":
      return <TrackingVisual />;
    case "boarding":
      return <BoardingVisual />;
    case "notifications":
      return <NotificationsVisual />;
    case "incidents":
      return <IncidentsVisual />;
    case "routes":
      return <RoutesVisual />;
    case "subscriptions":
      return <SubscriptionsVisual />;
    case "branches":
      return <BranchesVisual />;
    case "audit":
      return <AuditVisual />;
    case "branding":
      return <BrandingVisual />;
  }
}

function TrackingVisual() {
  return (
    <div className="ld-radar" aria-hidden>
      <span className="ld-radar-ring" style={{ "--r": 1 } as CSSProperties} />
      <span className="ld-radar-ring" style={{ "--r": 0.72 } as CSSProperties} />
      <span className="ld-radar-ring" style={{ "--r": 0.44 } as CSSProperties} />
      <span className="ld-radar-sweep" />
      <span className="ld-radar-cross" />
      {[
        [22, 30, 0],
        [68, 24, 1.1],
        [74, 66, 2.2],
        [30, 72, 3.1],
        [50, 44, 1.6],
      ].map(([x, y, delay]) => (
        <span
          key={`${x}-${y}`}
          className="ld-radar-blip"
          style={{ "--x": `${x}%`, "--y": `${y}%`, animationDelay: `${delay}s` } as CSSProperties}
        />
      ))}
      <span className="ld-radar-core">
        <Location size={18} color="currentColor" variant="Bold" />
      </span>
    </div>
  );
}

const RIDERS = ["r1", "r2", "r3", "r4"] as const;

function BoardingVisual() {
  const t = useTranslations("Landing.features.demo");
  const tRiders = useTranslations("Landing.apps.screen.riders");
  const [step] = useCycle(RIDERS.length + 2, 1100);

  return (
    <ul className="ld-riders" aria-hidden>
      {RIDERS.map((rider, index) => {
        const boarded = index < step;
        return (
          <li key={rider} className={cn("ld-rider", boarded && "is-boarded")}>
            <span className="ld-rider-avatar">{tRiders(rider).charAt(0)}</span>
            <span className="ld-rider-name">{tRiders(rider)}</span>
            <span className="ld-rider-status">
              {boarded ? <TickCircle size={13} color="currentColor" variant="Bold" /> : <i />}
              {boarded ? t("boarded") : t("pending")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function NotificationsVisual() {
  return (
    <div className="ld-pings" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span key={index} className="ld-ping" style={{ "--i": index } as CSSProperties}>
          <span className="ld-ping-icon">
            <NotificationBing size={14} color="currentColor" variant="Bold" />
          </span>
          <span className="ld-ping-lines">
            <i />
            <i />
          </span>
        </span>
      ))}
    </div>
  );
}

function IncidentsVisual() {
  const t = useTranslations("Landing.features.demo");
  const [phase] = useCycle(2, 2600);

  return (
    <div className={cn("ld-alert", phase === 1 && "is-resolved")} aria-hidden>
      <span className="ld-alert-wave" />
      <span className="ld-alert-wave" style={{ animationDelay: "0.8s" }} />
      <span className="ld-alert-core">
        {phase === 1 ? (
          <TickCircle size={26} color="currentColor" variant="Bold" />
        ) : (
          <Danger size={26} color="currentColor" variant="Bold" />
        )}
      </span>
      <span key={phase} className="ld-alert-chip">
        {phase === 1 ? t("resolved") : t("emergency")}
      </span>
    </div>
  );
}

function RoutesVisual() {
  return (
    <svg viewBox="0 0 320 120" fill="none" className="ld-routes-svg" aria-hidden>
      <path d="M14 96 C 70 96, 80 30, 140 34 S 220 96, 306 22" className="ld-routes-road" />
      <path
        d="M14 96 C 70 96, 80 30, 140 34 S 220 96, 306 22"
        pathLength={1}
        className="ld-routes-line"
      />
      {[
        [14, 96, 0],
        [140, 34, 0.35],
        [224, 72, 0.6],
        [306, 22, 0.85],
      ].map(([x, y, at]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <circle r="9" className="ld-routes-stop" style={{ "--at": at } as CSSProperties} />
          <circle r="3.5" className="ld-routes-stop-core" style={{ "--at": at } as CSSProperties} />
        </g>
      ))}
    </svg>
  );
}

const PLANS = ["monthly", "term", "roundTrip"] as const;

function SubscriptionsVisual() {
  const t = useTranslations("Landing.features.demo");
  const [active] = useCycle(PLANS.length, 1600);

  return (
    <div className="ld-plans" aria-hidden>
      {PLANS.map((plan, index) => (
        <span key={plan} className={cn("ld-plan", index === active && "is-active")}>
          {t(plan)}
        </span>
      ))}
    </div>
  );
}

function BranchesVisual() {
  return (
    <svg viewBox="0 0 160 110" fill="none" className="ld-tree" aria-hidden>
      {[
        "M80 26 C 80 54, 30 50, 30 82",
        "M80 26 L 80 82",
        "M80 26 C 80 54, 130 50, 130 82",
      ].map((d) => (
        <g key={d}>
          <path d={d} className="ld-tree-line" />
          <path d={d} className="ld-tree-flow" />
        </g>
      ))}
      <circle cx="80" cy="22" r="13" className="ld-tree-root" />
      {[30, 80, 130].map((x, index) => (
        <circle
          key={x}
          cx={x}
          cy="86"
          r="10"
          className="ld-tree-leaf"
          style={{ animationDelay: `${index * 0.4}s` }}
        />
      ))}
    </svg>
  );
}

function AuditVisual() {
  const rows = [
    ["var(--accent)", "72%", "09:41"],
    ["var(--success)", "58%", "09:38"],
    ["var(--warning)", "80%", "09:32"],
    ["var(--accent)", "46%", "09:27"],
    ["var(--danger)", "64%", "09:20"],
    ["var(--success)", "70%", "09:14"],
  ] as const;

  return (
    <div className="ld-audit" aria-hidden>
      <div className="ld-audit-track">
        {[...rows, ...rows].map(([color, width, time], index) => (
          <div key={index} className="ld-audit-row">
            <span className="ld-audit-dot" style={{ background: color }} />
            <span className="ld-audit-bar" style={{ width }} />
            <span className="ld-audit-time" dir="ltr">
              {time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandingVisual() {
  return (
    <div className="ld-brand" aria-hidden>
      <div className="ld-brand-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- static public brand assets */}
        <img src={BRAND_MARK} alt="" className="ld-brand-logo-img" />
        <span className="ld-brand-lines">
          <i />
          <i />
        </span>
        <span className="ld-brand-btn" />
      </div>
      <div className="ld-brand-swatches">
        {["#22e0ee", "#7367f0", "#28c76f", "#ff9f43", "#ea5455"].map((color, index) => (
          <span
            key={color}
            style={{ background: color, "--i": index } as CSSProperties}
            className="ld-brand-swatch"
          />
        ))}
      </div>
    </div>
  );
}
