"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Danger,
  Eye,
  EyeSlash,
  Lock,
  Radar,
  Routing,
  ShieldTick,
  Sms,
  TickCircle,
} from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useBrandingStore } from "@/application/stores/branding-store";
import { useSessionStore } from "@/application/stores/session-store";
import { Link, useRouter } from "@/i18n/navigation";
import { adminApi } from "@/infrastructure/api/admin.api";
import { authApi } from "@/infrastructure/api/auth.api";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { BrandLockup } from "@/presentation/components/brand/brand-logo";
import { whatsappHref } from "@/presentation/components/landing/landing-ui";
import { LanguageSwitcher } from "@/presentation/components/layout/language-switcher";
import { ThemeToggle } from "@/presentation/components/theme/theme-toggle";
import { useErrorMessage } from "@/presentation/hooks/use-error-message";
import { useSupportContact } from "@/presentation/hooks/use-support-contact";
import { cn } from "@/shared/lib/cn";
import {
  clearSession,
  homePathForRole,
  isPanelRole,
  saveSession,
} from "@/shared/lib/session";

const noopSubscribe = () => () => {};
const REMEMBERED_EMAIL_KEY = "beroya-remembered-email";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TICKER_WORDS = ["institutions", "branches", "lines", "trips"] as const;

type SubmitStatus = "idle" | "loading" | "success";

