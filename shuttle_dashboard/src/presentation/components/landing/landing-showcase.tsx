"use client";

import {
  Briefcase,
  Building,
  Bus,
  Clock,
  Crown,
  Danger,
  Driving,
  Gps,
  Location,
  NotificationBing,
  People,
  Routing,
  Teacher,
  TickCircle,
  UserTick,
  type Icon,
} from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";
import { cn } from "@/shared/lib/cn";
import { MAP_ROUTES } from "./landing-hero";
import { useCycle } from "./landing-hooks";
import { LandingMark, reveal, SectionHeading } from "./landing-ui";

export function LandingShowcase() {
  return (
    <>
      <Ecosystem />
      <Steps />
      <Apps />
    </>
  );
}

type RoleId =
  | "beroyaAdmin"
  | "institutionAdmin"
  | "parent"
  | "student"
  | "employee"
  | "driver"
  | "attendant";

const ROLES: { id: RoleId; icon: Icon }[] = [
  { id: "beroyaAdmin", icon: Crown },
  { id: "institutionAdmin", icon: Building },
  { id: "parent", icon: People },
  { id: "student", icon: Teacher },
  { id: "employee", icon: Briefcase },
  { id: "driver", icon: Driving },
  { id: "attendant", icon: UserTick },
];

const SEGMENTS = ["school", "university", "company"] as const;
type Segment = (typeof SEGMENTS)[number];

const SEGMENT_ROLES: Record<Segment, RoleId[]> = {
  school: ["beroyaAdmin", "institutionAdmin", "parent", "driver", "attendant"],
  university: ["beroyaAdmin", "institutionAdmin", "student", "driver"],
  company: ["beroyaAdmin", "institutionAdmin", "employee", "driver"],
};

const ORBIT_RADIUS = 41;

