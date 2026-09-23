"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/session";
import type { OrderStatus } from "@/lib/types/database";

const OUTLET_ID = "00000000-0000-0000-0000-000000000001";

export interface HeldOrderLite {
  id: string;
  order_number: number;
  channel: string;
  table_label: string | null;
  customer_name: string | null;
  total: number;
  created_at: string;
  items: { name: string; qty: number }[];
}

/** Daftar order held (ditahan) + unpaid untuk halaman Kasir. */
export async function listHeldOrders(): Promise<HeldOrderLite[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id, order_number, channel, table_label, customer_name, total, created_at, items")
    .in("status", ["held", "unpaid"])
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return ((data ?? []) as HeldOrderLite[]).map((o) => ({
    ...o,
    items: Array.isArray(o.items) ? o.items : [],
  }));
}

/** Muat ulang order held ke keranjang kasir. */
export async function loadHeldOrder(
  orderId: string,
): Promise<{ ok: boolean; error?: string; order?: HeldOrderLite }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id, order_number, channel, table_label, customer_name, total, created_at, items")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Order tidak ditemukan" };
  return { ok: true, order: { ...data, items: Array.isArray(data.items) ? data.items : [] } };
}

/** Ubah status order (confirmed → preparing → ready → completed, dll). */
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    const admin = createSupabaseAdminClient();

    if (status === "completed") {
      // auto-deduct stok transaksional via RPC
      const { error: rpcErr } = await admin.rpc("complete_order_and_deduct_stock", {
        p_order_id: orderId,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      return { ok: true };
    }

    const { error } = await admin
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal ubah status" };
  }
}

/** Batalkan order held/confirmed tanpa pembayaran final. */
export async function cancelOrder(
  orderId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    const admin = createSupabaseAdminClient();

    const { data: order } = await admin
      .from("orders")
      .select("status, total_paid")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return { ok: false, error: "Order tidak ditemukan" };
    if (!["held", "unpaid", "confirmed"].includes(order.status)) {
      return { ok: false, error: "Order sudah diproses — gunakan Refund." };
    }

    const { error } = await admin
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) throw new Error(error.message);

    await admin.from("audit_logs").insert({
      actor_id: staff.uid,
      action: "order.cancel",
      entity: "orders",
      entity_id: orderId,
      detail: { reason },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal membatalkan" };
  }
}

/** Aktifkan mode latihan: order training=true tidak masuk laporan. */
export async function getTrainingFlag(): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("feature_flags")
    .select("enabled")
    .eq("outlet_id", OUTLET_ID)
    .eq("key", "training_mode")
    .maybeSingle();
  return data?.enabled ?? false;
}
