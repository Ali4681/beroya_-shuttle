"use client";

import {
  Bus,
  Clock,
  Danger,
  Global,
  Location,
  NotificationBing,
  Radar,
  ShieldTick,
  TickCircle,
} from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { cn } from "@/shared/lib/cn";
import { useCountUp, useCycle, useMagnetic, usePointerVars, useTilt } from "./landing-hooks";
import { useSupportContact } from "@/presentation/hooks/use-support-contact";
import { LiveBadge, WhatsAppIcon, whatsappHref } from "./landing-ui";

const HERO_WORDS = ["schools", "universities", "companies"] as const;
const NOTES = [
  { id: "boarded", icon: TickCircle, tone: "success" },
  { id: "approaching", icon: NotificationBing, tone: "accent" },
  { id: "delay", icon: Danger, tone: "warning" },
  { id: "arrived", icon: Location, tone: "success" },
] as const;

function enter(delay: number) {
  return { style: { "--d": `${delay}ms` } as CSSProperties };
}

type HeroProps = {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, id: string) => void;
};

export function LandingHero({ onNavigate }: HeroProps) {
  const t = useTranslations("Landing.hero");
  const tContact = useTranslations("Landing.contact");
  const support = useSupportContact();
  const whatsapp = whatsappHref(support.data?.supportPhone, tContact("message"), support.data?.supportWhatsappUrl);
  const stageRef = usePointerVars<HTMLElement>(".ld-hero-spotlight");
  const magneticRef = useMagnetic<HTMLAnchorElement>();
  const words = t("titleA").split(" ");

  return (
    <section id="top" ref={stageRef} className="ld-hero">
      <HeroBackdrop />

      <div className="ld-container ld-hero-grid">
        <div className="ld-hero-copy">
          <span {...enter(80)} className="ld-enter login-badge">
            <span className="login-badge-dot" />
            {t("badge")}
          </span>

          <h1 className="ld-hero-title">
            <span className="ld-hero-title-line">
              {words.map((word, index) => (
                <span key={`${word}-${index}`} className="ld-word">
                  <span style={{ "--i": index } as CSSProperties}>{word}</span>
                </span>
              ))}
            </span>
            <span className="ld-hero-title-line ld-hero-title-accent">
              <span className="login-title-gradient">{t("titleB")}</span>
            </span>
          </h1>

          <p {...enter(620)} className="ld-enter ld-hero-lead">
            {t("lead")}
          </p>

          <p {...enter(720)} className="ld-enter ld-hero-for">
            {t("for")} <WordTicker />
          </p>

          <div {...enter(820)} className="ld-enter ld-hero-ctas">
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
              <span className="ld-play" aria-hidden>
                <Radar size={16} color="currentColor" variant="Bold" />
              </span>
              <span>{t("secondary")}</span>
            </a>
          </div>

          <ul {...enter(920)} className="ld-enter ld-hero-trust">
            <li>
              <Clock size={17} color="currentColor" variant="Bulk" />
              {t("trust.realtime")}
            </li>
            <li>
              <Global size={17} color="currentColor" variant="Bulk" />
              {t("trust.bilingual")}
            </li>
            <li>
              <ShieldTick size={17} color="currentColor" variant="Bulk" />
              {t("trust.secure")}
            </li>
          </ul>
        </div>

        <div {...enter(400)} className="ld-enter ld-hero-visual">
          <HeroDashboard />
        </div>
      </div>

      <a
        href="#features"
        className="ld-scroll-cue"
        onClick={(event) => onNavigate(event, "features")}
      >
        <span className="ld-scroll-mouse" aria-hidden>
          <span />
        </span>
        {t("scroll")}
      </a>
    </section>
  );
}

