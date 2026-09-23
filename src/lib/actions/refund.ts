"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/session";

interface RefundInput {
  orderId: string;
  amount: number;
  reason: string;
  restock: boolean;
  managerId: string;
  managerPin: string;
}

export async function refundOrder(input: RefundInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    if (input.amount <= 0) return { ok: false, error: "Nominal refund tidak valid" };
    if (!input.reason.trim()) return { ok: false, error: "Alasan wajib diisi" };

    const admin = createSupabaseAdminClient();

    // Verifikasi approval manager via PIN
    const { data: mgr, error: authErr } = await admin.rpc("staff_authenticate", {
      p_id: input.managerId,
      p_pin: input.managerPin,
    });
    if (authErr) return { ok: false, error: "Verifikasi manager gagal" };
    const manager = (mgr as { id: string; role: string }[] | null)?.[0];
    if (!manager || !["owner", "manager"].includes(manager.role)) {
      return { ok: false, error: "Approval manager/owner diperlukan" };
    }

    const { data: order } = await admin
      .from("orders")
      .select("status, total, total_paid")
      .eq("id", input.orderId)
      .maybeSingle();
    if (!order) return { ok: false, error: "Order tidak ditemukan" };
    if (["refunded", "cancelled"].includes(order.status)) {
      return { ok: false, error: "Order sudah refund/dibatalkan" };
    }
    if (input.amount > order.total_paid) {
      return { ok: false, error: "Refund melebihi jumlah dibayar" };
    }

    const { error: refundErr } = await admin.from("refunds").insert({
      order_id: input.orderId,
      amount: input.amount,
      reason: input.reason.trim(),
      restock: input.restock,
      approved_by: manager.id,
      created_by: staff.uid,
    });
    if (refundErr) throw new Error(refundErr.message);

    if (input.restock) {
      const { error: restockErr } = await admin.rpc("restock_order", {
        p_order_id: input.orderId,
        p_actor: staff.uid,
      });
      if (restockErr) throw new Error(restockErr.message);
    }

    const { error: updErr } = await admin
      .from("orders")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("id", input.orderId);
    if (updErr) throw new Error(updErr.message);

    await admin.from("audit_logs").insert({
      actor_id: staff.uid,
      action: "order.refund",
      entity: "orders",
      entity_id: input.orderId,
      detail: { amount: input.amount, reason: input.reason, restock: input.restock, approved_by: manager.id },
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Refund gagal" };
  }
}

/** Daftar staf manager/owner untuk dropdown approval. */
export async function listManagers(): Promise<{ id: string; name: string; role: string }[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, role")
    .eq("active", true)
    .in("role", ["owner", "manager"]);
  return (data ?? []) as { id: string; name: string; role: string }[];
}
