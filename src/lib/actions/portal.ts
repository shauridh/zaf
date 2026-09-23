"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPortal, requirePortal } from "@/lib/auth/portal-session";
import { getOutletSettings, type OutletSettingsView } from "@/lib/actions/settings";
import { loadCatalog, type Catalog } from "@/lib/actions/catalog";
import { computeTotals, lineSubtotal, unitPrice, type CartLine, type PricingConfig } from "@/lib/pos/cart-math";
import { calcPointsEarned, calcPointsValue } from "@/lib/pos/loyalty";
import { insertPayment, resolveOpenShiftId } from "@/lib/pos/payment-write";

const OUTLET_ID = "00000000-0000-0000-0000-000000000001";

export interface PortalBootstrap {
  catalog: Catalog;
  settings: OutletSettingsView;
  member: { id: string; name: string | null; points: number } | null;
}

/** Data awal untuk halaman portal (menu, ongkir, poin member). */
export async function loadPortalBootstrap(): Promise<PortalBootstrap> {
  const [catalog, settings] = await Promise.all([loadCatalog(), getOutletSettings()]);
  const portal = await getPortal();

  let member: PortalBootstrap["member"] = null;
  if (portal?.memberId) {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("members")
      .select("id, name, points")
      .eq("id", portal.memberId)
      .maybeSingle();
    member = (data as { id: string; name: string; points: number } | null) ?? null;
  }

  return { catalog, settings, member };
}

export interface PortalCheckoutInput {
  fulfillment: "pickup" | "self_delivery";
  address: string;
  distanceKm: number;
  lines: CartLine[];
  note?: string;
  pointsRedeem: number;
}

export interface PortalCheckoutResult {
  ok: boolean;
  error?: string;
  orderId?: string;
  orderNumber?: number;
  total?: number;
  pointsEarned?: number;
}

/** Checkout portal: status "unpaid" menunggu verifikasi transfer oleh kasir. */
export async function portalCheckout(input: PortalCheckoutInput): Promise<PortalCheckoutResult> {
  try {
    const portal = await requirePortal();
    if (!input.lines.length) return { ok: false, error: "Keranjang kosong" };
    if (input.fulfillment === "self_delivery" && !input.address.trim()) {
      return { ok: false, error: "Alamat pengiriman wajib diisi" };
    }

    const admin = createSupabaseAdminClient();
    const settings = await getOutletSettings();

    // Validasi poin
    let pointsRedeemed = 0;
    let pointsValue = 0;
    if (input.pointsRedeem > 0 && portal.memberId) {
      const { data: member } = await admin
        .from("members")
        .select("points")
        .eq("id", portal.memberId)
        .maybeSingle();
      const available = member?.points ?? 0;
      pointsRedeemed = Math.min(input.pointsRedeem, available);
      pointsValue = calcPointsValue(pointsRedeemed);
    }

    const deliveryFee =
      input.fulfillment === "self_delivery"
        ? settings.deliveryFeeFlat + Math.round(input.distanceKm * settings.deliveryFeePerKm)
        : 0;

    const cfg: PricingConfig = {
      taxPercent: settings.taxPercent,
      servicePercent: 0,
      orderDiscount: 0,
      promoDiscount: 0,
      deliveryFee,
      pointsRedeemed: pointsValue,
    };
    const totals = computeTotals(input.lines, cfg);

    const { data: orderNumber, error: numErr } = await admin.rpc("next_order_number", { p_outlet: OUTLET_ID });
    if (numErr) throw new Error(numErr.message);
    const { data: queueNumber, error: qErr } = await admin.rpc("next_queue_number", { p_outlet: OUTLET_ID });
    if (qErr) throw new Error(qErr.message);

    const pointsEarned = calcPointsEarned(totals.total);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        outlet_id: OUTLET_ID,
        order_number: orderNumber as number,
        queue_number: queueNumber as number,
        channel: input.fulfillment === "pickup" ? "pickup" : "self_delivery",
        status: "unpaid",
        portal_customer_id: portal.portalCustomerId,
        customer_name: portal.name || null,
        customer_phone: null,
        address: input.fulfillment === "self_delivery" ? input.address.trim() : null,
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
        promo_discount: 0,
        delivery_fee: totals.deliveryFee,
        tax: totals.tax,
        service_charge: totals.serviceCharge,
        total: totals.total,
        total_paid: 0,
        points_earned: pointsEarned,
        points_redeemed: pointsRedeemed,
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

    if (pointsRedeemed > 0 && portal.memberId) {
      await admin.rpc("increment_member_points", { p_member: portal.memberId, p_points: -pointsRedeemed });
      await admin.from("point_transactions").insert({
        member_id: portal.memberId,
        order_id: order.id,
        points_change: -pointsRedeemed,
        note: "redeem via portal",
      });
    }

    return { ok: true, orderId: order.id, orderNumber: orderNumber as number, total: totals.total, pointsEarned };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Checkout gagal" };
  }
}

/** Simpan bukti transfer ke Storage private + catat payment kind=final belum terverifikasi. */
export async function submitTransferProof(
  orderId: string,
  bankName: string,
  file: File,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const portal = await requirePortal();
    const admin = createSupabaseAdminClient();

    const { data: order } = await admin
      .from("orders")
      .select("portal_customer_id, status, total")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.portal_customer_id !== portal.portalCustomerId) {
      return { ok: false, error: "Order tidak ditemukan" };
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${orderId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await admin.storage
      .from("payment-proofs")
      .upload(path, file, { contentType: file.type || "image/jpeg" });
    if (uploadErr) throw new Error(`Upload gagal: ${uploadErr.message}`);

    // Baris pembayaran transfer: nominal = total tagihan (kolom `amount` wajib
    // > 0, jadi 0 ditolak DB — dulu upload bukti selalu gagal karena ini),
    // belum terverifikasi sampai kasir menyetujui, dan menempel ke shift yang
    // buka saat bukti diunggah.
    await insertPayment(admin, {
      order_id: orderId,
      method: "transfer",
      kind: "final",
      amount: order.total,
      reference: bankName,
      proof_url: path,
      shift_id: await resolveOpenShiftId(admin, OUTLET_ID),
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal kirim bukti" };
  }
}

export interface PortalOrderView {
  id: string;
  order_number: number;
  status: string;
  channel: string;
  total: number;
  created_at: string;
  scheduled_at: string | null;
  address: string | null;
  rating: number | null;
  items: { name: string; qty: number }[];
}

/** Riwayat order pelanggan portal. */
export async function listPortalOrders(): Promise<PortalOrderView[]> {
  const portal = await requirePortal();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id, order_number, status, channel, total, created_at, scheduled_at, address, rating, items")
    .eq("portal_customer_id", portal.portalCustomerId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((o) => ({
    id: o.id as string,
    order_number: o.order_number as number,
    status: o.status as string,
    channel: o.channel as string,
    total: Number(o.total),
    created_at: o.created_at as string,
    scheduled_at: (o.scheduled_at as string) ?? null,
    address: (o.address as string) ?? null,
    rating: (o.rating as number) ?? null,
    items: Array.isArray(o.items) ? (o.items as { name: string; qty: number }[]) : [],
  }));
}

/** Beri rating bintang (via RPC server-side). */
export async function rateOrder(orderId: string, rating: number, note: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const portal = await requirePortal();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc("portal_rate_order", {
      p_order_id: orderId,
      p_portal_customer: portal.portalCustomerId,
      p_rating: rating,
      p_note: note || "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal memberi rating" };
  }
}
