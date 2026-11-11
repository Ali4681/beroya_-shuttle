"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  receivedAt: string;
  read: boolean;
};

const MAX_ITEMS = 50;

type InboxState = {
  items: InboxItem[];
  add: (items: Omit<InboxItem, "read">[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
};

/** Pushes received by this browser. The backend has no inbox for admins, so it lives in localStorage. */
export const useInboxStore = create<InboxState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (incoming) => {
        const known = new Set(get().items.map((item) => item.id));
        const fresh = incoming.filter((item) => !known.has(item.id)).map((item) => ({ ...item, read: false }));
        if (!fresh.length) return;
        const items = [...fresh, ...get().items]
          .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
          .slice(0, MAX_ITEMS);
        set({ items });
      },
      markRead: (id) =>
        set({ items: get().items.map((item) => (item.id === id ? { ...item, read: true } : item)) }),
      markAllRead: () => set({ items: get().items.map((item) => ({ ...item, read: true })) }),
      clear: () => set({ items: [] }),
    }),
    // Rehydrated after mount so the server-rendered header matches the first client render.
    { name: "beroya-inbox", skipHydration: true },
  ),
);

/** Call before writing so stored items are loaded first and not overwritten. */
export async function ensureInboxHydrated() {
  if (!useInboxStore.persist.hasHydrated()) await useInboxStore.persist.rehydrate();
}
