import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FLAG_DEFAULTS, type Flags } from "@/lib/flags";

/** Ambil feature flags outlet. Tanpa DB (setup awal) → default semua modul. */
export async function getFlags(): Promise<Flags> {
  const defaults: Flags = { ...FLAG_DEFAULTS };
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("feature_flags").select("key, enabled");
    if (data) {
      for (const row of data) {
        if (row.key in defaults) {
          defaults[row.key as keyof Flags] = row.enabled;
        }
      }
    }
    return defaults;
  } catch {
    // DB belum dikonfigurasi — pakai default agar app tetap jalan.
    return defaults;
  }
}
