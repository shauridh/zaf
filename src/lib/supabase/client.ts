"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client untuk Client Components.
 * Mengambil sesi staf/portal dari cookie "cp_token" (JWT minted server-side)
 * agar RLS mengenali request sebagai authenticated — termasuk untuk Realtime.
 */
export function createSupabaseBrowserClient() {
  const token =
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("cp_token="))
      ?.split("=")[1] ?? "";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = token
    ? decodeURIComponent(token)
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserClient<Database>(url, key);
}
