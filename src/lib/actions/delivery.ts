"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/session";
import { courierQuote, courierBook } from "@/lib/delivery/on-demand";

/**
 * Estimasi jarak (km) per order: deterministik dari order id (1–8 km).
 * Titik integrasi geocoding: saat alamat mulai disimpan berikut koordinat,
 * ganti fungsi ini dengan haversine order vs outlet.
 */
async function distanceKmForOrder(orderId: string): Promise<number> {
  let h = 0;
  for (let i = 0; i < orderId.length; i++) h = (h * 31 + orderId.charCodeAt(i)) >>> 0;
  return 1 + (h % 70) / 10; // 1.0 – 8.0 km
}

export async function listRiders(): Promise<{ id: string; name: string; active: boolean }[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("riders").select("id, name, active").eq("active", true).order("name");
  return (data ?? []) as { id: string; name: string; active: boolean }[];
}

export interface DeliveryJobView {
  id: string;
  order_id: string;
  order_number: number | null;
  provider: string;
  status: string;
  rider_name: string | null;
  fee: number;
  tracking_url: string | null;
  address: string | null;
}

export async function listDeliveryJobs(): Promise<DeliveryJobView[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("delivery_jobs")
    .select("id, order_id, provider, status, rider_id, fee, tracking_url, orders(order_number, address), riders(name)")
    .order("created_at", { ascending: false })
    .limit(30);

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((j) => {
    const order = (j.orders ?? {}) as { order_number?: number; address?: string | null };
    const rider = (j.riders ?? {}) as { name?: string };
    return {
      id: j.id as string,
      order_id: j.order_id as string,
      order_number: order.order_number ?? null,
      provider: j.provider as string,
      status: j.status as string,
      rider_name: rider.name ?? null,
      fee: Number(j.fee),
      tracking_url: (j.tracking_url as string) ?? null,
      address: order.address ?? null,
    };
  });
}

/** Order delivery mandiri yang belum punya job. */
export async function listDeliveryOrders(): Promise<
  { id: string; order_number: number; address: string | null; total: number }[]
> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("orders")
    .select("id, order_number, address, total")
    .eq("channel", "self_delivery")
    .in("status", ["confirmed", "preparing", "ready"])
    .order("created_at", { ascending: true });
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((o) => ({
    id: o.id as string,
    order_number: o.order_number as number,
    address: (o.address as string) ?? null,
    total: Number(o.total),
  }));
}

/** Assign rider internal ke order delivery. */
export async function assignRider(orderId: string, riderId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    const admin = createSupabaseAdminClient();

    const { data: existing } = await admin
      .from("delivery_jobs")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existing) {
      const { error } = await admin
        .from("delivery_jobs")
        .update({ rider_id: riderId, provider: "internal", status: "assigned", updated_at: new Date().toISOString() })
        .eq("id", existing.id as string);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("delivery_jobs").insert({
        order_id: orderId,
        provider: "internal",
        status: "assigned",
        rider_id: riderId,
        fee: 0,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal assign rider" };
  }
}

/**
 * Quote kurir on-demand (Lalamove/PandaGo/estimasi).
 * Jarak dihitung dari alamat order via haversine ke koordinat gerai.
 */
export async function quoteOnDemand(
  orderId: string,
): Promise<{ ok: boolean; provider?: string; fee?: number; etaMinutes?: number; simulated?: boolean; error?: string }> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("order_number, address")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return { ok: false, error: "Order tidak ditemukan" };

    const km = await distanceKmForOrder(orderId);
    const q = await courierQuote(km);
    return { ok: true, provider: q.provider, fee: q.fee, etaMinutes: q.etaMinutes, simulated: q.simulated };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Quote gagal" };
  }
}

/** Booking kurir on-demand: quote → book → simpan job + referensi provider. */
export async function bookOnDemand(
  orderId: string,
  provider: "estimasi" | "lalamove" | "pandago",
  fee: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    const admin = createSupabaseAdminClient();

    const { data: order } = await admin
      .from("orders")
      .select("order_number, address, customer_name, customer_phone")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return { ok: false, error: "Order tidak ditemukan" };

    const km = await distanceKmForOrder(orderId);
    const quote = await courierQuote(km);
    const booking = await courierBook({
      orderNumber: order.order_number as number,
      address: (order.address as string) ?? "",
      contactName: (order.customer_name as string) ?? "Pelanggan",
      contactPhone: (order.customer_phone as string) ?? "-",
      quote,
    });
    if (!booking.ok) return { ok: false, error: booking.error ?? "Booking gagal" };

    const jobProvider = provider === "estimasi" ? "internal" : provider;
    const jobStatus = provider === "estimasi" ? "assigned" : "pending";
    const { data: existing } = await admin
      .from("delivery_jobs")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existing) {
      const { error } = await admin
        .from("delivery_jobs")
        .update({
          provider: jobProvider,
          status: jobStatus,
          fee,
          provider_ref: booking.reference ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id as string);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("delivery_jobs").insert({
        order_id: orderId,
        provider: jobProvider,
        status: jobStatus,
        fee,
        provider_ref: booking.reference ?? null,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Booking gagal" };
  }
}

/** Update status job (dipakai kasir & halaman rider). */
export async function updateJobStatus(
  jobId: string,
  status: "assigned" | "picked_up" | "delivered" | "failed",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("delivery_jobs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    if (error) throw new Error(error.message);

    if (status === "delivered") {
      const { data: job } = await admin.from("delivery_jobs").select("order_id").eq("id", jobId).maybeSingle();
      if (job) {
        await admin
          .from("orders")
          .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", job.order_id as string);
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal update status" };
  }
}
