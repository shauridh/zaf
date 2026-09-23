"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaff, assertRole } from "@/lib/auth/session";

// ---------- Bahan baku ----------

export interface IngredientView {
  id: string;
  name: string;
  unit: string;
  purchase_unit: string | null;
  conversion_factor: number;
  stock_qty: number;
  min_stock_qty: number;
  cost_per_unit: number;
  supplier_id: string | null;
  barcode: string | null;
  active: boolean;
}

export async function listIngredients(): Promise<IngredientView[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("ingredients")
    .select("id, name, unit, purchase_unit, conversion_factor, stock_qty, min_stock_qty, cost_per_unit, supplier_id, barcode, active")
    .order("active", { ascending: false })
    .order("name");
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    unit: r.unit as string,
    purchase_unit: (r.purchase_unit as string | null) ?? null,
    conversion_factor: Number(r.conversion_factor ?? 1),
    stock_qty: Number(r.stock_qty),
    min_stock_qty: Number(r.min_stock_qty),
    cost_per_unit: Number(r.cost_per_unit),
    supplier_id: (r.supplier_id as string) ?? null,
    barcode: (r.barcode as string) ?? null,
    active: r.active !== false,
  }));
}

export async function upsertIngredient(input: {
  id?: string;
  name: string;
  unit: string;
  min_stock_qty: number;
  supplier_id?: string | null;
  barcode?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const row = {
      name: input.name,
      unit: input.unit,
      min_stock_qty: input.min_stock_qty,
      supplier_id: input.supplier_id || null,
      barcode: input.barcode || null,
    };
    const { error } = input.id
      ? await admin.from("ingredients").update(row).eq("id", input.id)
      : await admin.from("ingredients").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal simpan bahan" };
  }
}

/**
 * Edit bahan baku (identitas & konversi — bukan stok/HPP, itu lewat opname/pembelian).
 */
export async function updateIngredient(input: {
  id: string;
  name: string;
  unit: string;
  purchase_unit: string;
  conversion_factor: number;
  min_stock_qty: number;
  supplier_id?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Nama bahan wajib diisi" };
    if (!input.unit.trim()) return { ok: false, error: "Satuan resep wajib dipilih" };
    if (!input.purchase_unit.trim()) return { ok: false, error: "Satuan beli wajib dipilih" };
    if (!Number.isFinite(input.conversion_factor) || input.conversion_factor <= 0) {
      return { ok: false, error: "Isi konversi harus lebih dari 0" };
    }
    const { error: dupErr, data: dup } = await admin
      .from("ingredients")
      .select("id")
      .ilike("name", name)
      .neq("id", input.id)
      .limit(1);
    if (dupErr) throw new Error(dupErr.message);
    if (dup && dup.length > 0) return { ok: false, error: `Bahan "${name}" sudah ada` };

    const { error } = await admin
      .from("ingredients")
      .update({
        name,
        unit: input.unit.trim(),
        purchase_unit: input.purchase_unit.trim(),
        conversion_factor: input.conversion_factor,
        min_stock_qty: input.min_stock_qty,
        supplier_id: input.supplier_id || null,
      })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal edit bahan" };
  }
}

/**
 * Hapus bahan baku permanen.
 * Bila masih dipakai (resep/pembelian/mutasi stok), tolak dengan pesan ramah —
 * sarankan nonaktifkan saja agar riwayat tetap utuh.
 */
export async function deleteIngredient(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("ingredients").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return {
          ok: false,
          error: "Bahan masih dipakai (resep/pembelian/mutasi stok) — nonaktifkan saja agar riwayat tetap utuh",
        };
      }
      throw new Error(error.message);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal hapus bahan" };
  }
}

/**
 * Disable/enable bahan baku (soft-disable — data & riwayat tetap utuh).
 * Bahan nonaktif disembunyikan dari daftar aktif; resep tak ikut dihapus.
 */
export async function setIngredientActive(
  id: string,
  active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("ingredients").update({ active }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal ubah status bahan" };
  }
}

/** Tambah bahan baku baru — tersedia dari `@/lib/actions/ingredient-create`. */

// ---------- Supplier ----------

