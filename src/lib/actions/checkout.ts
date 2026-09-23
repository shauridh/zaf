"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/session";
import {
  cartSubtotal,
  computeTotals,
  lineSubtotal,
  unitPrice,
  type CartLine,
  type PricingConfig,
} from "@/lib/pos/cart-math";
import { getPricingSettings, validatePromoCode } from "@/lib/pos/pricing";
import { insertPayment, resolveOpenShiftId } from "@/lib/pos/payment-write";
import type { OrderChannel, PaymentMethod, PaymentKind } from "@/lib/types/database";

const OUTLET_ID = "00000000-0000-0000-0000-000000000001";

export interface CheckoutPaymentInput {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface CheckoutInput {
  lines: CartLine[];
  channel: OrderChannel;
  tableLabel?: string;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  scheduledAt?: string | null;
  orderDiscount: number;
  promoId: string | null;
  promoDiscount: number;
  deliveryFee: number;
  pointsRedeemed: number;
  payments: CheckoutPaymentInput[]; // kind final (atau deposit untuk pre-order)
  paymentKind?: PaymentKind;
  queueNumber?: boolean;
  training?: boolean;
  held?: boolean; // true → status held (tahan pesanan)
  completeImmediately?: boolean; // true → order langsung "completed" + stok BOM terpotong (dipakai saat KDS dimatikan)
  /** Replay antrean offline: order terjadi saat shift masih buka, jadi tidak diblokir bila laci sudah tutup. */
  offlineReplay?: boolean;
}

export interface CheckoutResult {
  ok: boolean;
  error?: string;
  orderId?: string;
  orderNumber?: number;
  queueNumber?: number | null;
  changeDue?: number;
  /** Bahan yang menyentuh/di bawah stok minimum setelah potong BOM order ini. */
  lowStockAlerts?: { name: string; remaining: number; min: number; unit: string }[];
}

export async function checkoutOrder(input: CheckoutInput): Promise<CheckoutResult> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir — silakan login ulang." };
    if (!input.lines.length) return { ok: false, error: "Keranjang kosong." };

    const admin = createSupabaseAdminClient();

    // Laci kas wajib terbuka: tiap rupiah harus terikat ke satu shift agar
    // rekonsiliasi laci utuh. Gate UI saja tidak cukup — server juga menolak.
    const shiftId = await resolveOpenShiftId(admin, OUTLET_ID);
    if (!shiftId && !input.offlineReplay) {
      return {
        ok: false,
        error: "Laci kas belum dibuka — buka shift dulu sebelum menerima pembayaran.",
      };
    }

    const settings = await getPricingSettings();

    const subtotal = cartSubtotal(input.lines);
    if (subtotal <= 0) return { ok: false, error: "Subtotal tidak valid." };

