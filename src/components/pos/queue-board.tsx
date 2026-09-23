"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { listKitchenOrders, type KitchenOrder } from "@/lib/actions/kitchen";

/** Papan antrean big-screen — tampilkan di TV/monitor menghadap pelanggan. */
export function QueueBoard() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);

  useEffect(() => {
    let active = true;
    const load = () => {
      listKitchenOrders()
        .then((list) => {
          if (active) setOrders(list.filter((o) => o.status === "ready"));
        })
        .catch(() => undefined);
    };
    load();

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("queue-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    const timer = setInterval(load, 10000);

    return () => {
      active = false;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-stone-950 p-10 text-white">
      <h1 className="text-4xl font-bold tracking-wide">PANGGILAN ANTREAN</h1>
      {orders.length === 0 ? (
        <p className="text-2xl text-stone-500">Belum ada pesanan siap</p>
      ) : (
        <div className="flex flex-wrap justify-center gap-8">
          {orders.map((o) => (
            <div
              key={o.id}
              className="animate-pulse rounded-3xl bg-brand-600 px-14 py-10 text-center shadow-2xl"
            >
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-200">Siap diambil</p>
              <p className="text-7xl font-black tabular-nums">#{o.queue_number ?? o.order_number}</p>
              <p className="mt-1 text-lg text-brand-100">
                {o.channel === "dine_in" && o.table_label ? `Meja ${o.table_label}` : channelLabel(o.channel)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function channelLabel(channel: string): string {
  const map: Record<string, string> = {
    dine_in: "Makan di Tempat",
    takeaway: "Bawa Pulang",
    gofood: "GoFood",
    grabfood: "GrabFood",
    shopeefood: "ShopeeFood",
    kiosk: "Kiosk",
    pickup: "Ambil Sendiri",
    delivery: "Delivery",
    self_delivery: "Kurir Sendiri",
  };
  return map[channel] ?? channel;
}
