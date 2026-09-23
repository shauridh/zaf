"use client";

import { useState, useTransition } from "react";
import { Check, X, Bike, Zap } from "lucide-react";
import { verifyTransfer, type UnpaidPortalOrder } from "@/lib/actions/portal-verify";
import {
  assignRider,
  bookOnDemand,
  quoteOnDemand,
  updateJobStatus,
  listDeliveryOrders,
  type DeliveryJobView,
} from "@/lib/actions/delivery";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { formatRupiah, formatDateID } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface RiderLite {
  id: string;
  name: string;
  active: boolean;
}

export function DeliveryClient({
  unpaid,
  riders,
  jobs,
}: {
  unpaid: UnpaidPortalOrder[];
  riders: RiderLite[];
  jobs: DeliveryJobView[];
}) {
  const [pending, startTransition] = useTransition();
  const [dispatchFor, setDispatchFor] = useState<null | { id: string; order_number: number; address: string | null }>(null);
  const [deliveryOrders, setDeliveryOrders] = useState<Awaited<ReturnType<typeof listDeliveryOrders>>>([]);

  const verify = (orderId: string, approve: boolean) => {
    startTransition(async () => {
      const res = await verifyTransfer(orderId, approve);
      if (res.ok) {
        toast.success(approve ? "Transfer disetujui — order masuk dapur" : "Order ditolak");
        window.location.reload();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  const openDispatch = () => {
    listDeliveryOrders().then(setDeliveryOrders);
    setDispatchFor(null);
    setDispatchListOpen(true);
  };
  const [dispatchListOpen, setDispatchListOpen] = useState(false);

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-1 text-lg font-bold">Verifikasi Transfer Portal</h2>
        <p className="mb-3 text-sm text-stone-500">Order pelanggan menunggu konfirmasi pembayaran manual.</p>
        {unpaid.length === 0 ? (
          <p className="text-sm text-stone-400">Tidak ada order menunggu verifikasi.</p>
        ) : (
          <ul className="space-y-2">
            {unpaid.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-500/10">
                <div>
                  <p className="font-bold">#{o.order_number} · {o.customer_name ?? "—"}</p>
                  <p className="text-xs text-stone-500">{formatDateID(o.created_at, true)} · {formatRupiah(o.total)}</p>
                  <p className="text-xs text-stone-400">{o.channel === "pickup" ? "Ambil sendiri" : "Diantar"}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => verify(o.id, true)}
                    disabled={pending}
                    className="touch-target flex items-center gap-1 rounded-btn bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    <Check className="size-4" /> Setujui
                  </button>
                  <button
                    onClick={() => verify(o.id, false)}
                    disabled={pending}
                    className="touch-target flex items-center gap-1 rounded-btn border border-red-300 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-40"
                  >
                    <X className="size-4" /> Tolak
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Dispatch</h2>
          <button onClick={openDispatch} className="touch-target flex items-center gap-1 rounded-btn bg-brand-600 px-4 py-2 text-sm font-bold text-white">
            <Bike className="size-4" /> Dispatch Order
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-stone-400">Belum ada job delivery.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm dark:divide-stone-800">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold">
                    #{j.order_number ?? "?"} · <span className="capitalize">{j.provider}</span>
                    {j.rider_name ? ` · ${j.rider_name}` : ""}
                  </p>
                  <p className="text-xs text-stone-500">{j.address ?? "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-bold",
                    j.status === "delivered" ? "bg-green-100 text-green-700 dark:bg-green-500/10" : "bg-stone-100 text-stone-600 dark:bg-stone-800",
                  )}>
                    {j.status.replace("_", " ")}
                  </span>
                  <span className="text-xs tabular-nums text-stone-500">fee {formatRupiah(j.fee)}</span>
                  {["assigned", "pending"].includes(j.status) && (
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          const res = await updateJobStatus(j.id, "picked_up");
                          if (res.ok) window.location.reload();
                          else toast.error(res.error ?? "Gagal");
                        })
                      }
                      className="rounded-btn border border-stone-300 px-2.5 py-1.5 text-xs font-semibold dark:border-stone-700"
                    >
                      Jemput
                    </button>
                  )}
                  {j.status === "picked_up" && (
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          const res = await updateJobStatus(j.id, "delivered");
                          if (res.ok) window.location.reload();
                          else toast.error(res.error ?? "Gagal");
                        })
                      }
                      className="rounded-btn bg-green-600 px-2.5 py-1.5 text-xs font-bold text-white"
                    >
                      Terkirim
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={dispatchListOpen} onClose={() => setDispatchListOpen(false)} title="Dispatch Order Delivery" size="lg">
        {deliveryOrders.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">Tidak ada order delivery aktif.</p>
        ) : (
          <ul className="space-y-2">
            {deliveryOrders.map((o) => (
              <li key={o.id} className="card flex items-center justify-between p-3">
                <div>
                  <p className="font-bold">#{o.order_number}</p>
                  <p className="text-xs text-stone-500">{o.address ?? "—"}</p>
                </div>
                <button
                  onClick={() => setDispatchFor(o)}
                  className="touch-target rounded-btn bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                >
                  Pilih Kurir
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal open={!!dispatchFor} onClose={() => setDispatchFor(null)} title={`Kurir untuk #${dispatchFor?.order_number ?? ""}`}>
        {dispatchFor && (
          <DispatchForm
            orderId={dispatchFor.id}
            address={dispatchFor.address ?? ""}
            riders={riders}
            onDone={() => {
              setDispatchFor(null);
              setDispatchListOpen(false);
              window.location.reload();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

type QuoteProvider = "estimasi" | "lalamove" | "pandago";

function DispatchForm({
  orderId,
  address,
  riders,
  onDone,
}: {
  orderId: string;
  address: string;
  riders: RiderLite[];
  onDone: () => void;
}) {
  void address;
  const [riderId, setRiderId] = useState(riders[0]?.id ?? "");
  const [quote, setQuote] = useState<null | { provider: QuoteProvider; fee: number }>(null);
  const [pending, startTransition] = useTransition();

  const getQuote = () => {
    startTransition(async () => {
      const res = await quoteOnDemand(orderId);
      if (res.ok && res.provider) {
        setQuote({ provider: res.provider as QuoteProvider, fee: res.fee ?? 0 });
      }
      else toast.error(res.error ?? "Quote gagal");
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-bold">Rider Internal</p>
        <div className="flex gap-2">
          <select
            value={riderId}
            onChange={(e) => setRiderId(e.target.value)}
            className="flex-1 rounded-btn border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800"
          >
            {riders.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={() =>
              startTransition(async () => {
                const res = await assignRider(orderId, riderId);
                if (res.ok) {
                  toast.success("Rider di-assign");
                  onDone();
                } else toast.error(res.error ?? "Gagal");
              })
            }
            disabled={pending || !riderId}
            className="touch-target rounded-btn bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            Assign
          </button>
        </div>
      </div>

      <div className="border-t border-dashed border-stone-300 pt-4 dark:border-stone-700">
        <p className="mb-1 flex items-center gap-1 text-sm font-bold">
          <Zap className="size-4 text-amber-500" /> Kurir On-Demand (tanpa komisi %)
        </p>
        {quote ? (
          <div className="flex items-center justify-between rounded-xl bg-stone-100 p-3 text-sm dark:bg-stone-800">
            <span className="capitalize">{quote.provider} — {formatRupiah(quote.fee)} /trip</span>
            <button
              onClick={() =>
                startTransition(async () => {
                  const res = await bookOnDemand(orderId, quote.provider, quote.fee);
                  if (res.ok) {
                    toast.success("Booking tercatat");
                    onDone();
                  } else toast.error(res.error ?? "Gagal");
                })
              }
              disabled={pending}
              className="rounded-btn bg-brand-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
            >
              Booking
            </button>
          </div>
        ) : (
          <button onClick={getQuote} disabled={pending} className="w-full rounded-btn border border-dashed border-stone-300 py-2.5 text-sm font-semibold text-stone-500 dark:border-stone-700">
            {pending ? "Meminta quote…" : "Minta Quote On-Demand"}
          </button>
        )}
        <p className="mt-1 text-xs text-stone-400">
          Bandingkan: marketplace memotong ±20–25% nilai order; on-demand hanya fee per trip.
        </p>
      </div>
    </div>
  );
}