function HeroBackdrop() {
  return (
    <div className="ld-hero-backdrop" aria-hidden>
      <div className="login-aurora">
        <span className="login-blob login-blob--1" />
        <span className="login-blob login-blob--2" />
        <span className="login-blob login-blob--3" />
      </div>
      <div className="ld-floor">
        <div className="ld-floor-grid" />
      </div>
      <div className="ld-hero-spotlight" />
      <div className="ld-stars">
        {Array.from({ length: 28 }, (_, index) => (
          <span
            key={index}
            style={
              {
                "--x": `${(index * 37) % 100}%`,
                "--y": `${(index * 53) % 70}%`,
                "--s": `${2 + (index % 3)}px`,
                "--t": `${3 + (index % 5)}s`,
                "--dl": `${(index % 7) * -0.8}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="login-noise" />
    </div>
  );
}

function WordTicker() {
  const t = useTranslations("Landing.hero.words");
  const [index] = useCycle(HERO_WORDS.length, 2400);
  const word = HERO_WORDS[index];

  return (
    <span className="ld-ticker">
      <span key={word} className="ld-ticker-word">
        {t(word)}
      </span>
    </span>
  );
}

function useMounted(delay: number) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);
  return mounted;
}

function HeroDashboard() {
  const t = useTranslations("Landing.mock");
  const tiltRef = useTilt<HTMLDivElement>(7);
  const started = useMounted(900);
  const trips = useCountUp(24, started);
  const onTime = useCountUp(98, started);
  const boarded = useCountUp(312, started, 2200);

  return (
    <div className="ld-dash-scene">
      <span className="ld-orbit ld-orbit--1" aria-hidden />
      <span className="ld-orbit ld-orbit--2" aria-hidden />

      <div ref={tiltRef} className="ld-dash">
        <span className="ld-dash-border" aria-hidden />
        <div className="ld-dash-inner">
          <div className="ld-dash-head">
            <div className="flex items-center gap-2.5">
              <span className="ld-dash-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="text-sm font-bold text-text-primary">{t("title")}</span>
            </div>
            <LiveBadge label={t("live")} />
          </div>

          <div className="ld-dash-kpis">
            <Kpi label={t("activeTrips")} value={String(trips)} tone="accent" />
            <Kpi label={t("onTime")} value={`${onTime}%`} tone="success" />
            <Kpi label={t("boarded")} value={String(boarded)} tone="warning" />
          </div>

          <div className="ld-dash-map">
            <LiveMapSvg busLabel={t("bus")} />
            <div className="ld-dash-route">
              <span className="ld-dash-route-icon">
                <Bus size={16} color="currentColor" variant="Bold" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                  <span className="truncate text-text-primary">{t("route")}</span>
                  <span className="shrink-0 text-accent-strong">{t("eta")}</span>
                </div>
                <div className="ld-dash-route-bar">
                  <span />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NoteStack />
      <HeroPhone />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={cn("ld-kpi", `ld-kpi--${tone}`)}>
      <span className="ld-kpi-value">{value}</span>
      <span className="ld-kpi-label">{label}</span>
      <svg viewBox="0 0 80 24" className="ld-kpi-spark" aria-hidden>
        <path d="M0 18 L12 14 L22 16 L34 8 L46 12 L58 5 L70 9 L80 3" pathLength={1} />
      </svg>
    </div>
  );
}

export const MAP_ROUTES = [
  {
    id: "ld-route-a",
    d: "M30 280 C 120 270, 140 170, 240 180 S 380 280, 460 215 S 555 90, 575 50",
    gradient: "ld-grad-a",
    delay: 900,
    duration: "12s",
  },
  {
    id: "ld-route-b",
    d: "M40 70 C 140 50, 190 170, 300 150 S 450 50, 570 140",
    gradient: "ld-grad-b",
    delay: 1150,
    duration: "14s",
  },
  {
    id: "ld-route-c",
    d: "M60 315 C 170 305, 250 290, 320 245 S 470 300, 580 280",
    gradient: "ld-grad-c",
    delay: 1400,
    duration: "10s",
  },
] as const;

const MAP_STOPS = [
  { x: 240, y: 180, delay: 0 },
  { x: 460, y: 215, delay: 0.6 },
  { x: 300, y: 150, delay: 1.2 },
  { x: 570, y: 140, delay: 0.3 },
  { x: 320, y: 245, delay: 0.9 },
  { x: 575, y: 50, delay: 1.5 },
] as const;

const MAP_BLOCKS = [
  [70, 110, 80, 50],
  [170, 20, 70, 40],
  [340, 80, 90, 56],
  [450, 250, 80, 30],
  [110, 190, 60, 40],
  [380, 0, 70, 34],
  [230, 220, 56, 32],
  [490, 160, 60, 36],
] as const;

function LiveMapSvg({ busLabel }: { busLabel: string }) {
  return (
    <svg viewBox="0 0 600 330" fill="none" className="ld-map-svg" aria-hidden>
      <defs>
        <linearGradient id="ld-grad-a" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#389197" />
          <stop offset="100%" stopColor="#22e0ee" />
        </linearGradient>
        <linearGradient id="ld-grad-b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22e0ee" />
          <stop offset="100%" stopColor="#28c76f" />
        </linearGradient>
        <linearGradient id="ld-grad-c" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff9f43" />
          <stop offset="100%" stopColor="#22e0ee" />
        </linearGradient>
        <radialGradient id="ld-bus-glow">
          <stop offset="0%" stopColor="#22e0ee" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#22e0ee" stopOpacity="0" />
        </radialGradient>
        <pattern id="ld-map-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" className="ld-map-dot" />
        </pattern>
      </defs>

      <rect width="600" height="330" fill="url(#ld-map-dots)" />

      {MAP_BLOCKS.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="10" className="ld-map-block" />
      ))}

      {MAP_ROUTES.map((route) => (
        <path key={`${route.id}-road`} d={route.d} className="ld-map-road" strokeWidth="18" strokeLinecap="round" />
      ))}

      {MAP_ROUTES.map((route) => (
        <path
          key={route.id}
          id={route.id}
          d={route.d}
          pathLength={1}
          stroke={`url(#${route.gradient})`}
          strokeWidth="5"
          strokeLinecap="round"
          className="ld-map-route"
          style={{ "--d": `${route.delay}ms` } as CSSProperties}
        />
      ))}

      {MAP_ROUTES.map((route) => (
        <path
          key={`${route.id}-flow`}
          d={route.d}
          stroke="#ffffff"
          strokeOpacity="0.6"
          strokeWidth="2"
          strokeLinecap="round"
          className="ld-map-flow"
        />
      ))}

      {MAP_STOPS.map((stop) => (
        <g key={`${stop.x}-${stop.y}`} transform={`translate(${stop.x} ${stop.y})`}>
          <circle r="10" fill="#22e0ee" className="ld-map-pulse" style={{ animationDelay: `${stop.delay}s` }} />
          <circle r="7" className="ld-map-stop" strokeWidth="3" />
        </g>
      ))}

      {MAP_ROUTES.map((route, index) => (
        <g key={`${route.id}-bus`} className="ld-map-bus">
          <circle r="22" fill="url(#ld-bus-glow)" />
          <circle r="9" fill="#ffffff" />
          <circle r="4.5" fill={index === 2 ? "#ff9f43" : "#22e0ee"} />
          {index === 0 ? (
            <g transform="translate(14 -40)">
              <rect width="74" height="26" rx="13" className="ld-map-tag" />
              <text x="37" y="17.5" textAnchor="middle" className="ld-map-tag-text">
                {busLabel}
              </text>
            </g>
          ) : null}
          <animateMotion dur={route.duration} repeatCount="indefinite">
            <mpath href={`#${route.id}`} />
          </animateMotion>
        </g>
      ))}
    </svg>
  );
}

function NoteStack() {
  const t = useTranslations("Landing.mock.notes");
  const [tick, setTick] = useState(2);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) setTick((value) => value + 1);
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  const slots = [0, 1, 2, 3].map((slot) => tick - slot).filter((key) => key >= 0);

  return (
    <div className="ld-notes" aria-hidden>
      {slots.map((key, slot) => {
        const note = NOTES[key % NOTES.length];
        const Icon = note.icon;
        return (
          <div
            key={key}
            className={cn("ld-note", `ld-note--${note.tone}`)}
            style={{ "--slot": slot } as CSSProperties}
          >
            <span className="ld-note-icon">
              <Icon size={18} color="currentColor" variant="Bold" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-text-primary">
                {t(`${note.id}.title`)}
              </span>
              <span className="block truncate text-[11.5px] text-text-muted">{t(`${note.id}.sub`)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HeroPhone() {
  const t = useTranslations("Landing.mock");

  return (
    <div className="ld-hero-phone" aria-hidden>
      <div className="ld-phone ld-phone--sm">
        <span className="ld-phone-notch" />
        <div className="ld-phone-screen">
          <div className="flex items-center justify-between text-[10px] font-bold text-text-primary">
            <span>{t("phoneTitle")}</span>
            <span className="ld-chip-mini ld-chip-mini--success">{t("phoneStatus")}</span>
          </div>
          <div className="ld-eta-ring">
            <svg viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" className="ld-eta-track" />
              <circle cx="40" cy="40" r="32" pathLength={1} className="ld-eta-value" />
            </svg>
            <span className="ld-eta-text">
              <b>{t("phoneEta")}</b>
              <small>{t("phoneEtaLabel")}</small>
            </span>
          </div>
          <div className="ld-phone-row">
            <span className="ld-phone-avatar">
              <Bus size={12} color="currentColor" variant="Bold" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-bold text-text-primary">
                {t("notes.boarded.title")}
              </span>
              <span className="block truncate text-[9px] text-text-muted">{t("notes.boarded.sub")}</span>
            </span>
            <TickCircle size={14} color="var(--success)" variant="Bold" />
          </div>
        </div>
      </div>
    </div>
  );
}
