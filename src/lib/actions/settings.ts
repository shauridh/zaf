"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/auth/session";

const OUTLET_ID = "00000000-0000-0000-0000-000000000001";

export interface OutletSettingsView {
  outletName: string;
  taxPercent: number;
  servicePercent: number;
  openingFloat: number;
  receiptFooter: string;
  deliveryFeeFlat: number;
  deliveryFeePerKm: number;
  deliveryRadiusKm: number;
}

export async function getOutletSettings(): Promise<OutletSettingsView> {
  const admin = createSupabaseAdminClient();
  const [{ data }, { data: outlet }] = await Promise.all([
    admin.from("outlet_settings").select("*").eq("outlet_id", OUTLET_ID).maybeSingle(),
    admin.from("outlets").select("name").eq("id", OUTLET_ID).maybeSingle(),
  ]);
  return {
    outletName: outlet?.name ?? "ChickenPOS",
    taxPercent: Number(data?.tax_percent ?? 0),
    servicePercent: Number(data?.service_charge_percent ?? 0),
    openingFloat: Number(data?.opening_float ?? 350000),
    receiptFooter: data?.receipt_footer ?? "",
    deliveryFeeFlat: Number(data?.delivery_fee_flat ?? 0),
    deliveryFeePerKm: Number(data?.delivery_fee_per_km ?? 0),
    deliveryRadiusKm: Number(data?.delivery_radius_km ?? 8),
  };
}

export async function updateOutletSettings(
  patch: Partial<OutletSettingsView>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();

    const update: Partial<{
      tax_percent: number;
      service_charge_percent: number;
      opening_float: number;
      receipt_footer: string;
      delivery_fee_flat: number;
      delivery_fee_per_km: number;
      delivery_radius_km: number;
      updated_at: string;
    }> = { updated_at: new Date().toISOString() };
    if (patch.taxPercent !== undefined) update.tax_percent = patch.taxPercent;
    if (patch.servicePercent !== undefined) update.service_charge_percent = patch.servicePercent;
    if (patch.openingFloat !== undefined) update.opening_float = patch.openingFloat;
    if (patch.receiptFooter !== undefined) update.receipt_footer = patch.receiptFooter;
    if (patch.deliveryFeeFlat !== undefined) update.delivery_fee_flat = patch.deliveryFeeFlat;
    if (patch.deliveryFeePerKm !== undefined) update.delivery_fee_per_km = patch.deliveryFeePerKm;
    if (patch.deliveryRadiusKm !== undefined) update.delivery_radius_km = patch.deliveryRadiusKm;

    const { error } = await admin.from("outlet_settings").update(update).eq("outlet_id", OUTLET_ID);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyimpan" };
  }
}
