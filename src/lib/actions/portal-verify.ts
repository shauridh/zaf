"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/session";

export interface UnpaidPortalOrder {
  id: string;
  order_number: number;
  customer_name: string | null;
  total: number;
  created_at: string;
  channel: string;
  proof_url: string | null;
  payment_id: string | null;
}

/** Order portal menunggu verifikasi transfer. */
export async function listUnpaidPortalOrders(): Promise<UnpaidPortalOrder[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id, order_number, customer_name, total, created_at, channel, payments(id, proof_url)")
    .eq("status", "unpaid")
    .order("created_at", { ascending: true })
    .limit(30);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((o) => {
    const pays = (o.payments ?? []) as { id: string; proof_url: string | null }[];
    return {
      id: o.id as string,
      order_number: o.order_number as number,
      customer_name: (o.customer_name as string) ?? null,
      total: Number(o.total),
      created_at: o.created_at as string,
      channel: o.channel as string,
      proof_url: pays[0]?.proof_url ?? null,
      payment_id: pays[0]?.id ?? null,
    };
  });
}

/** Signed URL bukti transfer (Storage private). */
export async function getProofUrl(path: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.storage.from("payment-proofs").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

/** Setujui transfer → order confirmed; tolak → dibatalkan + catat audit. */
export async function verifyTransfer(
  orderId: string,
  approve: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    const admin = createSupabaseAdminClient();

    const { data: order } = await admin
      .from("orders")
      .select("status, total")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return { ok: false, error: "Order tidak ditemukan" };
    if (order.status !== "unpaid") return { ok: false, error: "Order sudah diproses" };

    if (approve) {
      const { error: payErr } = await admin
        .from("payments")
        .update({ amount: order.total, verified_by: staff.uid, verified_at: new Date().toISOString() })
        .eq("order_id", orderId)
        .eq("kind", "final");
      if (payErr) throw new Error(payErr.message);

      const { error: updErr } = await admin
        .from("orders")
        .update({ status: "confirmed", total_paid: order.total, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (updErr) throw new Error(updErr.message);
    } else {
      const { error: updErr } = await admin
        .from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (updErr) throw new Error(updErr.message);
    }

    await admin.from("audit_logs").insert({
      actor_id: staff.uid,
      action: approve ? "portal.proof.approve" : "portal.proof.reject",
      entity: "orders",
      entity_id: orderId,
      detail: { approve },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Verifikasi gagal" };
  }
}
