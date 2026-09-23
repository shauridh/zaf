"use client";

import { useEffect, useState } from "react";
import { Numpad } from "@/components/ui/numpad";
import { formatRupiah } from "@/lib/utils/format";

interface MoneyInputProps {
  label?: string;
  value: number; // integer rupiah
  onChange: (value: number) => void;
  placeholder?: string;
  quickAmounts?: number[];
  decimals?: boolean;
  suffix?: string;
}

/** Input angka/uang untuk layar sentuh — klik memunculkan numpad. */
export function MoneyInput({
  label,
  value,
  onChange,
  placeholder = "0",
  quickAmounts,
  decimals = false,
  suffix,
}: MoneyInputProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  // Draft ter-reset ke nilai terkini tiap numpad dibuka (bukan melanjutkan ketikan lama).
  useEffect(() => {
    if (open) setDraft(value > 0 ? String(value) : "");
  }, [open, value]);

  const display = decimals
    ? String(value)
    : value > 0
      ? formatRupiah(value)
      : "";

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-400">{label}</label>}
      <button
        type="button"
        onClick={() => {
          setDraft(value > 0 ? String(value) : "");
          setOpen(true);
        }}
        className="touch-target w-full rounded-btn border border-stone-300 bg-white px-4 py-3 text-left text-xl font-semibold tabular-nums dark:border-stone-700 dark:bg-stone-800"
      >
        {display || <span className="font-normal text-stone-400">{placeholder}</span>}
        {suffix && <span className="ml-2 text-sm font-normal text-stone-500">{suffix}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-xs space-y-3 rounded-t-2xl bg-white p-4 dark:bg-stone-900 sm:rounded-2xl">
            <div className="rounded-xl bg-stone-100 px-4 py-3 text-right text-2xl font-bold tabular-nums dark:bg-stone-800">
              {draft ? (decimals ? draft : formatRupiah(parseInt(draft, 10) || 0)) : "0"}
            </div>
            <Numpad
              value={draft}
              onChange={setDraft}
              decimals={decimals}
              quickAmounts={quickAmounts}
              submitLabel="Selesai"
              onSubmit={() => {
                onChange(decimals ? parseFloat(draft.replace(",", ".")) || 0 : parseInt(draft, 10) || 0);
                setOpen(false);
              }}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-btn py-2 text-sm text-stone-500 hover:underline"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
