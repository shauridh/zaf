"use client";

import Link from "next/link";
import { Repeat } from "lucide-react";
import { useCart, makeCartOption } from "@/lib/pos/cart-store";
import { formatRupiah, formatDateID } from "@/lib/utils/format";
import type { PortalOrderView } from "@/lib/actions/portal";

interface OrderLite extends PortalOrderView {
  statusLabel: string;
}

export function PortalMyOrdersClient({
  orders,
  logoutAction,
}: {
  orders: OrderLite[];
  logoutAction: () => Promise<void>;
}) {
  const cart = useCart();

  const reorder = (order: OrderLite) => {
    cart.clear();
    for (const item of order.items as unknown as Array<{ product_id?: string; name: string; qty: number; unit_price?: number; options?: { option_id: string; option_group_id: string; group_name: string; name: string; price_delta: number }[] }>) {
        cart.addLine({
        product_id: item.product_id ?? "",
        name: item.name,
        base_price: item.unit_price ?? 0,
        qty: item.qty,
        options: (item.options ?? []).map((o) => makeCartOption(o)),
        note: "",
        discount: 0,
      });
    }
    window.location.href = "/cart";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Pesanan Saya</h1>
        <form action={logoutAction}>
          <button className="text-sm font-semibold text-stone-500 hover:underline">Keluar</button>
        </form>
      </div>

      {orders.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-semibold text-stone-500">Belum ada pesanan</p>
          <Link href="/menu" className="mt-4 inline-block rounded-full bg-brand-600 px-6 py-2.5 text-sm font-bold text-white">
            Pesan Sekarang
          </Link>
        </div>
      )}

      {orders.map((o) => (
        <Link key={o.id} href={`/track/${o.id}`} className="card block p-4 transition hover:border-brand-400">
          <div className="flex items-center justify-between">
            <p className="font-bold">#{o.order_number}</p>
            <span className="text-xs font-semibold text-brand-600">{o.statusLabel}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-stone-500">
            {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-stone-400">{formatDateID(o.created_at, true)}</span>
            <span className="flex items-center gap-2 text-sm font-bold">
              {formatRupiah(o.total)}
              <Repeat
                className="size-4 text-stone-400"
                onClick={(e) => {
                  e.preventDefault();
                  reorder(o);
                }}
              />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
