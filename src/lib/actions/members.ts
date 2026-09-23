"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/session";
import { calcPointsEarned, calcPointsValue } from "@/lib/pos/loyalty";

/** Cari member berdasar nomor HP (untuk kasir & portal). */
export async function findMemberByPhone(phone: string): Promise<{
  ok: boolean;
  member?: { id: string; name: string | null; phone: string; points: number };
  error?: string;
}> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("members")
    .select("id, name, phone, points")
    .eq("phone", phone.trim())
    .maybeSingle();
  if (!data) return { ok: false, error: "Member tidak ditemukan — akan dibuat otomatis saat order." };
  return { ok: true, member: data };
}

/** Daftar member terbaru untuk halaman Member. */
export async function listMembers(): Promise<
  { id: string; name: string | null; phone: string; points: number; created_at: string }[]
> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("members")
    .select("id, name, phone, points, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as { id: string; name: string | null; phone: string; points: number; created_at: string }[];
}

/** Catat poin earned untuk order completed (dipanggil saat complete). */
export async function awardPointsForOrder(
  orderId: string,
  total: number,
  phone: string | null,
): Promise<void> {
  if (!phone) return;
  const admin = createSupabaseAdminClient();
  const earned = calcPointsEarned(total);
  if (earned <= 0) return;

  const { data: member } = await admin
    .from("members")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  let memberId = member?.id as string | undefined;
  if (!memberId) {
    const { data: created } = await admin
      .from("members")
      .insert({ phone, points: 0 })
      .select("id")
      .single();
    memberId = created?.id as string | undefined;
  }
  if (!memberId) return;

  // increment atomik via RPC
  await admin.rpc("increment_member_points", { p_member: memberId, p_points: earned });
  await admin.from("point_transactions").insert({
    member_id: memberId,
    order_id: orderId,
    points_change: earned,
    note: "earn",
  });
}

/** Redeem poin di kasir: kurangi poin member & catat transaksi. */
export async function redeemPoints(
  memberId: string,
  points: number,
): Promise<{ ok: boolean; value?: number; error?: string }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    if (points <= 0) return { ok: false, error: "Jumlah poin tidak valid" };

    const admin = createSupabaseAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("points")
      .eq("id", memberId)
      .maybeSingle();
    if (!member) return { ok: false, error: "Member tidak ditemukan" };
    if (member.points < points) return { ok: false, error: "Poin tidak cukup" };

    await admin.rpc("increment_member_points", { p_member: memberId, p_points: -points });
    await admin.from("point_transactions").insert({
      member_id: memberId,
      points_change: -points,
      note: "redeem",
    });

    return { ok: true, value: calcPointsValue(points) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Redeem gagal" };
  }
}