export interface PurchaseHistoryItem {
  id: string;
  created_at: string;
  total: number;
  invoice_ref: string | null;
  note: string | null;
  supplier_name: string | null;
  items: { name: string; qty: number; unit: string; subtotal: number }[];
}

/** Riwayat pembelian terakhir (untuk panel Persediaan). */
export async function listRecentPurchases(limit = 8): Promise<PurchaseHistoryItem[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("purchases")
    .select(
      "id, created_at, total, invoice_ref, note, suppliers(name), purchase_items(qty, subtotal, ingredients(name, unit))",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as {
    id: string;
    created_at: string;
    total: number;
    invoice_ref: string | null;
    note: string | null;
    suppliers: { name: string } | null;
    purchase_items: { qty: number; subtotal: number; ingredients: { name: string; unit: string } | null }[];
  }[]).map((p) => ({
    id: p.id,
    created_at: p.created_at,
    total: Number(p.total),
    invoice_ref: p.invoice_ref,
    note: p.note,
    supplier_name: p.suppliers?.name ?? null,
    items: (p.purchase_items ?? []).map((i) => ({
      name: i.ingredients?.name ?? "—",
      qty: Number(i.qty),
      unit: i.ingredients?.unit ?? "",
      subtotal: Number(i.subtotal),
    })),
  }));
}

export async function listSuppliers(): Promise<{ id: string; name: string; lead_time_days: number }[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("suppliers")
    .select("id, name, lead_time_days")
    .eq("active", true)
    .order("name");
  return (data ?? []) as { id: string; name: string; lead_time_days: number }[];
}

export async function upsertSupplier(input: {
  id?: string;
  name: string;
  contact_name?: string;
  phone?: string;
  lead_time_days: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const { error } = input.id
      ? await admin.from("suppliers").update(input).eq("id", input.id)
      : await admin.from("suppliers").insert(input);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal simpan supplier" };
  }
}

// ---------- Penyesuaian stok (opname / waste) ----------

export async function adjustStock(
  ingredientId: string,
  newQty: number,
  mode: "adjustment" | "waste",
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    const admin = createSupabaseAdminClient();

    const { data: ing } = await admin
      .from("ingredients")
      .select("stock_qty")
      .eq("id", ingredientId)
      .maybeSingle();
    if (!ing) return { ok: false, error: "Bahan tidak ditemukan" };

    const current = Number(ing.stock_qty);
    const qtyChange = mode === "adjustment" ? newQty - current : -newQty; // waste: kurangi sebanyak newQty
    const after = current + qtyChange;

    const { error: updErr } = await admin
      .from("ingredients")
      .update({ stock_qty: after })
      .eq("id", ingredientId);
    if (updErr) throw new Error(updErr.message);

    const { error: mvErr } = await admin.from("stock_movements").insert({
      ingredient_id: ingredientId,
      movement_type: mode,
      qty_change: qtyChange,
      stock_after: after,
      note: note || null,
      created_by: staff.uid,
    });
    if (mvErr) throw new Error(mvErr.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal penyesuaian stok" };
  }
}

// ---------- Pembelian (stok masuk + moving average) ----------

export interface PurchaseItemInput {
  ingredient_id: string;
  /** Qty dalam satuan JUAL (sudah dikonversi UI dari satuan beli). */
  qty: number;
  /** Rupiah per satuan jual — bisa pecahan hasil konversi; dibulatkan untuk kolom integer. */
  unit_cost: number;
  /** Total uang baris dari input operator (qty beli × harga beli) — sumber kebenaran uang. */
  line_total: number;
}

