"use client";

import { useMemo, useState, useTransition } from "react";
import { createKioskOrder } from "@/lib/actions/kiosk";
import { useCart } from "@/lib/pos/cart-store";
import { formatRupiah } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Modal } from "@/components/ui/modal";
import { OptionModal } from "@/components/pos/option-modal";
import type { CatalogGroup } from "@/lib/actions/catalog";

interface KioskProduct {
  id: string;
  name: string;
  price: number;
  category_id: string;
  hasOptions: boolean;
  optionGroups: CatalogGroup[];
}

export function KioskClient({
  categories,
  products,
}: {
  categories: { id: string; name: string }[];
  products: KioskProduct[];
}) {
  const cart = useCart();
  const [activeCat, setActiveCat] = useState("all");
  const [optionProduct, setOptionProduct] = useState<KioskProduct | null>(null);
  const [done, setDone] = useState<null | { orderNumber: number; queueNumber: number | null }>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () => (activeCat === "all" ? products : products.filter((p) => p.category_id === activeCat)),
    [products, activeCat],
  );

  const total = useMemo(
    () => cart.lines.reduce((s, l) => s + (l.base_price + l.options.reduce((a, o) => a + o.price_delta, 0)) * l.qty - l.discount, 0),
    [cart.lines],
  );

  const submit = () => {
    startTransition(async () => {
      const res = await createKioskOrder({
        lines: cart.lines.map((l) => ({
          product_id: l.product_id,
          name: l.name,
          qty: l.qty,
          unit_price: l.base_price,
          options: l.options.map((o) => ({ option_id: o.option_id, name: o.name, price_delta: o.price_delta })),
        })),
      });
      if (res.ok) {
        setDone({ orderNumber: res.orderNumber ?? 0, queueNumber: res.queueNumber ?? null });
        cart.clear();
      } else {
        alert(res.error ?? "Gagal");
      }
    });
  };

  return (
    <div className="flex h-dvh flex-col bg-stone-950 text-white">
      <header className="flex items-center justify-between border-b border-stone-800 px-6 py-4">
        <h1 className="text-2xl font-black">🍗 PESAN DI SINI</h1>
        <p className="text-sm text-stone-400">Bayar di kasir setelah memesan</p>
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-stone-800 px-6 py-3">
        <button
          onClick={() => setActiveCat("all")}
          className={cn("shrink-0 rounded-full px-5 py-2.5 text-base font-bold", activeCat === "all" ? "bg-brand-600" : "bg-stone-800 text-stone-300")}
        >
          Semua
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={cn("shrink-0 rounded-full px-5 py-2.5 text-base font-bold", activeCat === c.id ? "bg-brand-600" : "bg-stone-800 text-stone-300")}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-2 content-start gap-4 overflow-y-auto p-6 lg:grid-cols-4">
        {visible.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              if (p.hasOptions) setOptionProduct(p);
              else cart.addLine({ product_id: p.id, name: p.name, base_price: p.price, qty: 1, options: [], note: "", discount: 0 });
            }}
            className="flex min-h-28 flex-col items-start justify-between rounded-2xl bg-stone-900 p-5 text-left ring-1 ring-stone-800 transition active:scale-[0.97] hover:ring-brand-500"
          >
            <span className="text-lg font-bold leading-tight">{p.name}</span>
            <span className="text-brand-400">{formatRupiah(p.price)}</span>
          </button>
        ))}
      </div>

      <footer className="flex items-center justify-between border-t border-stone-800 px-6 py-4">
        <span className="text-lg">
          {cart.lines.reduce((s, l) => s + l.qty, 0)} item · <strong>{formatRupiah(total)}</strong>
        </span>
        <button
          onClick={submit}
          disabled={pending || cart.lines.length === 0}
          className="touch-target rounded-2xl bg-brand-600 px-10 py-4 text-xl font-black disabled:opacity-40"
        >
          {pending ? "Memproses…" : "PESAN SEKARANG"}
        </button>
      </footer>

      {optionProduct && (
        <OptionModal
          product={{
            id: optionProduct.id,
            category_id: optionProduct.category_id,
            name: optionProduct.name,
            description: null,
            price: optionProduct.price,
            image_url: null,
            is_active: true,
            track_stock: true,
            sort_order: 0,
            option_groups: optionProduct.optionGroups,
          }}
          onClose={() => setOptionProduct(null)}
        />
      )}

      <Modal open={!!done} onClose={() => setDone(null)} title="Pesanan Diterima!" size="sm">
        {done && (
          <div className="py-6 text-center">
            <p className="text-6xl font-black text-brand-500">#{done.queueNumber ?? done.orderNumber}</p>
            <p className="mt-2 text-lg font-bold">Nomor antrean kamu</p>
            <p className="mt-1 text-sm text-stone-500">Tunjukkan ke kasir untuk membayar. Pantau papan antrean!</p>
            <button
              onClick={() => setDone(null)}
              className="mt-6 w-full rounded-btn bg-brand-600 py-3 text-lg font-bold text-white"
            >
              Selesai
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
