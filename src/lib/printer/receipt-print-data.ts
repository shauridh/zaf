import type { ReceiptPrintData } from "@/lib/printer/escpos";

interface ReceiptApiResponse {
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
    total_paid: number;
    change_due: number;
    order_items: {
      qty: number;
      name: string;
      subtotal: number;
      note: string | null;
      order_item_options: { name: string }[] | null;
    }[];
  };
  outlet: { name: string };
  footer: string;
}

const CHANNEL_LABEL: Record<string, string> = {
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

/** Ambil data struk dari API lalu petakan ke format cetak ESC/POS. */
export async function fetchReceiptPrintData(orderId: string): Promise<ReceiptPrintData> {
  const res = await fetch(`/api/receipt/${orderId}`);
  if (!res.ok) throw new Error("Struk tidak ditemukan");
  const data = (await res.json()) as ReceiptApiResponse;
  return {
    outletName: data.outlet.name,
    orderNumber: data.order.order_number,
    queueNumber: data.order.queue_number,
    channelLabel: CHANNEL_LABEL[data.order.channel] ?? data.order.channel,
    createdAt: new Date(data.order.created_at).toLocaleString("id-ID"),
    tableLabel: data.order.table_label,
    items: data.order.order_items.map((i) => ({
      qty: i.qty,
      name: i.name,
      subtotal: i.subtotal,
      note: i.note,
      options: (i.order_item_options ?? []).map((o) => o.name),
    })),
    subtotal: data.order.subtotal,
    discounts: data.order.order_discount + data.order.promo_discount,
    tax: data.order.tax,
    serviceCharge: data.order.service_charge,
    total: data.order.total,
    paid: data.order.total_paid,
    change: data.order.change_due,
    footer: data.footer,
  };
}