function Ecosystem() {
  const t = useTranslations("Landing.ecosystem");
  const [userPicked, setUserPicked] = useState(false);
  const [index, setIndex] = useCycle(SEGMENTS.length, 5200, userPicked);
  const segment = SEGMENTS[index];
  const activeRoles = SEGMENT_ROLES[segment];

  return (
    <section id="ecosystem" className="ld-section ld-section--tint">
      <div className="ld-container">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

        <div className="ld-eco">
          <div className="ld-eco-orbit" {...reveal(0, "scale")}>
            <div className="ld-orbit-stage">
              <span className="ld-orbit-halo" />
              <span className="ld-orbit-track ld-orbit-track--outer" />
              <span className="ld-orbit-track ld-orbit-track--inner" />

              <div className="ld-orbit-ring">
                <svg viewBox="0 0 100 100" className="ld-orbit-lines" aria-hidden>
                  {ROLES.map((role, roleIndex) => {
                    const angle = (roleIndex / ROLES.length) * Math.PI * 2 - Math.PI / 2;
                    const x = 50 + Math.cos(angle) * ORBIT_RADIUS;
                    const y = 50 + Math.sin(angle) * ORBIT_RADIUS;
                    const on = activeRoles.includes(role.id);
                    return (
                      <g key={role.id} className={cn("ld-orbit-link", on && "is-on")}>
                        <line x1="50" y1="50" x2={x.toFixed(2)} y2={y.toFixed(2)} />
                        <line x1="50" y1="50" x2={x.toFixed(2)} y2={y.toFixed(2)} className="ld-orbit-flow" />
                      </g>
                    );
                  })}
                </svg>

                {ROLES.map((role, roleIndex) => {
                  const angle = (roleIndex / ROLES.length) * 360 - 90;
                  const on = activeRoles.includes(role.id);
                  const RoleIcon = role.icon;
                  return (
                    <div
                      key={role.id}
                      className="ld-orbit-node"
                      style={{ "--a": `${angle}deg`, "--r": ORBIT_RADIUS } as CSSProperties}
                    >
                      <div className={cn("ld-orbit-node-inner", on && "is-on")}>
                        <span className="ld-orbit-node-icon">
                          <RoleIcon size={20} color="currentColor" variant="Bulk" />
                        </span>
                        <span className="ld-orbit-node-label">{t(`roles.${role.id}`)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="ld-orbit-center">
                <LandingMark />
              </div>
            </div>
          </div>

          <div className="ld-eco-panel" {...reveal(120, "left")}>
            <div className="ld-tabs" role="tablist" aria-label={t("eyebrow")}>
              {SEGMENTS.map((item, itemIndex) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={item === segment}
                  className={cn("ld-tab", item === segment && "is-active")}
                  onClick={() => {
                    setUserPicked(true);
                    setIndex(itemIndex);
                  }}
                >
                  {t(`tabs.${item}.label`)}
                  {item === segment && !userPicked ? (
                    <span key={segment} className="ld-tab-timer" style={{ "--dur": "5200ms" } as CSSProperties} />
                  ) : null}
                </button>
              ))}
            </div>

            <div key={segment} className="ld-swap" role="tabpanel">
              <h3 className="ld-panel-title">{t(`tabs.${segment}.title`)}</h3>
              <p className="ld-panel-desc">{t(`tabs.${segment}.desc`)}</p>
              <ul className="ld-checks">
                {(["p1", "p2", "p3"] as const).map((point, pointIndex) => (
                  <li key={point} style={{ "--i": pointIndex } as CSSProperties}>
                    <TickCircle size={20} color="currentColor" variant="Bold" />
                    {t(`tabs.${segment}.points.${point}`)}
                  </li>
                ))}
              </ul>
              <div className="ld-role-chips">
                {activeRoles.map((roleId, chipIndex) => (
                  <span key={roleId} className="ld-role-chip" style={{ "--i": chipIndex } as CSSProperties}>
                    {t(`roles.${roleId}`)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS: { id: "setup" | "plan" | "assign" | "run"; icon: Icon }[] = [
  { id: "setup", icon: Building },
  { id: "plan", icon: Routing },
  { id: "assign", icon: People },
  { id: "run", icon: Gps },
];

function Steps() {
  const t = useTranslations("Landing.steps");

  return (
    <section id="how" className="ld-section ld-steps-section" data-scroll-progress>
      <div className="ld-container">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />

        <div className="ld-steps">
          <div className="ld-steps-track" aria-hidden>
            <span className="ld-steps-fill" />
          </div>
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <article
                key={step.id}
                className="ld-step"
                {...reveal(index * 120, "up", {
                  "--at": (index + 0.5) / (STEPS.length + 1.2),
                } as CSSProperties)}
              >
                <span className="ld-step-node">
                  <StepIcon size={22} color="currentColor" variant="Bold" />
                </span>
                <span className="ld-step-num">0{index + 1}</span>
                <h3>{t(`items.${step.id}.title`)}</h3>
                <p>{t(`items.${step.id}.desc`)}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const APPS: { id: "parent" | "student" | "driver" | "attendant"; icon: Icon }[] = [
  { id: "parent", icon: People },
  { id: "student", icon: Teacher },
  { id: "driver", icon: Driving },
  { id: "attendant", icon: UserTick },
];

const APP_CYCLE = 5600;

function Apps() {
  const t = useTranslations("Landing.apps");
  const [hovering, setHovering] = useState(false);
  const [userPicked, setUserPicked] = useState(false);
  const [index, setIndex] = useCycle(APPS.length, APP_CYCLE, hovering || userPicked);
  const app = APPS[index];

  return (
    <section id="apps" className="ld-section">
      <div className="ld-container">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

        <div
          className="ld-apps"
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
        >
          <div className="ld-apps-copy" {...reveal(0, "right")}>
            <div className="ld-app-tabs" role="tablist" aria-label={t("eyebrow")}>
              {APPS.map((item, itemIndex) => {
                const TabIcon = item.icon;
                const isActive = itemIndex === index;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={cn("ld-app-tab", isActive && "is-active")}
                    onClick={() => {
                      setUserPicked(true);
                      setIndex(itemIndex);
                    }}
                  >
                    <span className="ld-app-tab-icon">
                      <TabIcon size={18} color="currentColor" variant="Bulk" />
                    </span>
                    {t(`tabs.${item.id}.label`)}
                    {isActive && !userPicked ? (
                      <span
                        key={item.id}
                        className={cn("ld-tab-timer", hovering && "is-paused")}
                        style={{ "--dur": `${APP_CYCLE}ms` } as CSSProperties}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div key={app.id} className="ld-swap" role="tabpanel">
              <h3 className="ld-panel-title">{t(`tabs.${app.id}.title`)}</h3>
              <p className="ld-panel-desc">{t(`tabs.${app.id}.desc`)}</p>
              <ul className="ld-checks">
                {(["p1", "p2", "p3"] as const).map((point, pointIndex) => (
                  <li key={point} style={{ "--i": pointIndex } as CSSProperties}>
                    <TickCircle size={20} color="currentColor" variant="Bold" />
                    {t(`tabs.${app.id}.points.${point}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="ld-apps-stage" {...reveal(150, "scale")}>
            <span className="ld-apps-glow" aria-hidden />
            <span className="ld-orbit ld-orbit--1" aria-hidden />
            <div className="ld-phone ld-phone--lg">
              <span className="ld-phone-notch" />
              <div key={app.id} className="ld-phone-screen ld-screen-swap">
                {app.id === "parent" ? <ParentScreen /> : null}
                {app.id === "student" ? <StudentScreen /> : null}
                {app.id === "driver" ? <DriverScreen /> : null}
                {app.id === "attendant" ? <AttendantScreen /> : null}
              </div>
            </div>
            <span className="ld-float-chip ld-float-chip--a" aria-hidden>
              <NotificationBing size={16} color="currentColor" variant="Bold" />
              {t("screen.busNear")}
            </span>
            <span className="ld-float-chip ld-float-chip--b" aria-hidden>
              <TickCircle size={16} color="currentColor" variant="Bold" />
              {t("screen.childStatus")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScreenHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="ld-screen-head">
      <span>{title}</span>
      {badge ? <span className="ld-chip-mini ld-chip-mini--success">{badge}</span> : null}
    </div>
  );
}

function ParentScreen() {
  const t = useTranslations("Landing.apps.screen");
  const route = MAP_ROUTES[0];

  return (
    <>
      <ScreenHeader title={t("parentHeader")} badge={t("onTheWay")} />
      <div className="ld-screen-map">
        <svg viewBox="0 0 600 330" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <defs>
            <linearGradient id="ld-phone-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#389197" />
              <stop offset="100%" stopColor="#22e0ee" />
            </linearGradient>
            <radialGradient id="ld-phone-glow">
              <stop offset="0%" stopColor="#22e0ee" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#22e0ee" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d={route.d} className="ld-map-road" strokeWidth="26" strokeLinecap="round" />
          <path
            id="ld-phone-route"
            d={route.d}
            stroke="url(#ld-phone-grad)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <g>
            <circle r="30" fill="url(#ld-phone-glow)" />
            <circle r="14" fill="#ffffff" />
            <circle r="7" fill="#22e0ee" />
            <animateMotion dur="9s" repeatCount="indefinite">
              <mpath href="#ld-phone-route" />
            </animateMotion>
          </g>
        </svg>
      </div>
      <div className="ld-screen-card ld-screen-card--accent">
        <Clock size={18} color="currentColor" variant="Bold" />
        <span className="flex-1">
          <b className="block text-base leading-tight">{t("eta")}</b>
          <small className="opacity-80">{t("etaLabel")}</small>
        </span>
        <Bus size={22} color="currentColor" variant="Bulk" />
      </div>
      <div className="ld-screen-row">
        <span className="ld-phone-avatar">{t("child").charAt(0)}</span>
        <span className="min-w-0 flex-1">
          <b className="block truncate">{t("child")}</b>
          <small className="text-text-muted">{t("childStatus")}</small>
        </span>
        <TickCircle size={18} color="var(--success)" variant="Bold" />
      </div>
    </>
  );
}

function StudentScreen() {
  const t = useTranslations("Landing.apps.screen");

  return (
    <>
      <ScreenHeader title={t("studentHeader")} />
      <div className="ld-screen-hero">
        <span className="ld-screen-pin">
          <Location size={22} color="currentColor" variant="Bold" />
        </span>
        <b>{t("meetingPoint")}</b>
        <span className="ld-screen-time" dir="ltr">
          {t("pickupTime")}
        </span>
      </div>
      <div className="ld-screen-card ld-screen-card--warning ld-screen-pulse">
        <NotificationBing size={18} color="currentColor" variant="Bold" />
        <span className="flex-1 font-semibold">{t("busNear")}</span>
      </div>
      <div className="ld-screen-progress">
        <span />
      </div>
      <div className="ld-screen-row">
        <span className="ld-phone-avatar">
          <TickCircle size={14} color="currentColor" variant="Bold" />
        </span>
        <span className="flex-1 truncate font-semibold">{t("subscription")}</span>
      </div>
    </>
  );
}

const DRIVER_STOPS = ["s1", "s2", "s3", "s4"] as const;

function DriverScreen() {
  const t = useTranslations("Landing.apps.screen");
  const [current] = useCycle(DRIVER_STOPS.length, 1500);

  return (
    <>
      <ScreenHeader title={t("driverHeader")} badge={t("onTheWay")} />
      <div className="ld-screen-card ld-screen-card--accent">
        <Location size={18} color="currentColor" variant="Bold" />
        <span className="min-w-0 flex-1">
          <small className="block opacity-80">{t("nextStop")}</small>
          <b key={current} className="ld-swap-text block truncate">
            {t(`stops.${DRIVER_STOPS[current]}`)}
          </b>
        </span>
      </div>
      <ol className="ld-stops">
        {DRIVER_STOPS.map((stop, index) => (
          <li
            key={stop}
            className={cn(index < current && "is-done", index === current && "is-current")}
          >
            <i />
            {t(`stops.${stop}`)}
          </li>
        ))}
      </ol>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <span className="ld-screen-btn ld-screen-btn--danger">
          <Danger size={14} color="currentColor" variant="Bold" />
          {t("emergency")}
        </span>
        <span className="ld-screen-btn">{t("endTrip")}</span>
      </div>
    </>
  );
}

const ATTENDANT_RIDERS = ["r1", "r2", "r3", "r4"] as const;
const ATTENDANT_FINAL = ["boarded", "boarded", "absent", "boarded"] as const;

function AttendantScreen() {
  const t = useTranslations("Landing.apps.screen");
  const [step] = useCycle(ATTENDANT_RIDERS.length + 2, 1000);

  return (
    <>
      <ScreenHeader title={t("attendantHeader")} />
      <ul className="ld-roll">
        {ATTENDANT_RIDERS.map((rider, index) => {
          const status = index < step ? ATTENDANT_FINAL[index] : "pending";
          return (
            <li key={rider} className={cn("ld-roll-item", `is-${status}`)}>
              <span className="ld-phone-avatar">{t(`riders.${rider}`).charAt(0)}</span>
              <span className="flex-1 truncate font-semibold">{t(`riders.${rider}`)}</span>
              <span key={status} className="ld-roll-status">
                {t(status)}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
