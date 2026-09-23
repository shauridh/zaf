"use client";

import { useState, useTransition } from "react";
import { DoorOpen, DoorClosed, ArrowDownToLine, ArrowUpFromLine, Vault } from "lucide-react";
import { openShift } from "@/lib/actions/shifts";
import { printZReport } from "@/lib/printer/print-queue";
import { CashMovementModal, CloseShiftModal } from "@/components/pos/shift-modals";
import { toast } from "@/components/ui/toast";
import { formatRupiah, formatDateID } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface ShiftLite {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  expected_cash: number;
  counted_cash: number | null;
  variance: number | null;
  status: string;
  cash_in: number;
  cash_out: number;
  cash_sales: number;
  non_cash_sales: number;
  order_count: number;
  movements: { id: string; kind: string; amount: number; note: string | null; created_at: string }[];
}

/**
 * Section Laci Kas di halaman Keuangan (server-rendered).
 * Modal buka/tutup/mutasi dipinjam dari `shift-modals.tsx` — implementasi yang
 * sama dengan layar Kasir, jadi perilaku (toast, reset draft, "Uang pas")
 * tidak mungkin berbeda. Halaman di-reload setelah aksi karena data section
 * datang dari server.
 */
export function ShiftsClient({
  openShift: open,
  closed,
  outletName,
  receiptFooter,
}: {
  openShift: ShiftLite | null;
  closed: ShiftLite[];
  outletName: string;
  receiptFooter: string;
}) {
  const [pending, startTransition] = useTransition();
  const [moveModal, setMoveModal] = useState<null | "pay_in" | "pay_out" | "cash_drop">(null);
  const [closeOpen, setCloseOpen] = useState(false);

  const doOpen = () => {
    startTransition(async () => {
      // 0 → modal awal default dari settings diterapkan server-side
      const res = await openShift(0);
      if (res.ok) {
        toast.success("Shift dibuka");
        window.location.reload();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  const printZ = (s: ShiftLite) => {
    void printZReport({
      outletName,
      closedAt: new Date(s.closed_at ?? s.opened_at).toLocaleString("id-ID"),
      openingCash: s.opening_cash,
      cashSales: s.cash_sales,
      cashIn: s.cash_in,
      cashOut: s.cash_out,
      expected: s.expected_cash,
      counted: s.counted_cash ?? 0,
      variance: s.variance ?? 0,
      nonCash: s.non_cash_sales,
      orderCount: s.order_count,
      footer: receiptFooter || "Terima kasih",
    })
      .then((r) => toast.success(r.printed ? "Z report tercetak" : `Masuk antrean cetak (${r.queued})`))
      .catch(() => toast.error("Printer tidak tersedia — Z report masuk antrean"));
  };

  return (
    <div className="space-y-6">
      {open ? (
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <DoorOpen className="size-5 text-green-600" /> Shift Terbuka
              </h2>
              <p className="text-xs text-stone-500">Dibuka {formatDateID(open.opened_at, true)}</p>
            </div>
            <button
              onClick={() => setCloseOpen(true)}
              className="touch-target rounded-btn bg-stone-800 px-4 py-2 text-sm font-bold text-white dark:bg-stone-200 dark:text-stone-900"
            >
              Tutup Shift
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Modal awal" value={open.opening_cash} />
            <Stat label="Penjualan tunai" value={open.cash_sales} />
            <Stat label="Non-tunai" value={open.non_cash_sales} />
            <Stat label="Pay-in" value={open.cash_in} />
            <Stat label="Pay-out" value={open.cash_out} />
            <Stat label="Kas di laci (estimasi)" value={open.expected_cash} highlight />
            <Stat label="Jumlah order" value={open.order_count} plain />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setMoveModal("pay_in")}
              className="touch-target flex flex-1 items-center justify-center gap-2 rounded-btn border border-stone-300 py-3 text-sm font-semibold dark:border-stone-700"
            >
              <ArrowDownToLine className="size-4" /> Pay-in
            </button>
            <button
              onClick={() => setMoveModal("pay_out")}
              className="touch-target flex flex-1 items-center justify-center gap-2 rounded-btn border border-stone-300 py-3 text-sm font-semibold dark:border-stone-700"
            >
              <ArrowUpFromLine className="size-4" /> Pay-out
            </button>
            <button
              onClick={() => setMoveModal("cash_drop")}
              className="touch-target flex flex-1 items-center justify-center gap-2 rounded-btn border border-stone-300 py-3 text-sm font-semibold dark:border-stone-700"
            >
              <Vault className="size-4" /> Cash drop
            </button>
          </div>

          {open.movements.length > 0 && (
            <ul className="mt-4 divide-y divide-stone-100 text-sm dark:divide-stone-800">
              {open.movements.map((m) => (
                <li key={m.id} className="flex justify-between py-2">
                  <span className="capitalize">
                    {m.kind.replace("_", " ")} {m.note ? `· ${m.note}` : ""}
                  </span>
                  <span className="tabular-nums">{formatRupiah(m.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="card flex flex-col items-center gap-4 p-8 text-center">
          <DoorClosed className="size-10 text-stone-300" />
          <p className="text-sm text-stone-500">
            Belum ada shift terbuka. Buka shift untuk mulai merekam penjualan tunai &amp; rekonsiliasi laci.
          </p>
          <button
            onClick={doOpen}
            disabled={pending}
            className="touch-target rounded-btn bg-brand-600 px-8 py-3 font-bold text-white disabled:opacity-40"
          >
            Buka Shift (modal Rp350.000)
          </button>
        </section>
      )}

      {closed.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Riwayat Rekonsiliasi</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase text-stone-400 dark:border-stone-800">
                  <th className="py-2">Ditutup</th>
                  <th className="py-2">Modal</th>
                  <th className="py-2">Expected</th>
                  <th className="py-2">Hitung</th>
                  <th className="py-2">Selisih</th>
                  <th className="py-2">Cetak</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((s) => (
                  <tr key={s.id} className="border-b border-stone-100 dark:border-stone-800">
                    <td className="py-2">{formatDateID(s.closed_at ?? s.opened_at, true)}</td>
                    <td className="py-2 tabular-nums">{formatRupiah(s.opening_cash)}</td>
                    <td className="py-2 tabular-nums">{formatRupiah(s.expected_cash)}</td>
                    <td className="py-2 tabular-nums">{s.counted_cash != null ? formatRupiah(s.counted_cash) : "—"}</td>
                    <td className={cn("py-2 font-bold tabular-nums", (s.variance ?? 0) === 0 ? "text-green-600" : "text-red-500")}>
                      {s.variance != null ? formatRupiah(s.variance) : "—"}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => printZ(s)}
                        className="rounded-lg border border-stone-300 px-2 py-1 text-xs font-bold dark:border-stone-600"
                      >
                        Z Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CashMovementModal
        kind={moveModal}
        onClose={() => setMoveModal(null)}
        onDone={() => {
          setMoveModal(null);
          window.location.reload();
        }}
      />

      <CloseShiftModal
        open={closeOpen}
        expected={open?.expected_cash ?? 0}
        onClose={() => setCloseOpen(false)}
        onDone={() => {
          setCloseOpen(false);
          window.location.reload();
        }}
      />
    </div>
  );
}

function Stat({ label, value, highlight, plain }: { label: string; value: number; highlight?: boolean; plain?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl p-3",
      highlight ? "bg-brand-50 dark:bg-brand-500/10" : "bg-stone-100 dark:bg-stone-800",
    )}>
      <p className="text-[11px] uppercase tracking-wide text-stone-500">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", plain && "text-base", highlight && "text-brand-700 dark:text-brand-300")}>
        {plain ? value : formatRupiah(value)}
      </p>
    </div>
  );
}
