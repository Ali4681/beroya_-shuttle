import type { CSSProperties, ReactNode } from "react";
import { BrandLogo } from "@/presentation/components/brand/brand-logo";
import { cn } from "@/shared/lib/cn";

export type RevealVariant = "up" | "down" | "left" | "right" | "scale" | "blur";

/** Props for an element that animates in when scrolled into view. */
export function reveal(delay = 0, variant: RevealVariant = "up", style?: CSSProperties) {
  return {
    "data-reveal": variant,
    style: { ...style, "--d": `${delay}ms` } as CSSProperties,
  };
}

export function LandingMark({ size = "lg" }: { size?: "sm" | "lg" }) {
  return <BrandLogo variant="mark" size={size === "sm" ? "sm" : "lg"} />;
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <span className={cn("ld-btn-arrow", className)} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" className="rtl:-scale-x-100">
        <path className="ld-btn-arrow-shaft" d="M5 12h13" pathLength={1} />
        <path className="ld-btn-arrow-head" d="M12.5 6.5 18 12l-5.5 5.5" />
      </svg>
    </span>
  );
}

/** Opens WhatsApp for the number saved by the Beroya admin. */
export function whatsappHref(
  phone: string | null | undefined,
  message: string,
  url?: string | null,
) {
  if (url?.trim()) {
    try {
      const link = new URL(url.trim());
      if (!link.searchParams.has("text") && message) link.searchParams.set("text", message);
      return link.toString();
    } catch {
      return url.trim();
    }
  }
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function WhatsAppIcon() {
  return (
    <span className="ld-btn-wa" aria-hidden>
      <svg viewBox="0 0 24 24">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.9.99 6.68 2.77a9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.45 9.44m8.04-17.48A11.3 11.3 0 0 0 12.04.7C5.77.7.67 5.8.67 12.06c0 2 .52 3.96 1.52 5.68L.57 23.64l6.03-1.58a11.3 11.3 0 0 0 5.43 1.38h.01c6.27 0 11.37-5.1 11.37-11.37 0-3.04-1.18-5.9-3.33-8.05" />
      </svg>
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: string;
  align?: "center" | "start";
}) {
  return (
    <div className={cn("ld-heading", align === "start" && "ld-heading--start")}>
      <span className="ld-eyebrow" {...reveal(0)}>
        <span className="ld-eyebrow-dot" />
        {eyebrow}
      </span>
      <h2 className="ld-title" {...reveal(90)}>
        {title}
      </h2>
      {lead ? (
        <p className="ld-lead" {...reveal(180)}>
          {lead}
        </p>
      ) : null}
    </div>
  );
}

export function LiveBadge({ label }: { label: string }) {
  return (
    <span className="login-live">
      <span className="login-live-dot" />
      {label}
    </span>
  );
}
