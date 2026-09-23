import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

/**
 * Supabase server client. Sesi staf/portal dibaca dari cookie "cp_token"
 * (JWT HS256 minted server-side) sehingga RLS mengenali request sebagai
 * authenticated. Fallback ke anon key bila belum login.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("cp_token")?.value ?? "";
  const token = raw ? decodeURIComponent(raw) : "";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient<Database>(url, token || anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Sesi dikelola manual via cookie cp_token (server action login/logout).
      },
    },
  });
}

/** Sesi staf aktif dari cookie (uid, role) — null bila belum login. */
export async function getStaffSession(): Promise<{
  uid: string;
  role: "owner" | "manager" | "cashier";
  name: string;
} | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("cp_token")?.value ?? "";
  if (!raw) return null;

  const { verifyToken } = await import("@/lib/auth/jwt");
  const payload = verifyToken(decodeURIComponent(raw));
  if (!payload || payload.role !== "authenticated") return null;

  return {
    uid: payload.sub,
    role: (payload["staff_role"] as "owner" | "manager" | "cashier") ?? "cashier",
    name: (payload["name"] as string) ?? "",
  };
}
