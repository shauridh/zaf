"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { setPortalSession, clearPortalSession } from "@/lib/auth/portal-session";

// Rate limit login portal: 5 percobaan / 15 menit per nomor HP
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkRate(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

export interface PortalAuthResult {
  ok: boolean;
  error?: string;
}

export async function portalLogin(phone: string, pin: string): Promise<PortalAuthResult> {
  const cleanPhone = phone.replace(/\D/g, "");
  if (!checkRate(`portal:${cleanPhone}`)) {
    return { ok: false, error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." };
  }
  if (cleanPhone.length < 9) return { ok: false, error: "Nomor HP tidak valid" };
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: "PIN harus 4–8 digit" };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("portal_authenticate", { p_phone: cleanPhone, p_pin: pin });
  if (error) return { ok: false, error: "Login gagal — coba lagi" };

  const row = (data as { id: string; name: string | null; member_id: string | null }[] | null)?.[0];
  if (!row) return { ok: false, error: "Nomor HP atau PIN salah" };

  attempts.delete(`portal:${cleanPhone}`);
  await setPortalSession({ portalCustomerId: row.id, memberId: row.member_id, name: row.name ?? "" });
  return { ok: true };
}

export async function portalRegister(phone: string, name: string, pin: string): Promise<PortalAuthResult> {
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length < 9) return { ok: false, error: "Nomor HP tidak valid" };
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: "PIN harus 4–8 digit" };
  if (!name.trim()) return { ok: false, error: "Nama wajib diisi" };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("portal_register", {
    p_phone: cleanPhone,
    p_name: name.trim(),
    p_pin: pin,
  });
  if (error) return { ok: false, error: "Registrasi gagal — nomor mungkin terdaftar" };

  // Ambil ulang untuk member_id
  const { data: auth } = await admin.rpc("portal_authenticate", { p_phone: cleanPhone, p_pin: pin });
  const row = (auth as { id: string; name: string | null; member_id: string | null }[] | null)?.[0];
  await setPortalSession({
    portalCustomerId: (data as string) ?? row?.id ?? "",
    memberId: row?.member_id ?? null,
    name: row?.name ?? name.trim(),
  });
  return { ok: true };
}

export async function portalLogout(): Promise<void> {
  await clearPortalSession();
}
