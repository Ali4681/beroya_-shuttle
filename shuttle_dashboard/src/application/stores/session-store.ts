"use client";

import { create } from "zustand";
import type { User } from "@/domain/models/entities";
import { readSession } from "@/shared/lib/session";

type SessionState = {
  user: User | null;
  hydrated: boolean;
  hydrate: () => void;
  setUser: (user: User | null) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  hydrated: false,
  hydrate: () => set({ user: readSession()?.user ?? null, hydrated: true }),
  setUser: (user) => set({ user, hydrated: true }),
}));
