import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variant === "primary" &&
          "[background:var(--accent-gradient)] text-white shadow-[var(--shadow-sm)] hover:-translate-y-px hover:brightness-110 hover:shadow-[0_10px_22px_-10px_var(--accent-glow)]",
        variant === "secondary" &&
          "border border-border bg-surface text-text-primary hover:bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
}
