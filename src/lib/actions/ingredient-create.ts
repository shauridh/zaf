"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/auth/session";

export interface CreateIngredientInput {
  name: string;
  unit: string; // satuan jual/resep (gr, ml, pcs, ...)
  min_stock_qty: number; // dalam satuan jual
  initial_stock_qty: number; // dalam satuan jual
  purchase_unit: string; // satuan beli (mis. galon, karung, pack)
  conversion_factor: number; // 1 satuan beli = berapa satuan jual (> 0)
  purchase_price: number; // harga per 1 satuan beli (rupiah)
  supplier_id?: string | null;
}

/**
 * Tambah bahan baku baru + stok awal.
 * - HPP per satuan jual = harga beli per satuan beli ÷ faktor konversi.
 * - Contoh: Minyak 1 galon Rp 380.000 = 19.000 ml → cost_per_unit ≈ Rp 20/ml.
 * - Stok awal diinput dalam SATUAN JUAL; ledger stock_movements mengikuti satuan jual.
 * - Nama bahan unik — duplikat ditolak.
 */
export async function createIngredient(
  input: CreateIngredientInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();

    const name = input.name.trim();
    const unit = input.unit.trim();
    const purchaseUnit = input.purchase_unit.trim();
    const factor = Number(input.conversion_factor);

    if (!name) return { ok: false, error: "Nama bahan wajib diisi" };
    if (!unit) return { ok: false, error: "Satuan jual wajib dipilih" };
    if (!purchaseUnit) return { ok: false, error: "Satuan beli wajib dipilih" };
    if (!Number.isFinite(factor) || factor <= 0) {
      return { ok: false, error: "Isi per beli harus lebih dari 0" };
    }

    const costPerUnit = Math.round(input.purchase_price / factor);

    const { data: dup, error: dupErr } = await admin
      .from("ingredients")
      .select("id")
      .ilike("name", name)
      .limit(1);
    if (dupErr) throw new Error(dupErr.message);
    if (dup && dup.length > 0) {
      return { ok: false, error: `Bahan "${name}" sudah ada` };
    }

    const { data: ing, error } = await admin
      .from("ingredients")
      .insert({
        name,
        unit,
        min_stock_qty: input.min_stock_qty,
        supplier_id: input.supplier_id || null,
        stock_qty: input.initial_stock_qty,
        cost_per_unit: costPerUnit,
        purchase_unit: purchaseUnit,
        conversion_factor: factor,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (input.initial_stock_qty > 0) {
      const { error: mvErr } = await admin.from("stock_movements").insert({
        ingredient_id: ing.id,
        movement_type: "adjustment",
        qty_change: input.initial_stock_qty,
        stock_after: input.initial_stock_qty,
        note: `stok awal (=${(input.initial_stock_qty / factor).toFixed(2).replace(".", ",")} ${purchaseUnit})`,
        created_by: staff.uid,
      });
      if (mvErr) throw new Error(mvErr.message);
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal tambah bahan" };
  }
}