export async function recordPurchase(
  supplierId: string | null,
  items: PurchaseItemInput[],
  note: string,
  invoiceRef = "",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await assertRole(["owner", "manager"]);
    if (items.length === 0) return { ok: false, error: "Minimal satu item" };
    if (items.some((i) => !(i.qty > 0) || !(i.line_total > 0)))
      return { ok: false, error: "Qty dan harga wajib diisi" };
    const admin = createSupabaseAdminClient();

    const total = items.reduce((s, i) => s + Math.round(i.line_total), 0);
    // invoice_ref butuh migrasi 0012; bila kolom belum ada, simpan tanpa itu (jangan matikan kasir).
    let purchaseId: string;
    {
      const base = { supplier_id: supplierId, total, note: note || null, created_by: staff.uid };
      const payload = { ...base, ...(invoiceRef.trim() ? { invoice_ref: invoiceRef.trim() } : {}) } as typeof base & {
        invoice_ref?: string;
      };
      const ins = await admin
        .from("purchases")
        .insert(payload)
        .select("id")
        .single();
      if (ins.error) {
        const msg = ins.error.message ?? "";
        if (/invoice_ref/i.test(msg)) {
          const retry = await admin.from("purchases").insert(base).select("id").single();
          if (retry.error) throw new Error(retry.error.message);
          purchaseId = retry.data!.id;
        } else throw new Error(msg);
      } else purchaseId = ins.data!.id;
    }
    const purchase = { id: purchaseId };

    // PostgREST tidak punya transaksi — bila gagal di tengah, balikkan semua tulisan
    // supaya tidak ada header/stok yang tertinggal tanpa detail item (bug nyata: unit_cost
    // pecahan ditolak kolom integer SETELAH header & stok terupdate).
    const rollback = async () => {
      await admin.from("purchase_items").delete().eq("purchase_id", purchase!.id);
      await admin.from("stock_movements").delete().eq("reference_id", purchase!.id);
      await admin.from("purchases").delete().eq("id", purchase!.id);
    };
    const undo: { id: string; stock_qty: number; cost_per_unit: number }[] = [];

    try {
      for (const item of items) {
        const { data: ing, error: ingErr } = await admin
          .from("ingredients")
          .select("stock_qty, cost_per_unit")
          .eq("id", item.ingredient_id)
          .maybeSingle();
        if (ingErr) throw new Error(ingErr.message);
        if (!ing) throw new Error("Bahan tidak ditemukan");

        const oldQty = Number(ing.stock_qty);
        const oldCost = Number(ing.cost_per_unit);
        const newQty = oldQty + item.qty;
        // Moving average memakai line_total (uang sebenarnya), bukan unit_cost bulat.
        const newCost = newQty > 0 ? (oldQty * oldCost + item.line_total) / newQty : item.line_total / item.qty;

        const { error: updErr } = await admin
          .from("ingredients")
          .update({ stock_qty: newQty, cost_per_unit: newCost })
          .eq("id", item.ingredient_id);
        if (updErr) throw new Error(updErr.message);
        undo.push({ id: item.ingredient_id, stock_qty: oldQty, cost_per_unit: oldCost });

        const { error: piErr } = await admin.from("purchase_items").insert({
          purchase_id: purchase!.id,
          ingredient_id: item.ingredient_id,
          qty: item.qty,
          unit_cost: Math.round(item.unit_cost),
          subtotal: Math.round(item.line_total),
        });
        if (piErr) throw new Error(piErr.message);

        const { error: mvErr } = await admin.from("stock_movements").insert({
          ingredient_id: item.ingredient_id,
          movement_type: "purchase",
          qty_change: item.qty,
          stock_after: newQty,
          reference_id: purchase!.id,
          created_by: staff.uid,
        });
        if (mvErr) throw new Error(mvErr.message);
      }
    } catch (inner) {
      await rollback();
      for (const u of undo.reverse()) {
        await admin
          .from("ingredients")
          .update({ stock_qty: u.stock_qty, cost_per_unit: u.cost_per_unit })
          .eq("id", u.id);
      }
      throw inner;
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal catat pembelian" };
  }
}

// ---------- Resep BOM & HPP ----------

export interface RecipeLineView {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  qty_per_unit: number;
  cost_line: number;
  option_delta: { option_id: string; qty_delta: number }[];
  /** Satuan beli bila berbeda dari satuan resep (mis. pack → pcs). */
  purchase_unit: string | null;
  conversion_factor: number | null;
}

export async function listRecipes(productId: string): Promise<RecipeLineView[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("recipes")
    .select(
      "ingredient_id, qty_per_unit, option_delta, ingredients(name, unit, cost_per_unit, purchase_unit, conversion_factor)",
    )
    .eq("product_id", productId);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const ing = r.ingredients as {
      name: string;
      unit: string;
      cost_per_unit: number;
      purchase_unit: string | null;
      conversion_factor: number | null;
    };
    const qty = Number(r.qty_per_unit);
    return {
      ingredient_id: r.ingredient_id as string,
      ingredient_name: ing.name,
      unit: ing.unit,
      qty_per_unit: qty,
      cost_line: qty * Number(ing.cost_per_unit),
      option_delta: (r.option_delta as { option_id: string; qty_delta: number }[]) ?? [],
      purchase_unit: ing.purchase_unit && ing.purchase_unit !== ing.unit ? ing.purchase_unit : null,
      conversion_factor: ing.conversion_factor != null ? Number(ing.conversion_factor) : null,
    };
  });
}

