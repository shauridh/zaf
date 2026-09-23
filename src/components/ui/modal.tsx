"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
}

const SIZES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, children, size = "md", footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl dark:bg-stone-900 sm:rounded-2xl",
          SIZES[size],
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="touch-target flex items-center justify-center rounded-lg p-2 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
              aria-label="Tutup"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-stone-200 px-5 py-4 dark:border-stone-800">{footer}</div>
        )}
      </div>
    </div>
  );
}
