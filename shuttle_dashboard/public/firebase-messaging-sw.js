/* Firebase Cloud Messaging worker: shows pushes while the dashboard tab is closed or in the background.
   The Firebase config arrives as query params on the worker URL (see src/infrastructure/firebase/push.ts).
   Keep the compat version in sync with the `firebase` package. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Registered before Firebase so it still runs when Firebase stops propagation for its own messages.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL("/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      return open ? open.focus() : self.clients.openWindow(target);
    }),
  );
});

/* Queues every push for the header bell (src/infrastructure/firebase/inbox-queue.ts drains it).
   The page dedupes by FCM message id, so foreground pushes it also receives directly are not doubled. */
function queueForInbox(item) {
  return new Promise((resolve) => {
    const request = indexedDB.open("beroya-push", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("inbox", { keyPath: "id" });
    request.onerror = () => resolve();
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("inbox", "readwrite");
      tx.objectStore("inbox").put(item);
      tx.oncomplete = tx.onerror = () => {
        db.close();
        resolve();
      };
    };
  });
}

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    return;
  }
  const notification = (payload && payload.notification) || {};
  if (!notification.title && !notification.body) return;
  const item = {
    id: payload.fcmMessageId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: notification.title || "",
    body: notification.body || "",
    receivedAt: new Date().toISOString(),
  };
  event.waitUntil(
    queueForInbox(item)
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then((windows) => {
        windows.forEach((client) => client.postMessage({ type: "beroya-inbox-updated" }));
        // Always show a system notification so the user sees it even with the dashboard focused.
        return self.registration.showNotification(notification.title || "", {
          body: notification.body || "",
          icon: notification.icon,
          tag: item.id,
          renotify: true,
        });
      }),
  );
});

importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const config = Object.fromEntries(params.entries());

if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  firebase.messaging();
}
