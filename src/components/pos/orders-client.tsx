"use client";

import { useState, useTransition } from "react";
import { CalendarClock, HandCoins } from "lucide-react";
import { settlePreorder, type PreorderListItem } from "@/lib/actions/preorder";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { formatRupiah, formatDateID } from "@/lib/utils/format";

export function OrdersClient({ preorders }: { preorders: PreorderListItem[] }) {
  const [settleFor, setSettleFor] = useState<PreorderListItem | null>(null);
  const [pending, startTransition] = useTransition();

  const doSettle = (method: "cash" | "qris" | "debit" | "transfer") => {
    if (!settleFor) return;
    startTransition(async () => {
      const res = await settlePreorder(settleFor.id, method);
      if (res.ok) {
        toast.success("Pre-order lunas & diambil");
        setSettleFor(null);
        window.location.reload();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  return (
    <div className="space-y-3">
      {preorders.length === 0 && (
        <p className="card py-12 text-center text-sm text-stone-400">
          Belum ada pre-order aktif. Buat dari layar Kasir via Info Pesanan (jadwal ambil).
        </p>
      )}
      {preorders.map((o) => {
        const remaining = o.total - o.total_paid;
        return (
          <div key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold">
                #{o.order_number} · {o.customer_name ?? "—"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {o.items.map((i, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1.5 rounded-full bg-stone-100 py-0.5 pl-0.5 pr-2 text-xs font-semibold dark:bg-stone-800"
                    title={i.name}
                  >
                    {i.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={i.image_url}
                        alt=""
                        loading="lazy"
                        className="size-6 rounded-full bg-stone-200 object-cover dark:bg-stone-700"
                      />
                    ) : (
                      <span className="flex size-6 items-center justify-center rounded-full bg-stone-200 text-xs dark:bg-stone-700">
                        🍗
                      </span>
                    )}
                    {i.qty}× {i.name}
                  </span>
                ))}
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                <CalendarClock className="size-3.5" /> Ambil {formatDateID(o.scheduled_at ?? "", true)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums">{formatRupiah(o.total)}</p>
              <p className="text-xs text-stone-500">
                DP {formatRupiah(o.total_paid)} · sisa{" "}
                <span className={remaining > 0 ? "font-bold text-red-500" : "text-green-600"}>
                  {formatRupiah(remaining)}
                </span>
              </p>
              {remaining > 0 && (
                <button
                  onClick={() => setSettleFor(o)}
                  className="touch-target mt-1 flex items-center gap-1 rounded-btn bg-brand-600 px-3 py-1.5 text-xs font-bold text-white"
                >
                  <HandCoins className="size-4" /> Lunasi & Ambil
                </button>
              )}
            </div>
          </div>
        );
      })}

      <Modal open={!!settleFor} onClose={() => setSettleFor(null)} title="Pelunasan Pre-Order">
        <div className="space-y-3">
          <p className="text-sm text-stone-500">
            Sisa tagihan <span className="font-bold text-stone-800 dark:text-stone-200">{formatRupiah(settleFor ? settleFor.total - settleFor.total_paid : 0)}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["cash", "qris", "debit", "transfer"] as const).map((m) => (
              <button
                key={m}
                onClick={() => doSettle(m)}
                disabled={pending}
                className="touch-target rounded-btn border-2 border-stone-200 py-3 text-sm font-bold uppercase disabled:opacity-40 dark:border-stone-700"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