function readRememberedEmail() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveRememberedEmail(email: string | null) {
  try {
    if (email) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function revealDelay(ms: number) {
  return { "--d": `${ms}ms` } as CSSProperties;
}

export function LoginView({ year }: { year: number }) {
  const t = useTranslations("Auth");
  const stageRef = usePointerSpotlight<HTMLElement>();

  return (
    <main
      ref={stageRef}
      className="login-stage relative min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto"
    >
      <LoginBackdrop />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[1320px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="login-topbar flex items-center justify-between gap-3">
          <div className="login-reveal flex items-center gap-2.5" style={revealDelay(0)}>
            <BrandLockup />
          </div>
          <div className="login-reveal flex items-center gap-2" style={revealDelay(80)}>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <div className="login-body grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:gap-16">
          <LoginHero />
          <div className="login-card-slot flex justify-center lg:justify-end">
            <LoginCard />
          </div>
        </div>

        <footer
          className="login-footer login-reveal flex flex-col items-center gap-2 text-center text-xs text-text-muted"
          style={revealDelay(900)}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link href="/privacy-policy" className="transition-colors hover:text-accent-strong">
              {t("privacyPolicy")}
            </Link>
            <span aria-hidden>·</span>
            <Link href="/terms-of-use" className="transition-colors hover:text-accent-strong">
              {t("termsOfUse")}
            </Link>
          </div>
          <span>{t("rights", { year })}</span>
        </footer>
      </div>
    </main>
  );
}

function LoginBackdrop() {
  return (
    <div className="login-backdrop" aria-hidden>
      <div className="login-aurora">
        <span className="login-blob login-blob--1" />
        <span className="login-blob login-blob--2" />
        <span className="login-blob login-blob--3" />
      </div>
      <div className="login-grid" />
      <div className="login-spotlight" />
      <div className="login-noise" />
    </div>
  );
}

function LoginHero() {
  const t = useTranslations("Auth.brand");
  const chips = [
    { id: "tracking", icon: Radar },
    { id: "safety", icon: ShieldTick },
    { id: "schedule", icon: Clock },
  ] as const;

  return (
    <section className="login-hero hidden min-w-0 flex-col lg:flex">
      <span className="login-reveal login-badge" style={revealDelay(120)}>
        <span className="login-badge-dot" />
        {t("badge")}
      </span>

      <h1 className="login-reveal login-title" style={revealDelay(200)}>
        <span className="block">{t("titleLine1")}</span>
        <span className="login-title-gradient block">{t("titleLine2")}</span>
      </h1>

      <p className="login-reveal login-lead" style={revealDelay(280)}>
        {t("lead")} <WordTicker />
      </p>

      <ul className="login-reveal login-chips" style={revealDelay(360)}>
        {chips.map(({ id, icon: Icon }) => (
          <li key={id} className="login-chip">
            <span className="login-chip-icon">
              <Icon size={14} color="currentColor" variant="Bold" />
            </span>
            {t(`chips.${id}`)}
          </li>
        ))}
      </ul>

      <div className="login-reveal login-map-wrap" style={revealDelay(440)}>
        <NetworkMap />
      </div>
    </section>
  );
}

function WordTicker() {
  const t = useTranslations("Auth.brand.words");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % TICKER_WORDS.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  const word = TICKER_WORDS[index];

  return (
    <span className="login-ticker">
      <span key={word} className="login-ticker-word">
        {t(word)}
      </span>
    </span>
  );
}

const ROUTES = [
  {
    id: "login-route-a",
    d: "M20 200 C 110 200, 120 90, 220 100 S 360 210, 450 150 S 535 60, 545 40",
    gradient: "login-grad-a",
    delay: 500,
    duration: "11s",
  },
  {
    id: "login-route-b",
    d: "M30 60 C 120 40, 170 150, 270 140 S 420 40, 540 120",
    gradient: "login-grad-b",
    delay: 750,
    duration: "13s",
  },
  {
    id: "login-route-c",
    d: "M60 245 C 150 232, 230 222, 300 182 S 430 232, 530 220",
    gradient: "login-grad-c",
    delay: 1000,
    duration: "9s",
  },
] as const;

const LINE_ENDS = [
  { x: 545, y: 40, delay: 0 },
  { x: 540, y: 120, delay: 0.6 },
  { x: 530, y: 220, delay: 1.2 },
] as const;

const CITY_BLOCKS = [
  [70, 110, 70, 46],
  [160, 20, 64, 40],
  [330, 70, 80, 52],
  [440, 190, 70, 34],
  [120, 150, 54, 36],
  [370, 10, 60, 32],
  [230, 200, 50, 30],
] as const;

function NetworkMap() {
  const t = useTranslations("Auth.brand");

  return (
    <div className="login-map">
      <div className="login-map-head">
        <span className="flex items-center gap-2.5 text-base font-semibold text-text-primary">
          <span className="login-chip-icon">
            <Routing size={18} color="currentColor" variant="Bold" />
          </span>
          {t("mapTitle")}
        </span>
        <span className="login-live">
          <span className="login-live-dot" />
          {t("live")}
        </span>
      </div>

      <svg
        viewBox="0 0 560 190"
        fill="none"
        className="login-map-svg rtl:-scale-x-100"
        aria-hidden
      >
        <defs>
          <linearGradient id="login-grad-a" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#389197" />
            <stop offset="100%" stopColor="#22e0ee" />
          </linearGradient>
          <linearGradient id="login-grad-b" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22e0ee" />
            <stop offset="100%" stopColor="#28c76f" />
          </linearGradient>
          <linearGradient id="login-grad-c" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff9f43" />
            <stop offset="100%" stopColor="#22e0ee" />
          </linearGradient>
          <radialGradient id="login-bus-glow">
            <stop offset="0%" stopColor="#22e0ee" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#22e0ee" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform="translate(0 95) scale(1 0.7) translate(0 -130)">
          {CITY_BLOCKS.map(([x, y, w, h]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="8" className="login-block" />
          ))}

          {ROUTES.map((route) => (
            <path
              key={`${route.id}-road`}
              d={route.d}
              className="login-road"
              strokeWidth="20"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {ROUTES.map((route) => (
            <path
              key={route.id}
              id={route.id}
              d={route.d}
              pathLength={1}
              stroke={`url(#${route.gradient})`}
              strokeWidth="5.5"
              strokeLinecap="round"
              className="login-route"
              vectorEffect="non-scaling-stroke"
              style={revealDelay(route.delay)}
            />
          ))}

          {ROUTES.map((route) => (
            <path
              key={`${route.id}-flow`}
              d={route.d}
              stroke="#ffffff"
              strokeOpacity="0.55"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="login-flow"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {LINE_ENDS.map((stop) => (
            <g key={`${stop.x}-${stop.y}`} transform={`translate(${stop.x} ${stop.y})`}>
              <g transform="scale(1 1.4286)">
                <circle
                  r="10"
                  fill="#22e0ee"
                  className="login-stop-pulse"
                  style={{ animationDelay: `${stop.delay}s` }}
                />
                <circle r="8" className="login-stop" strokeWidth="3.5" />
              </g>
            </g>
          ))}

          {ROUTES.map((route) => (
            <g key={`${route.id}-bus`} className="login-bus">
              <g transform="scale(1 1.4286)">
                <circle r="24" fill="url(#login-bus-glow)" />
                <circle r="10" fill="#ffffff" />
                <circle r="5" fill="#22e0ee" />
              </g>
              <animateMotion dur={route.duration} repeatCount="indefinite" rotate="auto">
                <mpath href={`#${route.id}`} />
              </animateMotion>
            </g>
          ))}
        </g>
      </svg>

      <div className="login-map-legend">
        <span className="flex items-center gap-1.5">
          <span className="login-legend-dot bg-[linear-gradient(90deg,#389197,#22e0ee)]" />
          {t("legendLines")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="login-legend-dot border-2 border-accent bg-surface" />
          {t("legendStops")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="login-legend-dot bg-accent shadow-[0_0_8px_var(--accent)]" />
          {t("legendVehicles")}
        </span>
      </div>
    </div>
  );
}

function LoginCard() {
  const t = useTranslations("Auth");
  const tContact = useTranslations("Landing.contact");
  const messageFor = useErrorMessage();
  const support = useSupportContact();
  const whatsapp = whatsappHref(support.data?.supportPhone, tContact("message"), support.data?.supportWhatsappUrl);
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useSessionStore((state) => state.setUser);
  const setBranding = useBrandingStore((state) => state.setBranding);
  const tiltRef = useCardTilt<HTMLDivElement>();
  const rememberedEmail = useSyncExternalStore(noopSubscribe, readRememberedEmail, () => "");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [shake, setShake] = useState(false);
  const [, startTransition] = useTransition();
  const emailValue = email ?? rememberedEmail;

  function fail(message: string) {
    setError(message);
    setShake(true);
    setStatus("idle");
  }

  async function signIn() {
    const normalized = emailValue.trim().toLowerCase();
    if (!normalized) return fail(t("errors.emailRequired"));
    if (!EMAIL_PATTERN.test(normalized)) return fail(t("errors.emailInvalid"));
    if (password.length < 8) return fail(t("errors.passwordInvalid"));

    setStatus("loading");
    setError(undefined);
    try {
      const tokens = await authApi.login(normalized, password);
      if (!isPanelRole(tokens.user.role)) {
        return fail(t("errors.notPanelRole"));
      }

      saveSession(tokens, remember);
      saveRememberedEmail(remember ? normalized : null);
      setUser(tokens.user);

      try {
        if (tokens.user.role === "BEROYA_ADMIN") {
          await queryClient.fetchQuery({ queryKey: qk.admin.bootstrap, queryFn: adminApi.bootstrap });
        } else {
          const boot = await queryClient.fetchQuery({
            queryKey: qk.institution.bootstrap,
            queryFn: institutionApi.bootstrap,
          });
          setBranding(boot.institution, boot.branding);
        }
      } catch (bootError) {
        clearSession();
        setUser(null);
        queryClient.clear();
        return fail(messageFor(bootError));
      }

      setStatus("success");
      window.setTimeout(() => {
        startTransition(() => router.replace(homePathForRole(tokens.user.role)));
      }, 650);
    } catch (err) {
      fail(messageFor(err));
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "idle") return;
    void signIn();
  }

  return (
    <div
      className={cn(
        "login-card-perspective login-reveal",
        status === "success" && "login-card-exit",
      )}
      style={revealDelay(240)}
    >
      <div ref={tiltRef} className="login-card">
        <span className="login-card-border" aria-hidden />
        <span className="login-card-glare" aria-hidden />

        <div
          className={cn("login-card-inner", shake && "login-shake")}
          onAnimationEnd={(event) => {
            if (event.animationName === "login-shake") setShake(false);
          }}
        >
          <div className="login-card-head">
            <h2 className="login-card-title">{t("welcome")}</h2>
            <p className="login-subtitle">{t("subtitle")}</p>
          </div>

          <form noValidate onSubmit={onSubmit} className="login-form">
            <FloatingField
              id="login-email"
              label={t("email")}
              error={undefined}
              icon={<Sms size={19} color="currentColor" variant="Linear" />}
              inputProps={{
                name: "email",
                type: "email",
                autoComplete: "username",
                autoFocus: true,
                dir: "ltr",
                value: emailValue,
                onChange: (event) => {
                  setEmail(event.target.value);
                  if (error) setError(undefined);
                },
              }}
            />
            <FloatingField
              id="login-password"
              label={t("password")}
              error={error}
              icon={<Lock size={19} color="currentColor" variant="Linear" />}
              end={
                <button
                  type="button"
                  className="login-field-icon"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? (
                    <EyeSlash size={18} color="currentColor" variant="Linear" />
                  ) : (
                    <Eye size={18} color="currentColor" variant="Linear" />
                  )}
                </button>
              }
              inputProps={{
                name: "password",
                type: showPassword ? "text" : "password",
                autoComplete: "current-password",
                dir: "ltr",
                value: password,
                onChange: (event) => {
                  setPassword(event.target.value);
                  if (error) setError(undefined);
                },
              }}
            />

            <div className="login-options">
              <label className="login-switch">
                <input
                  type="checkbox"
                  name="remember"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="sr-only"
                />
                <span className="login-switch-track">
                  <span className="login-switch-thumb" />
                </span>
                {t("remember")}
              </label>
            </div>

            <button
              type="submit"
              disabled={status !== "idle"}
              className={cn("login-submit", status === "success" && "login-submit--success")}
            >
              <span className="login-submit-shine" aria-hidden />
              <span key={status} className="login-submit-content" aria-live="polite">
                {status === "idle" ? (
                  <>
                    <span>{t("signIn")}</span>
                    <span className="login-submit-arrow" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none" className="rtl:-scale-x-100">
                        <path className="login-submit-arrow-shaft" d="M5 12h13" pathLength={1} />
                        <path className="login-submit-arrow-head" d="M12.5 6.5 18 12l-5.5 5.5" />
                      </svg>
                    </span>
                  </>
                ) : null}
                {status === "loading" ? (
                  <>
                    <span className="login-spinner" aria-hidden />
                    <span>{t("signingIn")}</span>
                  </>
                ) : null}
                {status === "success" ? (
                  <>
                    <TickCircle
                      size={21}
                      color="currentColor"
                      variant="Bold"
                      className="login-success-icon"
                    />
                    <span>{t("success")}</span>
                  </>
                ) : null}
              </span>
            </button>
          </form>

          <div className="login-card-foot">
            <span className="text-text-secondary">{t("help")} </span>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                {t("helpAction")}
              </a>
            ) : (
              <span className="text-text-secondary">{t("helpAction")}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingField({
  id,
  label,
  error,
  icon,
  end,
  prefix,
  inputProps,
}: {
  id: string;
  label: string;
  error?: string;
  icon: ReactNode;
  end?: ReactNode;
  /** Fixed text shown left of an LTR value (e.g. a country code). */
  prefix?: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
}) {
  const errorId = `${id}-error`;

  return (
    <div>
      <div
        className={cn(
          "login-field",
          error && "login-field--error",
          end != null && "login-field--with-end",
          prefix && "login-field--prefixed",
        )}
      >
        <span className="login-field-icon" aria-hidden>
          {icon}
        </span>
        {prefix ? (
          <span className="login-field-prefix" dir="ltr" aria-hidden>
            {prefix}
          </span>
        ) : null}
        <input
          {...inputProps}
          id={id}
          placeholder=" "
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="login-input"
        />
        <label htmlFor={id} className="login-label">
          {label}
        </label>
        {end}
        <span className="login-field-line" aria-hidden />
      </div>
      <div className={cn("login-error-slot", error && "login-error-slot--open")}>
        <div>
          {error ? (
            <p id={errorId} role="alert" className="login-error">
              <Danger size={14} color="currentColor" variant="Bold" aria-hidden />
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function usePointerSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;

    function onMove(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element!.style.setProperty("--mx", `${event.clientX}px`);
        element!.style.setProperty("--my", `${event.clientY}px`);
      });
    }

    element.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", onMove);
    };
  }, []);

  return ref;
}

function useCardTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0;

    function onMove(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element!.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        element!.classList.add("is-tilting");
        element!.style.setProperty("--rx", `${(0.5 - py) * 7}deg`);
        element!.style.setProperty("--ry", `${(px - 0.5) * 9}deg`);
        element!.style.setProperty("--gx", `${px * 100}%`);
        element!.style.setProperty("--gy", `${py * 100}%`);
      });
    }

    function onLeave() {
      cancelAnimationFrame(frame);
      element!.classList.remove("is-tilting");
      element!.style.setProperty("--rx", "0deg");
      element!.style.setProperty("--ry", "0deg");
    }

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return ref;
}
