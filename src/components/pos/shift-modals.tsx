"use client";

import { useEffect, useState, useTransition } from "react";
import {
  openShift,
  closeShift,
  addCashMovement,
} from "@/lib/actions/shifts";
import { formatRupiah } from "@/lib/utils/format";
import { Numpad } from "@/components/ui/numpad";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

/**
 * Modal laci kas — SATU-satunya implementasi, dipakai layar Kasir (shift-panel)
 * dan halaman Keuangan (shifts-client). Toast, reset draft, chip "Uang pas",
 * dan banner selisih hidup di sini supaya perilaku kedua tempat selalu identik.
 */

const QUICK_CASH = [50000, 100000, 200000];

export function OpenShiftModal({
  open,
  lock,
  onClose,
  onDone,
}: {
  open: boolean;
  /** true = gate kasir: modal tidak bisa ditutup sebelum shift dibuka. */
  lock: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  // Draft selalu kosong tiap modal dibuka (bawaan lama: nilai sisa masih menempel).
  useEffect(() => {
    if (open) setDraft("");
  }, [open]);

  const submit = () => {
    startTransition(async () => {
      // Kosong / 0 → default 350.000 (modal awal laci).
      const res = await openShift(parseInt(draft, 10) || 350000);
      if (res.ok) {
        toast.success("Shift dibuka — selamat bekerja!");
        onDone();
      } else toast.error(res.error ?? "Gagal buka shift");
    });
  };

  return (
    <Modal open={open} onClose={lock ? () => undefined : onClose} title="Buka Laci Kas">
      <div className="space-y-4">
        {lock && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            Kasir terkunci — buka laci kas dulu untuk mulai melayani.
          </p>
        )}
        <p className="text-sm text-stone-500">
          Isi laci dengan modal awal (default Rp 350.000). Angka ini jadi dasar rekonsiliasi saat tutup shift.
        </p>
        <div className="rounded-xl bg-stone-100 px-4 py-3 text-right text-2xl font-bold tabular-nums dark:bg-stone-800">
          {formatRupiah(parseInt(draft, 10) || 350000)}
        </div>
        <Numpad
          value={draft}
          onChange={setDraft}
          quickAmounts={[350000, 500000]}
          submitLabel="Buka Shift"
          onSubmit={submit}
        />
      </div>
    </Modal>
  );
}

export function CloseShiftModal({
  open,
  expected,
  onClose,
  onDone,
}: {
  open: boolean;
  expected: number;
  onClose: () => void;
  /** Dipanggil setelah tutup sukses; toast sudah dikirim di sini. */
  onDone: (variance: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const counted = parseInt(draft, 10) || 0;
  const variance = counted - expected;

  useEffect(() => {
    if (open) setDraft("");
  }, [open]);

  const submit = () => {
    startTransition(async () => {
      const res = await closeShift(counted);
      if (res.ok) {
        const v = res.variance ?? variance;
        if (v === 0) toast.success("Shift ditutup — kas pas ✓");
        else if (v > 0) toast.success(`Shift ditutup — lebih ${formatRupiah(v)}`);
        else toast.error(`Shift ditutup — kurang ${formatRupiah(-v)}`);
        onDone(v);
      } else toast.error(res.error ?? "Gagal tutup shift");
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Tutup Shift — Hitung Laci">
      <div className="space-y-4">
        <div className="rounded-xl bg-stone-100 p-3 text-sm dark:bg-stone-800">
          <div className="flex justify-between">
            <span className="text-stone-500">Kas yang seharusnya</span>
            <span className="font-bold tabular-nums">{formatRupiah(expected)}</span>
          </div>
        </div>
        <div className="rounded-xl bg-stone-100 px-4 py-3 text-right text-2xl font-bold tabular-nums dark:bg-stone-800">
          {draft ? formatRupiah(counted) : "Rp0"}
        </div>
        {draft !== "" && (
          <div
            className={cn(
              "rounded-xl p-3 text-center text-sm font-bold",
              variance === 0
                ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                : variance > 0
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
            )}
          >
            {variance === 0
              ? "Pas — tidak ada selisih"
              : variance > 0
                ? `Lebih ${formatRupiah(variance)}`
                : `Kurang ${formatRupiah(-variance)}`}
          </div>
        )}
        <Numpad
          value={draft}
          onChange={setDraft}
          submitLabel="Tutup Shift"
          exactAmount={expected} // "Uang pas" = kas seharusnya
          onSubmit={submit}
        />
      </div>
    </Modal>
  );
}

export function CashMovementModal({
  kind,
  onClose,
  onDone,
}: {
  kind: "pay_in" | "pay_out" | "cash_drop" | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [, startTransition] = useTransition();

  const isOut = kind === "pay_out";
  const isDrop = kind === "cash_drop";
  const title = isOut ? "Cash Out (uang keluar)" : isDrop ? "Cash Drop (simpan ke safe)" : "Cash In (uang masuk)";

  // Reset tiap kali modal dibuka dengan kind baru (bug lama: draft sisa menempel).
  useEffect(() => {
    if (kind) {
      setDraft("");
      setNote("");
    }
  }, [kind]);

  const submit = () => {
    if (!kind) return;
    startTransition(async () => {
      const res = await addCashMovement(kind, parseInt(draft, 10) || 0, note);
      if (res.ok) {
        toast.success(isOut ? "Cash out tercatat" : isDrop ? "Cash drop tercatat" : "Cash in tercatat");
        onDone();
      } else {
        toast.error(res.error ?? "Gagal catat mutasi kas");
      }
    });
  };

  return (
    <Modal open={kind !== null} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="rounded-xl bg-stone-100 px-4 py-3 text-right text-2xl font-bold tabular-nums dark:bg-stone-800">
          {draft ? formatRupiah(parseInt(draft, 10) || 0) : "Rp0"}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            isOut ? "Untuk apa? (mis. beli gas)" : isDrop ? "Catatan (opsional)" : "Dari mana? (mis. setoran pemilik)"
          }
          className="w-full rounded-btn border border-stone-300 px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-800"
        />
        <Numpad
          value={draft}
          onChange={setDraft}
          quickAmounts={QUICK_CASH}
          submitLabel={isOut ? "Catat Keluar" : "Catat"}
          onSubmit={submit}
        />
      </div>
    </Modal>
  );
}
