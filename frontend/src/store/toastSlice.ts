import { StateCreator } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** ms; 0 = sticky until dismissed */
  duration: number;
}

export interface ToastSlice {
  toasts: ToastItem[];
  showToast: (message: string, kind?: ToastKind, duration?: number) => number;
  dismissToast: (id: number) => void;
}

let nextId = 1;

export const createToastSlice: StateCreator<ToastSlice, [], [], ToastSlice> = (set, get) => ({
  toasts: [],
  showToast: (message, kind = 'info', duration = 3500) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, duration }] }));
    if (duration > 0) {
      setTimeout(() => get().dismissToast(id), duration);
    }
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
});
