"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/session";
import { businessDateWIB } from "@/lib/utils/format";
import type { CartLine } from "@/lib/pos/cart-math";
import { cartSubtotal, computeTotals, lineSubtotal, unitPrice, type PricingConfig } from "@/lib/pos/cart-math";

import { MARKETPLACE_CHANNELS, type MarketplaceChannel } from "@/lib/pos/channel-meta";

const OUTLET_ID = "00000000-0000-0000-0000-000000000001";

export interface ChannelOrderInput {
  channel: MarketplaceChannel;
  externalRef: string;
  customerName: string;
  items: { product_id: string; name: string; qty: number; unit_price: number }[];
  feePercent: number;
  note?: string;
}

/** Entri cepat order dari app marketplace (masuk KDS juga). */
export async function createChannelOrder(
  input: ChannelOrderInput,
): Promise<{ ok: boolean; error?: string; orderId?: string }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    if (!input.items.length) return { ok: false, error: "Item kosong" };

    const admin = createSupabaseAdminClient();

    const lines: CartLine[] = input.items.map((i) => ({
      key: `${i.product_id}|${i.name}`,
      product_id: i.product_id,
      name: i.name,
      base_price: i.unit_price,
      qty: i.qty,
      options: [],
      note: "",
      discount: 0,
    }));

    const subtotal = cartSubtotal(lines);
    const cfg: PricingConfig = {
      taxPercent: 0, // marketplace sudah memotong pajak di sisi app
      servicePercent: 0,
      orderDiscount: 0,
      promoDiscount: 0,
      deliveryFee: 0,
      pointsRedeemed: 0,
    };
    const totals = computeTotals(lines, cfg);
    const fee = Math.round((subtotal * input.feePercent) / 100);

    const { data: orderNumber, error: numErr } = await admin.rpc("next_order_number", { p_outlet: OUTLET_ID });
    if (numErr) throw new Error(numErr.message);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        outlet_id: OUTLET_ID,
        order_number: orderNumber as number,
        channel: input.channel,
        status: "confirmed",
        customer_name: input.customerName || null,
        note: input.note || null,
        external_ref: input.externalRef || null,
        items: input.items.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          qty: i.qty,
          unit_price: i.unit_price,
          subtotal: i.unit_price * i.qty,
          discount: 0,
          note: null,
          options: [],
        })),
        subtotal: totals.subtotal,
        total: totals.total,
        total_paid: totals.total,
        channel_fee: fee,
        created_by: staff.uid,
      })
      .select("id")
      .single();
    if (orderErr) throw new Error(orderErr.message);

    for (const l of lines) {
      await admin.from("order_items").insert({
        order_id: order.id,
        product_id: l.product_id,
        name: l.name,
        qty: l.qty,
        unit_price: unitPrice(l),
        subtotal: lineSubtotal(l),
        discount: 0,
      });
    }

    return { ok: true, orderId: order.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal simpan order kanal" };
  }
}

/** Ringkasan penjualan kanal hari ini (business date WIB). */
export async function channelSummaryToday(): Promise<
  { channel: string; orders: number; gross: number; fee: number; net: number }[]
> {
  const admin = createSupabaseAdminClient();
  const today = businessDateWIB();
  // Ambil order sejak tanggal bisnis hari ini (WIB) → gunakan rentang UTC kasar:
  const startWIB = new Date(`${today}T00:00:00+07:00`).toISOString();

  const { data } = await admin
    .from("orders")
    .select("channel, total, channel_fee")
    .in("channel", [...MARKETPLACE_CHANNELS])
    .in("status", ["confirmed", "preparing", "ready", "completed"])
    .gte("created_at", startWIB);

  const map = new Map<string, { orders: number; gross: number; fee: number }>();
  for (const row of (data ?? []) as { channel: string; total: number; channel_fee: number }[]) {
    const entry = map.get(row.channel) ?? { orders: 0, gross: 0, fee: 0 };
    entry.orders += 1;
    entry.gross += row.total;
    entry.fee += row.channel_fee;
    map.set(row.channel, entry);
  }

  return MARKETPLACE_CHANNELS.map((c) => {
    const entry = map.get(c) ?? { orders: 0, gross: 0, fee: 0 };
    return {
      channel: c,
      orders: entry.orders,
      gross: entry.gross,
      fee: entry.fee,
      net: entry.gross - entry.fee,
    };
  });
}
