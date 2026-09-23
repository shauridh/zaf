"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/lib/pos/cart-store";
import { computeTotals, lineSubtotal, unitPrice, type PricingConfig } from "@/lib/pos/cart-math";
import { portalCheckout } from "@/lib/actions/portal";
import { toast } from "@/components/ui/toast";
import { formatRupiah } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function PortalCartClient({
  loggedIn,
  memberPoints,
  deliveryFeeFlat,
  deliveryFeePerKm,
}: {
  loggedIn: boolean;
  memberPoints: number;
  deliveryFeeFlat: number;
  deliveryFeePerKm: number;
}) {
  const cart = useCart();
  const [fulfillment, setFulfillment] = useState<"pickup" | "self_delivery">("pickup");
  const [address, setAddress] = useState("");
  const [distance, setDistance] = useState(3);
  const [note, setNote] = useState("");
  const [pointsRedeem, setPointsRedeem] = useState(0);
  const [pending, startTransition] = useTransition();

  const deliveryFee =
    fulfillment === "self_delivery" ? deliveryFeeFlat + Math.round(distance * deliveryFeePerKm) : 0;

  const totals = computeTotals(cart.lines, {
    taxPercent: 0,
    servicePercent: 0,
    orderDiscount: 0,
    promoDiscount: 0,
    deliveryFee,
    pointsRedeemed: 0,
  } satisfies PricingConfig);

  const checkout = () => {
    if (!loggedIn) {
      window.location.href = "/portal-login";
      return;
    }
    startTransition(async () => {
      const res = await portalCheckout({
        fulfillment,
        address,
        distanceKm: distance,
        lines: cart.lines,
        note,
        pointsRedeem,
      });
      if (res.ok) {
        cart.clear();
        window.location.href = `/track/${res.orderId}`;
      } else toast.error(res.error ?? "Checkout gagal");
    });
  };

  if (cart.lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-4xl">🛒</p>
        <p className="mt-2 font-semibold">Keranjang masih kosong</p>
        <Link href="/menu" className="mt-4 inline-block rounded-full bg-brand-600 px-6 py-2.5 text-sm font-bold text-white">
          Lihat Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="card divide-y divide-stone-100 dark:divide-stone-800">
        {cart.lines.map((l) => (
          <li key={l.key} className="flex items-center justify-between gap-2 p-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">{l.name}</p>
              {l.options.map((o) => (
                <p key={o.option_id} className="text-xs text-stone-500">+ {o.name}</p>
              ))}
              {l.note && <p className="text-xs italic text-amber-600">{l.note}</p>}
              <p className="text-sm font-bold text-brand-600">{formatRupiah(lineSubtotal(l))}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => cart.setQty(l.key, l.qty - 1)} className="touch-target rounded-lg border border-stone-300 p-1.5 dark:border-stone-700"><Minus className="size-4" /></button>
              <span className="w-7 text-center font-bold tabular-nums">{l.qty}</span>
              <button onClick={() => cart.setQty(l.key, l.qty + 1)} className="touch-target rounded-lg border border-stone-300 p-1.5 dark:border-stone-700"><Plus className="size-4" /></button>
              <button onClick={() => cart.removeLine(l.key)} className="touch-target p-1.5 text-red-400"><Trash2 className="size-4" /></button>
            </div>
          </li>
        ))}
      </ul>

      <div className="card space-y-3 p-4">
        <p className="font-bold">Metode</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setFulfillment("pickup")}
            className={cn("touch-target rounded-btn border-2 py-3 text-sm font-bold", fulfillment === "pickup" ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-stone-200 dark:border-stone-700")}
          >
            🏪 Ambil Sendiri
          </button>
          <button
            onClick={() => setFulfillment("self_delivery")}
            className={cn("touch-target rounded-btn border-2 py-3 text-sm font-bold", fulfillment === "self_delivery" ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-stone-200 dark:border-stone-700")}
          >
            🛵 Diantar
          </button>
        </div>
        {fulfillment === "self_delivery" && (
          <>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Alamat lengkap pengiriman"
              rows={2}
              className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
            />
            <label className="block text-sm text-stone-600 dark:text-stone-400">
              Jarak ± {distance} km (ongkir {formatRupiah(deliveryFee)})
              <input
                type="range"
                min={1}
                max={8}
                value={distance}
                onChange={(e) => setDistance(Number(e.target.value))}
                className="mt-1 w-full accent-brand-600"
              />
            </label>
          </>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan untuk resto (opsional)"
          className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
        />
        {memberPoints > 0 && (
          <label className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-sm dark:bg-brand-500/10">
            <span>Tukar poin ({memberPoints} tersedia)</span>
            <input
              type="number"
              min={0}
              max={memberPoints}
              value={pointsRedeem}
              onChange={(e) => setPointsRedeem(Number(e.target.value) || 0)}
              className="w-20 rounded-btn border border-stone-300 px-2 py-1 text-right dark:border-stone-700 dark:bg-stone-800"
            />
          </label>
        )}
      </div>

      <div className="card space-y-1.5 p-4 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatRupiah(totals.subtotal)}</span></div>
        {deliveryFee > 0 && <div className="flex justify-between"><span>Ongkir</span><span className="tabular-nums">{formatRupiah(deliveryFee)}</span></div>}
        <div className="flex justify-between border-t border-dashed border-stone-300 pt-2 text-lg font-bold dark:border-stone-700">
          <span>Total</span><span className="tabular-nums">{formatRupiah(totals.total)}</span>
        </div>
        <p className="text-xs text-stone-500">Bayar via transfer bank — kirim bukti setelah checkout.</p>
      </div>

      <button
        onClick={checkout}
        disabled={pending}
        className="touch-target h-13 w-full rounded-btn bg-brand-600 py-3.5 text-lg font-bold text-white disabled:opacity-40"
      >
        {pending ? "Memproses…" : loggedIn ? `Checkout · ${formatRupiah(totals.total)}` : "Masuk untuk Checkout"}
      </button>
      <p className="text-center text-xs text-stone-400">
        Harga {cart.lines.length > 0 ? `· ${cart.lines.reduce((s, l) => s + l.qty, 0)} item` : ""} · unit price from {formatRupiah(Math.min(...cart.lines.map((l) => unitPrice(l))))}
      </p>
    </div>
  );
}
