"use client";

import { create } from "zustand";
import { AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ToastKind = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push("success", m),
  error: (m: string) => useToastStore.getState().push("error", m),
  info: (m: string) => useToastStore.getState().push("info", m),
  warning: (m: string) => useToastStore.getState().push("warning", m),
};

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const STYLES: Record<ToastKind, string> = {
  success: "border-green-500/40 bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300",
  error: "border-red-500/40 bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300",
  info: "border-stone-300 bg-white text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200",
  warning: "border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
};

export function ToastHost() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium shadow-lg transition",
              STYLES[t.kind],
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            {t.message}
          </button>
        );
      })}
    </div>
  );
}
