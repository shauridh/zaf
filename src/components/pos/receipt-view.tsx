"use client";

import { useEffect, useState } from "react";
import { formatRupiah, formatDateID } from "@/lib/utils/format";

interface ReceiptItemOption {
  name: string;
  group_name: string;
  price_delta: number;
}

interface ReceiptItem {
  name: string;
  qty: number;
  unit_price: number;
  subtotal: number;
  note: string | null;
  order_item_options: ReceiptItemOption[] | null;
}

interface ReceiptData {
  order: {
    id: string;
    order_number: number;
    queue_number: number | null;
    channel: string;
    status: string;
    created_at: string;
    table_label: string | null;
    subtotal: number;
    order_discount: number;
    promo_discount: number;
    tax: number;
    service_charge: number;
    total: number;
    total_paid: number;
    change_due: number;
    order_items: ReceiptItem[];
  };
  outlet: { name: string; address: string | null };
  footer: string;
  qr: string;
}

export function ReceiptView({ orderId }: { orderId: string }) {
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/receipt/${orderId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, [orderId]);

  if (error) return <p className="p-8 text-center text-sm text-red-500">Struk tidak ditemukan.</p>;
  if (!data) return <p className="p-8 text-center text-sm text-stone-400">Memuat…</p>;

  const { order } = data;
  const CHANNEL_LABEL: Record<string, string> = {
    dine_in: "Makan di Tempat",
    takeaway: "Bawa Pulang",
    delivery: "Delivery",
    gofood: "GoFood",
    grabfood: "GrabFood",
    shopeefood: "ShopeeFood",
    self_delivery: "Delivery Sendiri",
    pickup: "Ambil Sendiri",
    kiosk: "Kiosk",
  };

  return (
    <div className="mx-auto w-full max-w-xs bg-white p-5 font-mono text-[11px] leading-relaxed text-stone-800 shadow print:shadow-none">
      <div className="text-center">
        <p className="text-sm font-bold">{data.outlet.name}</p>
        {data.outlet.address && <p>{data.outlet.address}</p>}
      </div>
      <p className="my-2 border-y border-dashed border-stone-400 py-1 text-center">
        {CHANNEL_LABEL[order.channel] ?? order.channel} · #{order.order_number}
        {order.queue_number ? ` · Antrean ${order.queue_number}` : ""}
      </p>
      <p>{formatDateID(order.created_at, true)}</p>
      {order.table_label && <p>Meja: {order.table_label}</p>}

      <div className="my-2 border-y border-dashed border-stone-400 py-1">
        {order.order_items.map((item, idx) => (
          <div key={idx} className="mb-1">
            <div className="flex justify-between">
              <span className="truncate">{item.qty}× {item.name}</span>
              <span>{item.subtotal.toLocaleString("id-ID")}</span>
            </div>
            {item.order_item_options?.map((o, i) => (
              <p key={i} className="pl-3 text-stone-500">
                + {o.name}{o.price_delta > 0 ? ` (+${o.price_delta.toLocaleString("id-ID")})` : ""}
              </p>
            ))}
            {item.note && <p className="pl-3 italic text-amber-700">* {item.note}</p>}
          </div>
        ))}
      </div>

      <div className="space-y-0.5">
        <Row label="Subtotal" value={order.subtotal} />
        {order.order_discount > 0 && <Row label="Diskon" value={-order.order_discount} />}
        {order.promo_discount > 0 && <Row label="Promo" value={-order.promo_discount} />}
        {order.service_charge > 0 && <Row label="Service charge" value={order.service_charge} />}
        {order.tax > 0 && <Row label="Pajak" value={order.tax} />}
        <div className="flex justify-between border-t border-dashed border-stone-400 pt-1 text-sm font-bold">
          <span>TOTAL</span>
          <span>{formatRupiah(order.total)}</span>
        </div>
        <Row label="Dibayar" value={order.total_paid} />
        {order.change_due > 0 && <Row label="Kembali" value={order.change_due} />}
      </div>

      <div className="mt-3 border-t border-dashed border-stone-400 pt-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.qr} alt="E-receipt QR" className="mx-auto size-20" />
        <p className="mt-1 text-[10px] text-stone-500">Scan untuk struk digital</p>
        <p className="mt-2">{data.footer}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value.toLocaleString("id-ID")}</span>
    </div>
  );
}
