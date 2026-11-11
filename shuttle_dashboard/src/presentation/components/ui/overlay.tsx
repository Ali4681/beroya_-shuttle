"use client";

import { CloseCircle } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { useEffect, useId, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AppScrollArea } from "@/presentation/components/ui/app-scroll-area";
import { cn } from "@/shared/lib/cn";

function useOverlayLock(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
}

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Wraps the content in a <form> so Enter submits. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};

/** Side drawer opening from inline-start (left in English, right in Arabic). */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  onSubmit,
  wide,
}: OverlayProps & { wide?: boolean }) {
  const t = useTranslations("Common");
  const titleId = useId();
  useOverlayLock(open, onClose);

  if (!open || typeof document === "undefined") return null;

  const content = (
    <>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div id={titleId} className="min-w-0 flex-1 text-start">
          <h2 className="text-[17px] font-semibold text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-surface-muted"
        >
          <CloseCircle size={22} color="currentColor" variant="Linear" />
        </button>
      </header>
      <AppScrollArea fade className="min-h-0 flex-1 px-5 py-5">
        <div className="flex flex-col gap-4">{children}</div>
      </AppScrollArea>
      {footer ? (
        <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border px-5 py-4">
          {footer}
        </footer>
      ) : null}
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 bg-overlay"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("panel-drawer absolute inset-y-0 start-0 flex flex-col", wide && "panel-drawer--wide")}
      >
        {onSubmit ? (
          <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {content}
          </form>
        ) : (
          content
        )}
      </aside>
    </div>,
    document.body,
  );
}

/** Centered dialog for confirmations and short forms. */
export function Modal({ open, onClose, title, subtitle, children, footer, onSubmit }: OverlayProps) {
  const t = useTranslations("Common");
  const titleId = useId();
  useOverlayLock(open, onClose);

  if (!open || typeof document === "undefined") return null;

  const content = (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div id={titleId} className="min-w-0 flex-1 text-start">
          <h2 className="text-[16px] font-semibold text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-surface-muted"
        >
          <CloseCircle size={20} color="currentColor" variant="Linear" />
        </button>
      </header>
      <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto px-5 py-5">{children}</div>
      {footer ? (
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-4">
          {footer}
        </footer>
      ) : null}
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 bg-overlay"
      />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="panel-modal relative flex flex-col">
        {onSubmit ? (
          <form noValidate onSubmit={onSubmit} className="flex flex-col">
            {content}
          </form>
        ) : (
          content
        )}
      </div>
    </div>,
    document.body,
  );
}
