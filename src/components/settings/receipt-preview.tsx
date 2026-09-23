"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "@/lib/utils/format";

const CHANNEL_LABEL: Record<string, string> = {
  dine_in: "Makan di Tempat",
  takeaway: "Bawa Pulang",
  delivery: "Delivery",
  gofood: "GoFood",
  grabfood: "GrabFood",
  shopeefood: "ShopeeFood",
  self_delivery: "Delivery Mandiri",
  pickup: "Ambil Sendiri",
  kiosk: "Kiosk",
};

interface ReceiptData {
  order: {
    order_number: number;
    queue_number: number | null;
    channel: string;
    created_at: string;
    table_label: string | null;
    subtotal: number;
    order_discount: number;
    promo_discount: number;
    tax: number;
    service_charge: number;
    total: number;
    total_paid: number | null;
    change_due: number | null;
    order_items: {
      qty: number;
      name: string;
      subtotal: number;
      note: string | null;
      order_item_options?: { name: string }[] | null;
    }[];
  };
  outlet: { name: string; address: string | null };
  footer: string;
}

/** Simulasi struk thermal 58mm dari data order terakhir. */
export function ReceiptPreview() {
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/receipt/last")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Belum ada order untuk dipreview"))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return <p className="py-8 text-center text-sm text-stone-400">{error}</p>;
  }
  if (!data) {
    return <p className="py-8 text-center text-sm text-stone-400">Memuat struk…</p>;
  }

  const { order, outlet, footer } = data;
  const discounts = order.order_discount + order.promo_discount;

  return (
    <div className="mx-auto w-[300px] bg-white p-4 font-mono text-[11px] leading-relaxed text-stone-800 shadow-sm ring-1 ring-stone-200">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-wide">{outlet.name}</p>
        {outlet.address && <p className="text-[10px]">{outlet.address}</p>}
        <p className="mt-1 text-[10px]">
          #{order.order_number}
          {order.queue_number ? ` · Antrean ${order.queue_number}` : ""} ·{" "}
          {CHANNEL_LABEL[order.channel] ?? order.channel}
        </p>
        <p className="text-[10px]">
          {new Date(order.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
        </p>
      </div>

      <div className="my-2 border-t border-dashed border-stone-300" />

      <table className="w-full">
        <tbody>
          {order.order_items.map((i, idx) => (
            <tr key={idx} className="align-top">
              <td className="w-6 pr-1">{i.qty}×</td>
              <td>
                {i.name}
                {(i.order_item_options ?? []).map((o, oi) => (
                  <span key={oi} className="block text-[10px] text-stone-500">
                    + {o.name}
                  </span>
                ))}
                {i.note && <span className="block text-[10px] italic text-amber-600">“{i.note}”</span>}
              </td>
              <td className="whitespace-nowrap pl-1 text-right">{formatRupiah(i.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed border-stone-300" />

      <div className="space-y-0.5">
        <Row label="Subtotal" value={formatRupiah(order.subtotal)} />
        {discounts > 0 && <Row label="Diskon" value={`−${formatRupiah(discounts)}`} />}
        {order.tax > 0 && <Row label="Pajak" value={formatRupiah(order.tax)} />}
        {order.service_charge > 0 && <Row label="Service" value={formatRupiah(order.service_charge)} />}
        <div className="my-1 border-t border-dashed border-stone-300" />
        <Row label="TOTAL" value={formatRupiah(order.total)} bold />
        {order.total_paid != null && order.total_paid > 0 && (
          <>
            <Row label="Tunai" value={formatRupiah(order.total_paid)} />
            {order.change_due != null && order.change_due > 0 && (
              <Row label="Kembali" value={formatRupiah(order.change_due)} />
            )}
          </>
        )}
      </div>

      <div className="my-2 border-t border-dashed border-stone-300" />
      <p className="text-center text-[10px]">{footer}</p>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={bold ? "flex justify-between font-bold" : "flex justify-between"}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
