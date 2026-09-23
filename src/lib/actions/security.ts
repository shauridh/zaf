"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRole, getStaff } from "@/lib/auth/session";
import { generateTotpSecret, parseTotpSecret, verifyTotp } from "@/lib/auth/totp";

function extractDbError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  return /AUTH_LOCKED/.test(msg)
    ? "Terlalu banyak percobaan — coba lagi dalam 15 menit"
    : /AUTH_FAILED/.test(msg)
      ? "PIN/kode salah"
      : fallback;
}

/**
 * Langkah 1 enroll: server membuat secret sementara (belum disimpan).
 * Owner memindai otpauth URI ke aplikasi authenticator, lalu memanggil
 * enableTwofa(secret, kode) untuk konfirmasi & penyimpanan.
 */
export async function startTwofaEnroll(): Promise<{ ok: boolean; secret?: string; otpauth?: string; error?: string }> {
  try {
    const staff = await assertRole(["owner"]);
    const secret = generateTotpSecret();
    const otpauth = `otpauth://totp/ChickenPOS:${encodeURIComponent(staff.name)}?secret=${secret}&issuer=ChickenPOS&algorithm=SHA1&digits=6&period=30`;
    return { ok: true, secret, otpauth };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal mulai enroll 2FA" };
  }
}

/** Langkah 2 enroll: verifikasi kode dari authenticator, lalu simpan secret. */
export async function enableTwofa(secret: string, code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await assertRole(["owner"]);
    const admin = createSupabaseAdminClient();

    if (!/^[A-Z2-7]+$/i.test(secret) || secret.length < 16) {
      return { ok: false, error: "Secret tidak valid" };
    }
    if (!verifyTotp(secret.toUpperCase(), code)) {
      return { ok: false, error: "Kode tidak cocok — coba lagi dengan kode terbaru" };
    }

    const { error } = await admin
      .from("profiles")
      .update({ twofa_enabled: true, twofa_secret: `totp:${secret}` })
      .eq("id", staff.uid);
    if (error) throw new Error(error.message);

    await admin.from("security_events").insert({
      actor_id: staff.uid,
      kind: "twofa_enabled",
      detail: {},
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractDbError(err, "Gagal mengaktifkan 2FA") };
  }
}

export async function disableTwofa(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await assertRole(["owner"]);
    const admin = createSupabaseAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("twofa_secret")
      .eq("id", staff.uid)
      .maybeSingle();
    const secret = parseTotpSecret(profile?.twofa_secret as string | null);
    if (!secret || !verifyTotp(secret, code)) {
      return { ok: false, error: "Kode salah" };
    }

    const { error } = await admin
      .from("profiles")
      .update({ twofa_enabled: false, twofa_secret: null })
      .eq("id", staff.uid);
    if (error) throw new Error(error.message);

    await admin.from("security_events").insert({
      actor_id: staff.uid,
      kind: "twofa_disabled",
      detail: {},
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractDbError(err, "Gagal menonaktifkan 2FA") };
  }
}

/**
 * Step-up: verifikasi kode TOTP untuk aksi sensitif owner.
 * Bila 2FA belum aktif, langkah ini dilewati (ok).
 */
export async function verifyStepUp(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await assertRole(["owner"]);
    const admin = createSupabaseAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("twofa_enabled, twofa_secret")
      .eq("id", staff.uid)
      .maybeSingle();

    if (!profile?.twofa_enabled) return { ok: true }; // 2FA tidak aktif → langkah dilewati

    const secret = parseTotpSecret(profile.twofa_secret as string);
    if (!secret) return { ok: false, error: "2FA rusak — hubungi admin database" };

    const ok = verifyTotp(secret, code);
    await admin.from("security_events").insert({
      actor_id: staff.uid,
      kind: ok ? "stepup_ok" : "stepup_failed",
      detail: {},
    });
    return ok ? { ok: true } : { ok: false, error: "Kode 2FA salah" };
  } catch (err) {
    return { ok: false, error: extractDbError(err, "Verifikasi step-up gagal") };
  }
}

/** Status 2FA untuk UI settings. */
export async function getTwofaStatus(): Promise<{ enabled: boolean }> {
  const staff = await getStaff();
  if (!staff || staff.role !== "owner") return { enabled: false };
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("twofa_enabled")
    .eq("id", staff.uid)
    .maybeSingle();
  return { enabled: Boolean(data?.twofa_enabled) };
}
