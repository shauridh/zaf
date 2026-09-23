"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/session";
import type { CartLine } from "@/lib/pos/cart-math";
import { computeTotals, lineSubtotal, unitPrice, type PricingConfig } from "@/lib/pos/cart-math";
import { getPricingSettings } from "@/lib/pos/pricing";
import { insertPayment, resolveOpenShiftId } from "@/lib/pos/payment-write";

const OUTLET_ID = "00000000-0000-0000-0000-000000000001";

export interface PreorderListItem {
  id: string;
  order_number: number;
  customer_name: string | null;
  customer_phone: string | null;
  scheduled_at: string | null;
  total: number;
  total_paid: number;
  status: string;
  items: { product_id: string | null; name: string; qty: number; image_url: string | null }[];
}

/** Daftar pre-order (scheduled) belum lunas/ambil. */
export async function listPreorders(): Promise<PreorderListItem[]> {
  const admin = createSupabaseAdminClient();
  const [{ data, error }, prodRes] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_phone, scheduled_at, total, total_paid, status, items",
      )
      .not("scheduled_at", "is", null)
      .in("status", ["confirmed", "ready"])
      .order("scheduled_at", { ascending: true })
      .limit(50),
    admin.from("products").select("id, image_url"),
  ]);
  if (error) throw new Error(error.message);
  const imgByProduct = new Map(
    ((prodRes.data ?? []) as { id: string; image_url: string | null }[]).map((p) => [p.id, p.image_url]),
  );
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((o) => ({
    id: o.id as string,
    order_number: o.order_number as number,
    customer_name: (o.customer_name as string) ?? null,
    customer_phone: (o.customer_phone as string) ?? null,
    scheduled_at: (o.scheduled_at as string) ?? null,
    total: Number(o.total),
    total_paid: Number(o.total_paid),
    status: o.status as string,
    items: Array.isArray(o.items)
      ? (o.items as { product_id?: string; name: string; qty: number; image_url?: string | null }[]).map((i) => ({
          product_id: i.product_id ?? null,
          name: i.name,
          qty: i.qty,
          // Prioritas: gambar di snapshot (order lama), lalu join tabel products.
          image_url:
            i.image_url ??
            (i.product_id ? imgByProduct.get(i.product_id) ?? null : null),
        }))
      : [],
  }));
}

export interface PreorderInput {
  customerName: string;
  customerPhone: string;
  scheduledAt: string; // ISO
  lines: CartLine[];
  deposit: number; // nominal DP
  note?: string;
}

/** Buat pre-order: status confirmed + pembayaran kind=deposit. */
export async function createPreorder(
  input: PreorderInput,
): Promise<{ ok: boolean; error?: string; orderId?: string; orderNumber?: number }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    if (!input.lines.length) return { ok: false, error: "Keranjang kosong" };
    if (!input.customerName.trim() || !input.customerPhone.trim()) {
      return { ok: false, error: "Nama & no. HP wajib" };
    }

    const admin = createSupabaseAdminClient();
    const settings = await getPricingSettings();
    const cfg: PricingConfig = {
      taxPercent: settings.taxPercent,
      servicePercent: settings.servicePercent,
      orderDiscount: 0,
      promoDiscount: 0,
      deliveryFee: 0,
      pointsRedeemed: 0,
    };
    const totals = computeTotals(input.lines, cfg);
    const deposit = Math.min(input.deposit, totals.total);

    const { data: orderNumber, error: numErr } = await admin.rpc("next_order_number", { p_outlet: OUTLET_ID });
    if (numErr) throw new Error(numErr.message);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        outlet_id: OUTLET_ID,
        order_number: orderNumber as number,
        channel: "pickup",
        status: "confirmed",
        customer_name: input.customerName.trim(),
        customer_phone: input.customerPhone.trim(),
        scheduled_at: input.scheduledAt,
        note: input.note || null,
        items: input.lines.map((l) => ({
          product_id: l.product_id,
          name: l.name,
          qty: l.qty,
          unit_price: unitPrice(l),
          subtotal: lineSubtotal(l),
          discount: l.discount,
          note: l.note || null,
          options: l.options,
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        service_charge: totals.serviceCharge,
        total: totals.total,
        total_paid: deposit,
        created_by: staff.uid,
      })
      .select("id")
      .single();
    if (orderErr) throw new Error(orderErr.message);

    for (const l of input.lines) {
      await admin.from("order_items").insert({
        order_id: order.id,
        product_id: l.product_id,
        name: l.name,
        qty: l.qty,
        unit_price: unitPrice(l),
        subtotal: lineSubtotal(l),
        discount: l.discount,
        note: l.note || null,
      });
    }

    if (deposit > 0) {
      // DP (uang muka) ikut dicatat ke shift yang terbuka saat uang diterima.
      // Pre-order dari portal bisa masuk di luar jam shift → shift_id null, bukan error.
      await insertPayment(admin, {
        order_id: order.id,
        method: "cash",
        kind: "deposit",
        amount: deposit,
        shift_id: await resolveOpenShiftId(admin, OUTLET_ID),
      });
    }

    return { ok: true, orderId: order.id, orderNumber: orderNumber as number };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal buat pre-order" };
  }
}

/** Pelunasan saat pengambilan: catat payment final sisanya + tandai completed (dengan deduct stok). */
export async function settlePreorder(
  orderId: string,
  method: "cash" | "qris" | "debit" | "transfer",
): Promise<{ ok: boolean; error?: string; change?: number }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    const admin = createSupabaseAdminClient();

    const { data: order } = await admin
      .from("orders")
      .select("total, total_paid, status")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return { ok: false, error: "Pre-order tidak ditemukan" };
    if (order.status === "completed") return { ok: false, error: "Sudah diambil" };

    const remaining = order.total - order.total_paid;
    if (remaining > 0) {
      await insertPayment(admin, {
        order_id: orderId,
        method,
        kind: "final",
        amount: remaining,
        shift_id: await resolveOpenShiftId(admin, OUTLET_ID),
      });
    }

    const { error: rpcErr } = await admin.rpc("complete_order_and_deduct_stock", { p_order_id: orderId });
    if (rpcErr) throw new Error(rpcErr.message);

    const { error: updErr } = await admin
      .from("orders")
      .update({ total_paid: order.total, change_due: 0, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, change: 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal pelunasan" };
  }
}
