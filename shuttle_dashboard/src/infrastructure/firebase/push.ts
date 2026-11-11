import type { MessagePayload, Messaging } from "firebase/messaging";
import { env } from "@/infrastructure/config/env";
import { firebaseApp } from "@/infrastructure/firebase/firebase";
import { http } from "@/infrastructure/http/client";

const WORKER_URL = "/firebase-messaging-sw.js";
const WORKER_SCOPE = "/firebase-cloud-messaging-push-scope";
const DEVICE_ID_KEY = "beroya-device-id";
const REGISTERED_KEY = "beroya-push-registered";
const PROJECT_KEY = "beroya-firebase-project";

let messagingPromise: Promise<Messaging | null> | null = null;

function messaging() {
  messagingPromise ??= (async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return null;
    const { getMessaging, isSupported } = await import("firebase/messaging");
    return (await isSupported()) ? getMessaging(firebaseApp()) : null;
  })().catch(() => null);
  return messagingPromise;
}

export function pushSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && window.isSecureContext;
}

function deviceId() {
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Drop stale workers / tokens when the Firebase project in env changes. */
async function resetIfProjectChanged() {
  const previous = window.localStorage.getItem(PROJECT_KEY);
  const current = env.firebase.projectId;
  if (previous === current) return;
  messagingPromise = null;
  window.localStorage.removeItem(REGISTERED_KEY);
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((entry) => (entry.active ?? entry.waiting ?? entry.installing)?.scriptURL.includes(WORKER_URL))
      .map((entry) => entry.unregister()),
  );
  window.localStorage.setItem(PROJECT_KEY, current);
}

/** The worker cannot read env vars, so it receives the Firebase config through its URL. */
async function registerWorker() {
  await resetIfProjectChanged();
  const params = new URLSearchParams(
    Object.entries(env.firebase).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const scope = new URL(WORKER_SCOPE, window.location.origin).href;
  const expected = `${WORKER_URL}?${params}`;

  const existing = await navigator.serviceWorker.getRegistration(scope);
  if (existing) {
    const script = (existing.active ?? existing.waiting ?? existing.installing)?.scriptURL ?? "";
    if (!script.includes(`projectId=${encodeURIComponent(env.firebase.projectId)}`) && !script.includes(env.firebase.projectId)) {
      await existing.unregister();
    }
  }

  const strays = (await navigator.serviceWorker.getRegistrations()).filter(
    (other) => other.scope !== scope && (other.active ?? other.waiting ?? other.installing)?.scriptURL.includes(WORKER_URL),
  );
  await Promise.all(strays.map((other) => other.unregister()));

  const registration = await navigator.serviceWorker.register(expected, { scope: WORKER_SCOPE });
  await registration.update().catch(() => undefined);
  const pendingWorker = registration.installing ?? registration.waiting;
  if (!registration.active && pendingWorker) {
    await new Promise<void>((resolve) => {
      pendingWorker.addEventListener("statechange", () => {
        if (pendingWorker.state === "activated") resolve();
      });
    });
  }
  return registration;
}

/** Gets the FCM token for this browser and stores it on the backend. Needs granted permission. */
export async function registerPushDevice() {
  if (Notification.permission !== "granted") return false;
  await resetIfProjectChanged();
  const instance = await messaging();
  if (!instance) return false;
  const { getToken } = await import("firebase/messaging");
  const token = await getToken(instance, {
    vapidKey: env.firebaseVapidKey || undefined,
    serviceWorkerRegistration: await registerWorker(),
  });
  if (!token) return false;
  await http.post("/auth/devices", {
    deviceId: deviceId(),
    fcmToken: token,
    platform: "WEB",
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "web",
  });
  window.localStorage.setItem(REGISTERED_KEY, "1");
  window.localStorage.setItem(PROJECT_KEY, env.firebase.projectId);
  return true;
}

/** Stops pushes to this browser; called on logout while the session is still valid. */
export async function unregisterPushDevice() {
  if (typeof window === "undefined" || window.localStorage.getItem(REGISTERED_KEY) !== "1") return;
  window.localStorage.removeItem(REGISTERED_KEY);
  await http.delete(`/auth/devices/${encodeURIComponent(deviceId())}`).catch(() => undefined);
  const instance = await messaging();
  if (instance) {
    const { deleteToken } = await import("firebase/messaging");
    await deleteToken(instance).catch(() => undefined);
  }
}

/** Chrome hides a service-worker notification while this tab is focused, and hides
    `new Notification()` while another app is focused. Use whichever the window can. */
export async function showSystemNotification(payload: MessagePayload) {
  const title = payload.notification?.title ?? "";
  const body = payload.notification?.body ?? "";
  if ((!title && !body) || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body,
    icon: payload.notification?.icon,
    tag: payload.messageId || `beroya-${Date.now()}`,
    silent: false,
  };
  if (document.visibilityState === "visible") {
    const shown = new Notification(title || body, options);
    shown.onclick = () => {
      window.focus();
      shown.close();
    };
    return;
  }
  const registrations = await navigator.serviceWorker.getRegistrations();
  const registration =
    registrations.find((entry) => entry.scope.includes("firebase-cloud-messaging-push-scope")) ?? registrations[0];
  await registration?.showNotification(title || body, options);
}

/** Foreground messages are not shown by the browser, so the app renders them itself. */
export async function onForegroundPush(handler: (payload: MessagePayload) => void) {
  const instance = await messaging();
  if (!instance) return () => undefined;
  const { onMessage } = await import("firebase/messaging");
  return onMessage(instance, handler);
}
