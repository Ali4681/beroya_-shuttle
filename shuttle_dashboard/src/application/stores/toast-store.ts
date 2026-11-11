"use client";

import { create } from "zustand";

export type ToastTone = "success" | "error" | "info" | "notification";

export type Toast = { id: number; tone: ToastTone; message: string; title?: string };

type ToastState = {
  toasts: Toast[];
  push: (tone: ToastTone, message: string, options?: { durationMs?: number; title?: string }) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (tone, message, options) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, tone, message, title: options?.title }].slice(-4) });
    window.setTimeout(() => get().dismiss(id), options?.durationMs ?? (tone === "error" ? 6000 : 3500));
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
}));

export const toast = {
  success: (message: string) => useToastStore.getState().push("success", message),
  error: (message: string) => useToastStore.getState().push("error", message),
  info: (message: string) => useToastStore.getState().push("info", message),
  /** Incoming push, shown briefly in the top corner on the reading-end side. */
  notification: (title: string, body: string) =>
    useToastStore.getState().push("notification", body, { title, durationMs: 3000 }),
};
