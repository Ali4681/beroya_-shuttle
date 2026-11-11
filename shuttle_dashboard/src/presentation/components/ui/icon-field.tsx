"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type IconFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  icon: ReactNode;
  iconPosition?: "start" | "end";
  className?: string;
  inputClassName?: string;
};

export function IconField({
  icon,
  iconPosition = "start",
  className,
  inputClassName,
  ...props
}: IconFieldProps) {
  return (
    <div
      className={cn(
        "icon-field group/icon-field",
        iconPosition === "end" && "icon-field--end",
        className,
      )}
    >
      <span className="icon-field-badge" aria-hidden>
        {icon}
      </span>
      <input {...props} className={cn("icon-field-input", inputClassName)} />
    </div>
  );
}
