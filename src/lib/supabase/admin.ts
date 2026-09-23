import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client dengan SERVICE ROLE — melewati RLS.
 * HANYA boleh dipakai di server untuk operasi tepercaya:
 * auth PIN staf/portal, hashing, RPC transaksional, backup.
 * JANGAN pernah diekspor ke client.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL belum diset di environment.",
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
