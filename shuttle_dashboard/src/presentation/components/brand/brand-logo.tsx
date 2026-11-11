import { BRAND_ALT, BRAND_LOGO, BRAND_MARK } from "@/shared/brand-assets";
import { cn } from "@/shared/lib/cn";

type BrandLogoProps = {
  /** `logo` = wordmark; `mark` = plus mark. Shown uncropped. */
  variant?: "logo" | "mark";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  imgClassName?: string;
};

/** Height only — avoid max-width conflicts that crop wide wordmarks. */
const HEIGHT: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-6",
  md: "h-7",
  lg: "h-9",
  xl: "h-11",
};

export function BrandLogo({
  variant = "logo",
  size = "md",
  className,
  imgClassName,
}: BrandLogoProps) {
  const src = variant === "mark" ? BRAND_MARK : BRAND_LOGO;

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", className)} dir="ltr">
      {/* eslint-disable-next-line @next/next/no-img-element -- static public brand assets */}
      <img
        src={src}
        alt={BRAND_ALT}
        className={cn("h-auto w-auto object-contain", HEIGHT[size], imgClassName)}
      />
    </span>
  );
}

/** Sidebar / nav: smaller wordmark, never shrink/crop in flex layouts. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-end", className)} dir="ltr">
      {/* eslint-disable-next-line @next/next/no-img-element -- static public brand assets */}
      <img
        src={BRAND_LOGO}
        alt={BRAND_ALT}
        className="h-6 w-auto object-contain sm:h-7"
      />
    </span>
  );
}
