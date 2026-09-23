"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const OUTLET_ID = "00000000-0000-0000-0000-000000000001";

export interface KioskItemInput {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  options: { option_id: string; name: string; price_delta: number }[];
}

/** Order kiosk: langsung confirmed (masuk dapur), pembayaran di kasir. */
export async function createKioskOrder(input: {
  lines: KioskItemInput[];
}): Promise<{ ok: boolean; error?: string; orderId?: string; orderNumber?: number; queueNumber?: number | null }> {
  try {
    if (!input.lines.length) return { ok: false, error: "Belum ada pesanan" };
    const admin = createSupabaseAdminClient();

    const total = input.lines.reduce((s, l) => s + l.unit_price * l.qty + l.options.reduce((a, o) => a + o.price_delta, 0) * l.qty, 0);

    const { data: orderNumber, error: numErr } = await admin.rpc("next_order_number", { p_outlet: OUTLET_ID });
    if (numErr) throw new Error(numErr.message);
    const { data: queueNumber, error: qErr } = await admin.rpc("next_queue_number", { p_outlet: OUTLET_ID });
    if (qErr) throw new Error(qErr.message);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        outlet_id: OUTLET_ID,
        order_number: orderNumber as number,
        queue_number: queueNumber as number,
        channel: "kiosk",
        status: "confirmed",
        items: input.lines.map((l) => ({
          product_id: l.product_id,
          name: l.name,
          qty: l.qty,
          unit_price: l.unit_price,
          subtotal: l.unit_price * l.qty,
          discount: 0,
          note: null,
          options: l.options.map((o) => ({
            option_id: o.option_id,
            option_group_id: o.option_id,
            group_name: "",
            name: o.name,
            price_delta: o.price_delta,
          })),
        })),
        subtotal: total,
        total: total,
        total_paid: 0,
      })
      .select("id")
      .single();
    if (orderErr) throw new Error(orderErr.message);

    for (const l of input.lines) {
      const { data: item, error: itemErr } = await admin
        .from("order_items")
        .insert({
          order_id: order.id,
          product_id: l.product_id,
          name: l.name,
          qty: l.qty,
          unit_price: l.unit_price,
          subtotal: l.unit_price * l.qty,
          discount: 0,
        })
        .select("id")
        .single();
      if (itemErr) throw new Error(itemErr.message);

      if (l.options.length > 0) {
        await admin.from("order_item_options").insert(
          l.options.map((o) => ({
            order_item_id: item.id as string,
            option_id: o.option_id,
            option_group_id: o.option_id,
            name: o.name,
            group_name: "Opsi",
            price_delta: o.price_delta,
          })),
        );
      }
    }

    return { ok: true, orderId: order.id, orderNumber: orderNumber as number, queueNumber: queueNumber as number };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Order kiosk gagal" };
  }
}
