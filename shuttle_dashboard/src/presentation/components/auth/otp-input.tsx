"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/shared/lib/cn";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Fired once every box holds a digit, with the full code. */
  onComplete?: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  label: string;
  digitLabel: (index: number) => string;
  describedBy?: string;
};

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  invalid,
  disabled,
  autoFocus,
  label,
  digitLabel,
  describedBy,
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // Focus moves before React re-renders, so focus handlers read the freshest value from here.
  const latest = useRef(value);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  useEffect(() => {
    latest.current = value;
  }, [value]);

  useEffect(() => {
    if (disabled || !autoFocus) return;
    const box = refs.current[Math.min(latest.current.length, length - 1)];
    box?.focus();
  }, [disabled, autoFocus, length]);

  function focusBox(index: number) {
    const box = refs.current[Math.max(0, Math.min(length - 1, index))];
    box?.focus();
    box?.select();
  }

  function update(next: string) {
    latest.current = next;
    onChange(next);
  }

  function commit(next: string, focusIndex: number) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    update(clean);
    focusBox(focusIndex);
    if (clean.length === length) onComplete?.(clean);
  }

  /** Boxes fill left-to-right (focus is redirected to the first empty box), so `value` stays contiguous. */
  function writeAt(index: number, raw: string) {
    const current = digits[index];
    const typed = raw.length === 2 && current && raw.includes(current) ? raw.replace(current, "") : raw;
    const incoming = typed.replace(/\D/g, "");
    if (!incoming) return;
    commit(value.slice(0, index) + incoming + value.slice(index + incoming.length), index + incoming.length);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        update(value.slice(0, index) + value.slice(index + 1));
        focusBox(index);
      } else if (index > 0) {
        update(value.slice(0, index - 1));
        focusBox(index - 1);
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusBox(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusBox(length - 1);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    commit(pasted, pasted.length);
  }

  return (
    <div className={cn("otp-group", invalid && "otp-group--invalid")} role="group" aria-label={label} dir="ltr">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          aria-label={digitLabel(index + 1)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={digit}
          onChange={(event) => writeAt(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={onPaste}
          onFocus={(event) => {
            const filled = latest.current.length;
            if (filled < length && index > filled) {
              focusBox(filled);
              return;
            }
            event.target.select();
          }}
          className={cn("otp-box", digit && "otp-box--filled")}
        />
      ))}
    </div>
  );
}
