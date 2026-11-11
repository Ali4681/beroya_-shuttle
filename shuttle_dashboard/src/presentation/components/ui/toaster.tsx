"use client";

import { CloseCircle, InfoCircle, NotificationBing, TickCircle, Warning } from "iconsax-react-v2";
import { useToastStore, type Toast } from "@/application/stores/toast-store";
import { cn } from "@/shared/lib/cn";

const icons = {
  success: TickCircle,
  error: Warning,
  info: InfoCircle,
  notification: NotificationBing,
} as const;

function ToastItem({ item, onDismiss }: { item: Toast; onDismiss: () => void }) {
  const Icon = icons[item.tone];
  return (
    <div className={cn("toast", `toast--${item.tone}`)}>
      <Icon
        size={18}
        variant="Bold"
        color="currentColor"
        className={cn(
          "mt-0.5 shrink-0",
          item.tone === "success" && "text-success",
          item.tone === "error" && "text-danger",
          (item.tone === "info" || item.tone === "notification") && "text-accent",
        )}
      />
      <div className="min-w-0 flex-1 text-start leading-6">
        {item.title ? <p className="font-semibold text-text-primary">{item.title}</p> : null}
        {item.message ? <p className={cn(item.title && "text-text-secondary")}>{item.message}</p> : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-text-muted transition hover:text-text-primary"
        aria-label="×"
      >
        <CloseCircle size={16} color="currentColor" variant="Linear" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  const notifications = toasts.filter((item) => item.tone === "notification");
  const messages = toasts.filter((item) => item.tone !== "notification");

  return (
    <>
      {notifications.length ? (
        <div className="toast-stack toast-stack--top" role="status" aria-live="polite">
          {notifications.map((item) => (
            <ToastItem key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </div>
      ) : null}
      {messages.length ? (
        <div className="toast-stack" role="status" aria-live="polite">
          {messages.map((item) => (
            <ToastItem key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </div>
      ) : null}
    </>
  );
}
