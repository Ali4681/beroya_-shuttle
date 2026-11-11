"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  ensureInboxHydrated,
  useInboxStore,
  type InboxItem,
} from "@/application/stores/notification-inbox-store";
import { useSessionStore } from "@/application/stores/session-store";
import { toast } from "@/application/stores/toast-store";
import { drainInboxQueue, INBOX_UPDATED_MESSAGE } from "@/infrastructure/firebase/inbox-queue";
import {
  onForegroundPush,
  pushSupported,
  registerPushDevice,
  showSystemNotification,
} from "@/infrastructure/firebase/push";
import { pickNotificationLocale } from "@/shared/lib/notification-i18n";

export type PushPermission = NotificationPermission | "unsupported";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PushPermission {
  return pushSupported() ? Notification.permission : "unsupported";
}

function getServerSnapshot(): PushPermission {
  return "unsupported";
}

const TOAST_RECENT_MS = 60_000;

/** Adds pushes to the bell and pops up the ones that are new and recent. Both the foreground
    listener and the worker queue deliver the same push, so the second arrival is ignored. */
async function receive(items: Omit<InboxItem, "read">[]) {
  await ensureInboxHydrated();
  const known = new Set(useInboxStore.getState().items.map((item) => item.id));
  const fresh = items.filter((item) => !known.has(item.id));
  useInboxStore.getState().add(fresh);
  fresh
    .filter((item) => Date.now() - Date.parse(item.receivedAt) < TOAST_RECENT_MS)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    .slice(-2)
    .forEach((item) => {
      const text = pickNotificationLocale(item.title, item.body, document.documentElement.lang.startsWith("en") ? "en" : "ar");
      toast.notification(text.title, text.body);
    });
}

/** Waits until the tab is visible so pushes that arrived while away still pop up on return. */
function syncInbox() {
  if (document.visibilityState !== "visible") return;
  drainInboxQueue()
    .then(receive)
    .catch(() => undefined);
}

/** Registers this browser for FCM pushes once the signed-in user has granted permission. */
export function usePushNotifications() {
  const signedIn = useSessionStore((state) => Boolean(state.user));
  const permission = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Ask the browser Allow / Block prompt as soon as the dashboard opens (signed in).
  useEffect(() => {
    if (!signedIn || !pushSupported()) return;
    if (Notification.permission !== "default") return;
    let cancelled = false;
    void Notification.requestPermission().then(() => {
      if (!cancelled) {
        for (const listener of listeners) listener();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || permission !== "granted") return;
    registerPushDevice().catch((error: unknown) => {
      console.warn("Push registration failed", error);
    });

    syncInbox();
    function onWorkerMessage(event: MessageEvent) {
      if (event.data?.type === INBOX_UPDATED_MESSAGE) syncInbox();
    }
    function onVisible() {
      if (document.visibilityState === "visible") syncInbox();
    }
    navigator.serviceWorker.addEventListener("message", onWorkerMessage);
    document.addEventListener("visibilitychange", onVisible);

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void onForegroundPush((payload) => {
      const title = payload.notification?.title ?? "";
      const body = payload.notification?.body ?? "";
      if (!title && !body) return;
      void receive([{ id: payload.messageId, title, body, receivedAt: new Date().toISOString() }]);
      void showSystemNotification(payload).catch(() => undefined);
    }).then((stop) => {
      if (cancelled) stop();
      else unsubscribe = stop;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
      navigator.serviceWorker.removeEventListener("message", onWorkerMessage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn, permission]);

  /** Opens the browser's native Allow / Block prompt (not an in-app dialog). */
  const enable = useCallback(async () => {
    if (!pushSupported()) return;
    if (Notification.permission === "denied") {
      for (const listener of listeners) listener();
      return;
    }
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    for (const listener of listeners) listener();
  }, []);

  return { permission, enable };
}
