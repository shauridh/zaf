"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Star, Upload } from "lucide-react";
import { submitTransferProof, rateOrder, type PortalOrderView } from "@/lib/actions/portal";
import { listPortalOrders } from "@/lib/actions/portal";
import { toast } from "@/components/ui/toast";
import { formatRupiah, formatDateID } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const STEPS = [
  { key: "unpaid", label: "Menunggu Verifikasi" },
  { key: "confirmed", label: "Diterima" },
  { key: "preparing", label: "Dimasak" },
  { key: "ready", label: "Siap" },
  { key: "completed", label: "Selesai" },
];

export function TrackClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<PortalOrderView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [bank, setBank] = useState("");
  const [rating, setRating] = useState(0);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    listPortalOrders()
      .then((list) => {
        const found = list.find((o) => o.id === orderId);
        if (found) setOrder(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [orderId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000); // in-app refresh tiap 10 detik
    return () => clearInterval(timer);
  }, [refresh]);

  if (notFound) {
    return <p className="py-16 text-center text-sm text-stone-400">Order tidak ditemukan — pastikan kamu login dengan akun yang sama.</p>;
  }
  if (!order) return <p className="py-16 text-center text-sm text-stone-400">Memuat…</p>;

  const stepIndex = STEPS.findIndex((s) => s.key === order.status);
  const cancelled = order.status === "cancelled" || order.status === "refunded";
  const needsProof = order.status === "unpaid";

  const uploadProof = () => {
    if (!proofFile) {
      toast.error("Pilih foto bukti transfer dulu");
      return;
    }
    startTransition(async () => {
      const res = await submitTransferProof(orderId, bank || "Transfer", proofFile);
      if (res.ok) {
        toast.success("Bukti terkirim — menunggu verifikasi kasir");
        setProofFile(null);
        refresh();
      } else toast.error(res.error ?? "Gagal kirim bukti");
    });
  };

  const sendRating = () => {
    if (rating < 1) return;
    startTransition(async () => {
      const res = await rateOrder(orderId, rating, "");
      if (res.ok) {
        toast.success("Terima kasih atas ratingnya!");
        refresh();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  return (
    <div className="space-y-4">
      <div className="card p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-stone-500">Order #{order.order_number}</p>
        {cancelled ? (
          <p className="mt-1 text-2xl font-bold text-red-500">Dibatalkan</p>
        ) : (
          <>
            <p className="mt-1 text-2xl font-bold text-brand-600">
              {STEPS[Math.max(stepIndex, 0)].label}
            </p>
            <div className="mt-4 flex justify-between">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex flex-1 flex-col items-center">
                  <div className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                    i <= stepIndex ? "bg-brand-600 text-white" : "bg-stone-200 text-stone-400 dark:bg-stone-800",
                  )}>
                    {i + 1}
                  </div>
                  <span className={cn("mt-1 text-center text-[9px] leading-tight", i <= stepIndex ? "font-semibold text-stone-700 dark:text-stone-300" : "text-stone-400")}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="mt-4 text-sm text-stone-500">{formatDateID(order.created_at, true)} · {formatRupiah(order.total)}</p>
      </div>

      {needsProof && (
        <div className="card space-y-3 border-amber-300 p-4 dark:border-amber-500/40">
          <p className="text-sm font-bold">Instruksi Pembayaran</p>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Transfer <strong>{formatRupiah(order.total)}</strong> ke rekening toko (lihat di struk/confirm WA toko),
            lalu unggah bukti transfer.
          </p>
          <input
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="Bank pengirim (mis. BCA)"
            className="w-full rounded-btn border border-stone-300 px-4 py-2.5 text-sm dark:border-stone-700 dark:bg-stone-800"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-btn border border-dashed border-stone-300 px-4 py-3 text-sm text-stone-500 dark:border-stone-700">
            <Upload className="size-4" />
            {proofFile ? proofFile.name : "Pilih foto bukti transfer"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            onClick={uploadProof}
            disabled={pending}
            className="touch-target h-11 w-full rounded-btn bg-brand-600 text-sm font-bold text-white disabled:opacity-40"
          >
            {pending ? "Mengirim…" : "Kirim Bukti"}
          </button>
        </div>
      )}

      <div className="card p-4">
        <p className="mb-2 font-bold">Rincian</p>
        <ul className="space-y-1 text-sm">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between">
              <span>{i.qty}× {i.name}</span>
            </li>
          ))}
        </ul>
        {order.address && <p className="mt-2 text-xs text-stone-500">📦 {order.address}</p>}
      </div>

      {order.status === "completed" && !order.rating && (
        <div className="card space-y-2 p-4 text-center">
          <p className="font-bold">Bagaimana pesananmu?</p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} bintang`}>
                <Star className={cn("size-8", n <= rating ? "fill-amber-400 text-amber-400" : "text-stone-300")} />
              </button>
            ))}
          </div>
          <button
            onClick={sendRating}
            disabled={pending || rating < 1}
            className="touch-target h-10 w-full rounded-btn bg-stone-800 text-sm font-bold text-white disabled:opacity-40 dark:bg-stone-200 dark:text-stone-900"
          >
            Kirim Rating
          </button>
        </div>
      )}
      {order.rating != null && (
        <p className="text-center text-sm text-stone-500">Kamu memberi {order.rating}⭐ untuk pesanan ini. Terima kasih!</p>
      )}
    </div>
  );
}