    // Server-side re-validasi promo (jangan percaya klien)
    let promoDiscount = 0;
    let promoId: string | null = null;
    if (input.promoId && input.promoDiscount > 0) {
      const linesForPromo = input.lines.map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
        unit_price: unitPrice(l),
      }));
      // promoId disimpan di cart; validasi ulang via id → cari kode
      const { data: promoRow } = await admin
        .from("promotions")
        .select("code")
        .eq("id", input.promoId)
        .maybeSingle();
      if (promoRow?.code) {
        const v = await validatePromoCode(promoRow.code, subtotal, linesForPromo);
        if (!v.ok) return { ok: false, error: `Promo tidak valid: ${v.error}` };
        promoDiscount = v.discount;
        promoId = v.promoId ?? null;
      }
    }

    const cfg: PricingConfig = {
      taxPercent: settings.taxPercent,
      servicePercent: settings.servicePercent,
      orderDiscount: Math.min(input.orderDiscount, subtotal),
      promoDiscount,
      deliveryFee: input.deliveryFee,
      pointsRedeemed: input.pointsRedeemed,
    };
    const totals = computeTotals(input.lines, cfg);

    const totalPaid = input.payments.reduce((s, p) => s + p.amount, 0);
    // Order held (tahan/bayar nanti) sah dengan payments kosong — bukan kekurangan bayar.
    if (!input.held && input.paymentKind !== "deposit" && totalPaid < totals.total) {
      return { ok: false, error: "Pembayaran kurang dari total." };
    }

    // Nomor order & antrean via RPC (service role)
    const { data: orderNumber, error: numErr } = await admin.rpc("next_order_number", {
      p_outlet: OUTLET_ID,
    });
    if (numErr) throw new Error(numErr.message);
    let queueNumber: number | null = null;
    if (input.queueNumber !== false) {
      const { data: qn, error: qErr } = await admin.rpc("next_queue_number", { p_outlet: OUTLET_ID });
      if (qErr) throw new Error(qErr.message);
      queueNumber = qn as number;
    }

    const status = input.held ? "held" : input.paymentKind === "deposit" ? "confirmed" : "confirmed";

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        outlet_id: OUTLET_ID,
        order_number: orderNumber as number,
        channel: input.channel,
        status,
        training: input.training ?? false,
        customer_name: input.customerName || null,
        customer_phone: input.customerPhone || null,
        table_label: input.tableLabel || null,
        queue_number: queueNumber,
        scheduled_at: input.scheduledAt ?? null,
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
        order_discount: totals.orderDiscount,
        promo_id: promoId,
        promo_discount: totals.promoDiscount,
        delivery_fee: totals.deliveryFee,
        tax: totals.tax,
        service_charge: totals.serviceCharge,
        total: totals.total,
        total_paid: totalPaid,
        change_due: Math.max(0, totalPaid - totals.total),
        points_earned: 0,
        points_redeemed: input.pointsRedeemed,
        created_by: staff.uid,
      })
      .select("id")
      .single();

    if (orderErr) throw new Error(orderErr.message);
    const orderId = order.id as string;

    // Simpan items + opsi (snapshot)
    for (const l of input.lines) {
      const { data: item, error: itemErr } = await admin
        .from("order_items")
        .insert({
          order_id: orderId,
          product_id: l.product_id,
          name: l.name,
          qty: l.qty,
          unit_price: unitPrice(l),
          subtotal: lineSubtotal(l),
          discount: l.discount,
          note: l.note || null,
        })
        .select("id")
        .single();
      if (itemErr) throw new Error(itemErr.message);

      if (l.options.length > 0) {
        const { error: optErr } = await admin.from("order_item_options").insert(
          l.options.map((o) => ({
            order_item_id: item.id as string,
            option_id: o.option_id,
            option_group_id: o.option_group_id,
            name: o.name,
            group_name: o.group_name,
            price_delta: o.price_delta,
          })),
        );
        if (optErr) throw new Error(optErr.message);
      }
    }

    // Pembayaran — terikat shift penerima uang
    for (const p of input.payments) {
      await insertPayment(admin, {
        order_id: orderId,
        method: p.method,
        kind: input.paymentKind ?? "final",
        amount: p.amount,
        reference: p.reference || null,
        shift_id: shiftId,
      });
    }

    let lowStockAlerts: CheckoutResult["lowStockAlerts"];

    // KDS dimatikan → langsung selesaikan setelah items terpasang
    // (potong stok BOM transaksional via RPC; wajib SETELAH insert order_items)
    if (input.completeImmediately) {
      const { error: doneErr } = await admin.rpc("complete_order_and_deduct_stock", {
        p_order_id: orderId,
      });
      if (doneErr) throw new Error(doneErr.message);

      // Peringatan stok: bahan yang baru menyentuh/di bawah minimum akibat order ini.
      // Berbasis reference_id (presisi per order) — bukan created_at (rentan race antar-kasir).
      const { data: movedRows, error: mvErr } = await admin
        .from("stock_movements")
        .select("ingredient_id, stock_after")
        .eq("movement_type", "sale")
        .eq("reference_id", orderId);
      if (!mvErr && movedRows && movedRows.length > 0) {
        const { data: hits } = await admin
          .from("ingredients")
          .select("id, name, unit, min_stock_qty, stock_qty")
          .in(
            "id",
            movedRows.map((r) => r.ingredient_id as string),
          );
        const byId = new Map(movedRows.map((r) => [r.ingredient_id as string, Number(r.stock_after)]));
        lowStockAlerts = (hits ?? [])
          .map((h) => ({
            name: h.name as string,
            unit: h.unit as string,
            remaining: byId.get(h.id as string) ?? Number(h.stock_qty),
            min: Number(h.min_stock_qty),
          }))
          .filter((h) => h.remaining <= h.min)
          .sort((a, b) => a.remaining / Math.max(a.min, 1) - b.remaining / Math.max(b.min, 1));
      }
    }

    return {
      ok: true,
      orderId,
      orderNumber: orderNumber as number,
      queueNumber,
      changeDue: Math.max(0, totalPaid - totals.total),
      lowStockAlerts,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Checkout gagal" };
  }
}
