import { create } from "zustand";

export interface Toast {
  id: string;
  text: string;
}

interface ToastState {
  toasts: Toast[];
  push: (text: string) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (text) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (text: string) => useToasts.getState().push(text);
