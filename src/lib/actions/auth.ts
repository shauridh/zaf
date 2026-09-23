"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { setStaffSession, clearStaffSession } from "@/lib/auth/session";
import type { StaffRole } from "@/lib/types/database";

export interface StaffProfileLite {
  id: string;
  name: string;
  role: StaffRole;
}

/** Daftar staf aktif untuk pemilih di halaman login. */
export async function listStaffProfiles(): Promise<StaffProfileLite[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, role")
    .eq("active", true)
    .order("role");
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffProfileLite[];
}

// Rate limit sederhana in-memory: 5 percobaan / 15 menit per profil.
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

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function staffLogin(profileId: string, pin: string): Promise<LoginResult> {
  if (!checkRate(`login:${profileId}`)) {
    return { ok: false, error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." };
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return { ok: false, error: "PIN harus 4–8 digit." };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("staff_authenticate", {
    p_id: profileId,
    p_pin: pin,
  });

  if (error) return { ok: false, error: "Login gagal — coba lagi." };
  const row = (data as { id: string; name: string; role: StaffRole }[] | null)?.[0];
  if (!row) {
    return { ok: false, error: "PIN salah. Coba lagi." };
  }

  attempts.delete(`login:${profileId}`);
  await setStaffSession(row);
  return { ok: true };
}

export async function staffLogout(): Promise<void> {
  await clearStaffSession();
}
