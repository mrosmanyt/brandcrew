import { create } from "zustand";

export interface Toast {
  id: string;
  type: "success" | "error" | "info";
  text: string;
}

interface ToastState {
  toasts: Toast[];
  notify: (type: Toast["type"], text: string) => void;
  dismiss: (id: string) => void;
}

/** Lightweight toast queue — success / error feedback across the app. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  notify: (type, text) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, type, text }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      4200,
    );
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper usable outside React components. */
export const notify = (type: Toast["type"], text: string) =>
  useToastStore.getState().notify(type, text);
