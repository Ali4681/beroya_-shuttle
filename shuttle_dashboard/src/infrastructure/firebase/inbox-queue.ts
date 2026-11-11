import type { InboxItem } from "@/application/stores/notification-inbox-store";

/* Must match the names used by public/firebase-messaging-sw.js, which fills this queue for pushes
   that arrive while no dashboard tab is visible. */
const DB_NAME = "beroya-push";
const STORE = "inbox";

export const INBOX_UPDATED_MESSAGE = "beroya-inbox-updated";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Returns and removes everything the service worker queued. */
export async function drainInboxQueue(): Promise<Omit<InboxItem, "read">[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const request = store.getAll();
      request.onsuccess = () => store.clear();
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
