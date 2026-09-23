"use client";

import { useState, useTransition } from "react";
import { createChannelOrder } from "@/lib/actions/channels";
import { CHANNEL_META, type MarketplaceChannel } from "@/lib/pos/channel-meta";
import { toast } from "@/components/ui/toast";
import { formatRupiah } from "@/lib/utils/format";

interface ProductLite {
  id: string;
  name: string;
  price: number;
}

export function ChannelsClient({
  summary,
  products,
}: {
  summary: { channel: string; orders: number; gross: number; fee: number; net: number }[];
  products: ProductLite[];
}) {
  const [pending, startTransition] = useTransition();
  const [channel, setChannel] = useState<MarketplaceChannel>("gofood");
  const [externalRef, setExternalRef] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [items, setItems] = useState<{ product_id: string; qty: string }[]>([
    { product_id: products[0]?.id ?? "", qty: "1" },
  ]);

  const submit = () => {
    startTransition(async () => {
      const res = await createChannelOrder({
        channel,
        externalRef,
        customerName,
        feePercent: CHANNEL_META[channel].defaultFeePercent,
        items: items
          .map((i) => {
            const p = products.find((x) => x.id === i.product_id)!;
            return { product_id: i.product_id, name: p.name, qty: parseInt(i.qty, 10) || 0, unit_price: p.price };
          })
          .filter((i) => i.qty > 0),
      });
      if (res.ok) {
        toast.success("Order kanal masuk dapur");
        setExternalRef("");
        setCustomerName("");
        setItems([{ product_id: products[0]?.id ?? "", qty: "1" }]);
        window.location.reload();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {summary.map((s) => {
          const meta = CHANNEL_META[s.channel as MarketplaceChannel];
          return (
            <div key={s.channel} className="card p-4">
              <p className="text-sm font-bold">
                {meta.emoji} {meta.label}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{formatRupiah(s.gross)}</p>
              <p className="text-xs text-stone-500">{s.orders} order · fee {formatRupiah(s.fee)}</p>
              <p className="mt-1 border-t border-dashed border-stone-300 pt-1 text-sm font-bold text-green-600 dark:border-stone-700">
                Net: {formatRupiah(s.net)}
              </p>
            </div>
          );
        })}
      </div>

      <section className="card space-y-4 p-5">
        <h2 className="font-bold">Entri Order Cepat</h2>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(CHANNEL_META) as MarketplaceChannel[]).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`touch-target rounded-btn border-2 py-3 text-sm font-bold ${
                channel === c
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                  : "border-stone-200 dark:border-stone-700"
              }`}
            >
              {CHANNEL_META[c].emoji} {CHANNEL_META[c].label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={externalRef}
            onChange={(e) => setExternalRef(e.target.value)}
            placeholder="No. order dari app (opsional)"
            className="rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
          />
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nama pelanggan (opsional)"
            className="rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
          />
        </div>

        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <select
              value={item.product_id}
              onChange={(e) => setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, product_id: e.target.value } : x)))}
              className="flex-1 rounded-btn border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatRupiah(p.price)}
                </option>
              ))}
            </select>
            <input
              value={item.qty}
              onChange={(e) => setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))}
              className="w-16 rounded-btn border border-stone-300 px-3 py-2 text-center text-sm dark:border-stone-700 dark:bg-stone-800"
              inputMode="numeric"
            />
          </div>
        ))}
        <button
          onClick={() => setItems((arr) => [...arr, { product_id: products[0]?.id ?? "", qty: "1" }])}
          className="w-full rounded-btn border border-dashed border-stone-300 py-2 text-sm font-semibold text-stone-500 dark:border-stone-700"
        >
          + Tambah item
        </button>

        <button
          onClick={submit}
          disabled={pending}
          className="touch-target h-12 w-full rounded-btn bg-brand-600 font-bold text-white disabled:opacity-40"
        >
          {pending ? "Menyimpan…" : "Masukkan ke Dapur"}
        </button>
      </section>
    </div>
  );
}
