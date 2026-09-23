"use client";

import { Delete } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface NumpadProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  disabled?: boolean;
  quickAmounts?: number[]; // chip nominal cepat (rupiah)
  exactAmount?: number; // bila diisi → tampilkan tombol "Uang pas" (isi nominal persis)
  decimals?: boolean; // izinkan desimal (qty, opname)
  className?: string;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Numpad({
  value,
  onChange,
  onSubmit,
  submitLabel = "OK",
  disabled,
  quickAmounts,
  exactAmount,
  decimals = false,
  className,
}: NumpadProps) {
  // Setelah chip preset / "Uang pas" mengisi nilai, digit berikutnya MENGgANTI
  // (bukan menyambung): klik +10rb lalu "1" → "1", bukan "101". Menyambung
  // lagi hanya lewat penekanan digit berikutnya berturut-turut.
  const [replaceNext, setReplaceNext] = useState(false);
  const push = (d: string) => {
    if (disabled) return;
    if (replaceNext) {
      setReplaceNext(false);
      if (d === ",") {
        onChange("0,");
        return;
      }
      onChange(d);
      return;
    }
    if (decimals && d === "," && value.includes(",")) return;
    if (value === "0" && d !== ",") onChange(d);
    else onChange(value + d);
  };

  const back = () => {
    if (disabled) return;
    setReplaceNext(false);
    onChange(value.slice(0, -1));
  };

  const clear = () => {
    setReplaceNext(false);
    onChange("");
  };

  const setFromPreset = (next: string) => {
    setReplaceNext(true);
    onChange(next);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => push(d)}
            className={cn(
              "touch-target rounded-btn h-14 text-2xl font-semibold shadow-sm transition active:scale-95",
              "bg-white text-stone-900 hover:bg-stone-100 disabled:opacity-40",
              "dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700",
            )}
          >
            {d}
          </button>
        ))}
        {decimals ? (
          <button type="button" onClick={() => push(",")} className={cn(digitClass())}>,</button>
        ) : (
          <button type="button" onClick={clear} className={cn(digitClass(), "text-base font-medium")}>
            C
          </button>
        )}
        <button type="button" onClick={() => push("0")} className={digitClass()}>
          0
        </button>
        <button type="button" onClick={back} className={cn(digitClass(), "flex items-center justify-center")}>
          <Delete className="size-6" />
        </button>
      </div>

      {((quickAmounts && quickAmounts.length > 0) || (exactAmount != null && exactAmount > 0)) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {quickAmounts?.map((amount) => {
            const current = parseInt(value || "0", 10) || 0;
            const active = current === amount;
            return (
              <button
                key={amount}
                type="button"
                disabled={disabled}
                onClick={() => {
                  // SET (bukan tambah): tekan chip = isi nominal persis; tekan ulang = reset.
                  // Digit berikutnya mengganti nilai ini (replace-mode).
                  setFromPreset(active ? "" : String(amount));
                }}
                className={cn(
                  "touch-target rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95",
                  active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-brand-500/40 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300",
                )}
              >
                +{amount >= 1000 ? `${amount / 1000}rb` : amount}
              </button>
            );
          })}
          {exactAmount != null && exactAmount > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setFromPreset(String(exactAmount))}
              className={cn(
                "touch-target rounded-full border px-4 py-2 text-sm font-medium transition active:scale-95 disabled:opacity-40",
                (parseInt(value || "0", 10) || 0) === exactAmount
                  ? "border-stone-800 bg-stone-800 text-white dark:border-stone-200 dark:bg-stone-200 dark:text-stone-900"
                  : "border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-300",
              )}
            >
              Uang pas
            </button>
          )}
        </div>
      )}

      {onSubmit && (
        <button
          type="button"
          disabled={disabled || !value}
          onClick={onSubmit}
          className="touch-target h-14 rounded-btn bg-brand-600 text-lg font-bold text-white shadow transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-40"
        >
          {submitLabel}
        </button>
      )}
    </div>
  );
}

function digitClass() {
  return "touch-target h-14 rounded-btn bg-white text-2xl font-semibold shadow-sm transition active:scale-95 disabled:opacity-40 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700";
}