export async function setRecipeLine(
  productId: string,
  ingredientId: string,
  qtyPerUnit: number,
  optionDelta: { option_id: string; qty_delta: number }[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    if (qtyPerUnit <= 0) {
      const { error } = await admin
        .from("recipes")
        .delete()
        .eq("product_id", productId)
        .eq("ingredient_id", ingredientId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await admin.from("recipes").upsert(
      { product_id: productId, ingredient_id: ingredientId, qty_per_unit: qtyPerUnit, option_delta: optionDelta },
      { onConflict: "product_id,ingredient_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal simpan resep" };
  }
}

/** HPP per produk = Σ qty × cost moving-average. */
export async function computeProductCost(productId: string): Promise<number> {
  const lines = await listRecipes(productId);
  return lines.reduce((s, l) => s + l.cost_line, 0);
}

// ---------- Saran reorder ----------

export interface ReorderSuggestion {
  ingredient_id: string;
  name: string;
  unit: string;
  stock_qty: number;
  min_stock_qty: number;
  avg_daily_usage: number;
  lead_time_days: number;
  suggested_qty: number;
  reason: string;
}

/** Saran reorder = velocity (14 hari) × (lead time + safety 2 hari) − sisa stok. */
export async function reorderSuggestions(): Promise<ReorderSuggestion[]> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

  const [ingsRes, movRes, supRes] = await Promise.all([
    admin.from("ingredients").select("id, name, unit, stock_qty, min_stock_qty, supplier_id").eq("active", true),
    admin
      .from("stock_movements")
      .select("ingredient_id, qty_change, movement_type")
      .lt("qty_change", 0)
      .gte("created_at", since),
    admin.from("suppliers").select("id, lead_time_days"),
  ]);

  const leadBySupplier = new Map(
    ((supRes.data ?? []) as { id: string; lead_time_days: number }[]).map((s) => [s.id, s.lead_time_days]),
  );

  const usage = new Map<string, number>();
  for (const m of (movRes.data ?? []) as { ingredient_id: string; qty_change: number }[]) {
    usage.set(m.ingredient_id, (usage.get(m.ingredient_id) ?? 0) + Math.abs(Number(m.qty_change)));
  }

  const result: ReorderSuggestion[] = [];
  for (const ing of (ingsRes.data ?? []) as unknown as Record<string, unknown>[]) {
    const stock = Number(ing.stock_qty);
    const minStock = Number(ing.min_stock_qty);
    const used14 = usage.get(ing.id as string) ?? 0;
    const daily = used14 / 14;
    const lead = leadBySupplier.get(ing.supplier_id as string) ?? 2;
    const need = daily * (lead + 2) - stock;
    const lowStock = minStock > 0 && stock <= minStock;

    // Abaikan bahan tanpa sinyal: minimum stok 0 + tidak ada pemakaian tercatat.
    if (minStock <= 0 && daily === 0) continue;
    // Tanpa kebutuhan nyata → bukan saran reorder.
    if (need <= 0 && !lowStock) continue;

    const suggested = Math.max(Math.ceil(need), minStock > 0 ? minStock - stock : 0);
    if (suggested <= 0) continue;

    result.push({
      ingredient_id: ing.id as string,
      name: ing.name as string,
      unit: ing.unit as string,
      stock_qty: stock,
      min_stock_qty: minStock,
      avg_daily_usage: Math.round(daily * 100) / 100,
      lead_time_days: lead,
      suggested_qty: suggested,
      reason: lowStock
        ? "Stok di bawah minimum"
        : `Pemakaian ±${Math.round(daily * 100) / 100} ${ing.unit}/hari × lead time ${lead} hari`,
    });
  }
  return result.sort((a, b) => a.stock_qty - b.stock_qty);
}
