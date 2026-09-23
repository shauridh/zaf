"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/auth/session";
import type { FlagKey } from "@/lib/flags";

const OUTLET_ID = "00000000-0000-0000-0000-000000000001";

export async function toggleFlag(
  key: FlagKey,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();

    // audit trail
    await admin.from("audit_logs").insert({
      actor_id: staff.uid,
      action: enabled ? "flag.enable" : "flag.disable",
      entity: "feature_flags",
      entity_id: null,
      detail: { key },
    });

    const { error } = await admin
      .from("feature_flags")
      .upsert({ outlet_id: OUTLET_ID, key, enabled }, { onConflict: "outlet_id,key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyimpan flag" };
  }
}

export type { FlagKey };
