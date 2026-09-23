"use client";

import { useEffect, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { listKitchenOrders, type KitchenOrder } from "@/lib/actions/kitchen";
import { setOrderStatus } from "@/lib/actions/orders";
import { toast } from "@/components/ui/toast";
import { playChime } from "@/lib/pos/sound";
import { printKitchenTicket } from "@/lib/printer/print-queue";
import { cn } from "@/lib/utils/cn";

const COLUMNS: { status: string; label: string; next: string | null; color: string }[] = [
  { status: "confirmed", label: "Baru", next: "preparing", color: "border-blue-400" },
  { status: "preparing", label: "Dimasak", next: "ready", color: "border-amber-400" },
  { status: "ready", label: "Siap", next: null, color: "border-green-400" },
];

export function KitchenBoard({ soundEnabled }: { soundEnabled: boolean }) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    const load = () => {
      listKitchenOrders()
        .then((list) => {
          if (!active) return;
          setOrders((prev) => {
            const prevIds = new Set(prev.map((o) => o.id));
            const hasNew = list.some((o) => !prevIds.has(o.id));
            if (hasNew && prev.length >= 0 && prevIds.size > 0 && soundEnabled) playChime();
            return list;
          });
        })
        .catch(() => undefined);
    };
    load();

    // Realtime: refresh saat orders berubah
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("kds-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();

    // Polling fallback setiap 15 detik
    const timer = setInterval(load, 15000);

    return () => {
      active = false;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [soundEnabled]);

  const advance = (order: KitchenOrder, next: string) => {
    startTransition(async () => {
      const res = await setOrderStatus(order.id, next as never);
      if (res.ok) {
        setOrders((prev) =>
          next === "completed"
            ? prev.filter((o) => o.id !== order.id)
            : prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
        );
      } else toast.error(res.error ?? "Gagal");
    });
  };

  return (
    <div className="grid h-full grid-cols-1 gap-4 p-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const list = orders.filter((o) => o.status === col.status);
        return (
          <section key={col.status} className="flex min-h-0 flex-col rounded-2xl bg-stone-100 p-3 dark:bg-stone-900">
            <h2 className="mb-3 flex items-center justify-between text-sm font-bold uppercase tracking-wide text-stone-500">
              {col.label}
              <span className="rounded-full bg-white px-2 py-0.5 text-xs dark:bg-stone-800">{list.length}</span>
            </h2>
            <div className="flex-1 space-y-3 overflow-y-auto">
              {list.length === 0 && <p className="py-8 text-center text-xs text-stone-400">Kosong</p>}
              {list.map((o) => (
                <KitchenCard
                  key={o.id}
                  order={o}
                  accent={col.color}
                  onNext={col.next ? () => advance(o, col.next!) : undefined}
                  onComplete={col.status === "ready" ? () => advance(o, "completed") : undefined}
                  disabled={pending}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KitchenCard({
  order,
  accent,
  onNext,
  onComplete,
  disabled,
}: {
  order: KitchenOrder;
  accent: string;
  onNext?: () => void;
  onComplete?: () => void;
  disabled?: boolean;
}) {
  const minutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const late = minutes >= 10;

  return (
    <div className={cn("card border-l-4 p-3", accent, late && "border-red-400 ring-1 ring-red-300")}>
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold">
          #{order.order_number}
          {order.queue_number ? <span className="ml-2 text-sm text-stone-400">Q{order.queue_number}</span> : null}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              printKitchenTicket({
                orderNumber: order.order_number,
                queueNumber: order.queue_number,
                channelLabel: channelShort(order.channel),
                tableLabel: order.table_label,
                items: order.items.map((i) => ({
                  qty: i.qty,
                  name: i.name,
                  options: i.options.map((o) => o.name),
                  note: i.note,
                })),
                orderNote: order.note,
              })
                .then((r) => toast.success(r.printed ? "Tiket dapur tercetak" : `Masuk antrean cetak (${r.queued})`))
                .catch(() => toast.error("Printer tidak tersedia — tiket masuk antrean"));
            }}
            title="Cetak tiket dapur"
            className="rounded-lg border border-stone-300 px-1.5 py-0.5 text-xs dark:border-stone-600"
          >
            🖨
          </button>
          <span className={cn("text-xs font-bold tabular-nums", late ? "text-red-500" : "text-stone-400")}>
            {minutes}m
          </span>
        </div>
      </div>
      <p className="text-xs text-stone-500">
        {order.table_label ? `Meja ${order.table_label} · ` : ""}
        {channelShort(order.channel)}
        {order.training ? " · LATIHAN" : ""}
      </p>
      <ul className="mt-2 space-y-1">
        {order.items.map((item, idx) => (
          <li key={idx} className="text-sm">
            <span className="font-bold">{item.qty}×</span> {item.name}
            {item.options.map((o, i) => (
              <span key={i} className="text-xs text-stone-500"> · {o.name}</span>
            ))}
            {item.note && <span className="block pl-6 text-xs italic text-amber-600">{item.note}</span>}
          </li>
        ))}
      </ul>
      {order.note && <p className="mt-1 text-xs italic text-stone-500">Catatan: {order.note}</p>}
      <div className="mt-2 flex gap-2">
        {onNext && (
          <button
            onClick={onNext}
            disabled={disabled}
            className="touch-target flex-1 rounded-btn bg-stone-800 py-2 text-xs font-bold text-white disabled:opacity-40 dark:bg-stone-200 dark:text-stone-900"
          >
            Proses →
          </button>
        )}
        {onComplete && (
          <button
            onClick={onComplete}
            disabled={disabled}
            className="touch-target flex-1 rounded-btn bg-green-600 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            Selesai / Ambil
          </button>
        )}
      </div>
    </div>
  );
}

function channelShort(channel: string): string {
  const map: Record<string, string> = {
    dine_in: "Dine-in",
    takeaway: "Takeaway",
    delivery: "Delivery",
    gofood: "GoFood",
    grabfood: "GrabFood",
    shopeefood: "ShopeeFood",
    self_delivery: "Kurir Sendiri",
    pickup: "Pickup",
    kiosk: "Kiosk",
  };
  return map[channel] ?? channel;
}
