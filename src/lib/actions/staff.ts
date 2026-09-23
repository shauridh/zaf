"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/auth/session";

export interface StaffMember {
  id: string;
  name: string;
  role: "owner" | "manager" | "cashier";
  active: boolean;
  has_pin: boolean;
}

/** Daftar staf outlet (tanpa hash PIN). */
export async function listStaff(): Promise<StaffMember[]> {
  await assertRole(["owner"]);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, role, active, pin_hash")
    .order("role")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    active: p.active,
    has_pin: Boolean(p.pin_hash),
  }));
}

/**
 * Tambah staf baru (PIN 4–6 digit, di-hash server via staff_register).
 * Owner tidak boleh membuat owner lain.
 */
export async function createStaff(
  name: string,
  role: "manager" | "cashier",
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await assertRole(["owner"]);
    if (!name.trim()) return { ok: false, error: "Nama wajib diisi" };
    if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "PIN harus 4–6 digit angka" };
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("staff_register", {
      p_name: name.trim(),
      p_role: role,
      p_pin: pin,
    });
    if (error) throw new Error(error.message);
    await admin.from("audit_logs").insert({
      actor_id: staff.uid,
      action: "staff.create",
      entity: "profiles",
      entity_id: data as string,
      detail: { name: name.trim(), role },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menambah staf" };
  }
}

/** Ganti PIN staf (owner wajib tahu PIN lama kecuali untuk dirinya via flow 2FA — di sini owner isi PIN lama staf). */
export async function changeStaffPin(
  staffId: string,
  oldPin: string,
  newPin: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner"]);
    if (!/^\d{4,6}$/.test(newPin)) return { ok: false, error: "PIN baru harus 4–6 digit angka" };
    const admin = createSupabaseAdminClient();
    const { data: ok, error } = await admin.rpc("staff_change_pin", {
      p_id: staffId,
      p_old: oldPin,
      p_new: newPin,
    });
    if (error) throw new Error(error.message);
    if (!ok) return { ok: false, error: "PIN lama salah" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal ganti PIN" };
  }
}

/** Nonaktifkan staf (soft-disable; login ditolak, riwayat tetap utuh). */
export async function setStaffActive(staffId: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await assertRole(["owner"]);
    const admin = createSupabaseAdminClient();
    if (staffId === staff.uid && !active) {
      return { ok: false, error: "Tidak bisa menonaktifkan akun sendiri" };
    }
    const { error } = await admin.from("profiles").update({ active }).eq("id", staffId);
    if (error) throw new Error(error.message);
    await admin.from("audit_logs").insert({
      actor_id: staff.uid,
      action: active ? "staff.activate" : "staff.deactivate",
      entity: "profiles",
      entity_id: staffId,
      detail: { active },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal mengubah status staf" };
  }
}
