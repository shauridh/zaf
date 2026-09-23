"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/auth/session";
import type {
  ImportIngredientRow,
  ImportMode,
  ImportProductRow,
  ImportRecipeRow,
  ImportResult,
} from "@/lib/import-types";

const ZERO = "00000000-0000-0000-0000-000000000000";

function fail(errors: string[]): ImportResult {
  return { ok: false, inserted: 0, updated: 0, deleted: 0, errors };
}

/** Impor bahan baku. replace = ganti seluruh data; merge = upsert by nama. */
export async function importIngredients(
  rows: ImportIngredientRow[],
  mode: ImportMode,
): Promise<ImportResult> {
  await assertRole(["owner"]);
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const line = `Baris ${i + 2}`;
    if (!r.nama?.trim()) errors.push(`${line}: nama kosong`);
    if (!r.satuan?.trim()) errors.push(`${line}: satuan kosong`);
    if (!Number.isFinite(r.stok) || r.stok < 0) errors.push(`${line}: stok tidak valid`);
    if (!Number.isFinite(r.minStok) || r.minStok < 0) errors.push(`${line}: min stok tidak valid`);
    if (!r.satuanBeli?.trim()) errors.push(`${line}: satuan beli kosong`);
    if (!Number.isFinite(r.isiKonversi) || r.isiKonversi <= 0)
      errors.push(`${line}: isi konversi harus > 0`);
    if (!Number.isFinite(r.hargaBeli) || r.hargaBeli < 0) errors.push(`${line}: harga beli tidak valid`);
  });
  if (errors.length) return fail(errors);

  const admin = createSupabaseAdminClient();
  const payload = rows.map((r) => ({
    name: r.nama.trim(),
    unit: r.satuan.trim(),
    stock_qty: r.stok,
    min_stock_qty: r.minStok,
    purchase_unit: r.satuanBeli.trim(),
    conversion_factor: r.isiKonversi,
    // HPP per satuan resep = harga beli per satuan beli ÷ isi konversi.
    cost_per_unit: Math.round((r.hargaBeli / r.isiKonversi) * 100) / 100,
  }));

  try {
    if (mode === "replace") {
      const before = await admin.from("ingredients").select("id", { count: "exact", head: true });
      const del = await admin.from("ingredients").delete().neq("id", ZERO);
      if (del.error) {
        return fail([
          `Gagal mengosongkan bahan: ${del.error.message}. ` +
            "Kemungkinan masih ada riwayat mutasi stok yang menahan FK — hapus riwayatnya dulu atau gunakan mode Gabungkan.",
        ]);
      }
      const ins = await admin.from("ingredients").insert(payload);
      if (ins.error) return fail([ins.error.message]);
      return { ok: true, inserted: payload.length, updated: 0, deleted: before.count ?? 0, errors: [] };
    }

    // Gabungkan: upsert by nama (case-insensitive).
    const { data: existing, error: exErr } = await admin.from("ingredients").select("id, name");
    if (exErr) return fail([exErr.message]);
    const byName = new Map((existing ?? []).map((x) => [x.name.trim().toLowerCase(), x.id as string]));
    const toInsert = payload.filter((p) => !byName.has(p.name.toLowerCase()));
    let inserted = 0;
    let updated = 0;
    if (toInsert.length) {
      const ins = await admin.from("ingredients").insert(toInsert);
      if (ins.error) return fail([ins.error.message]);
      inserted = toInsert.length;
    }
    for (const p of payload) {
      const id = byName.get(p.name.toLowerCase());
      if (!id) continue;
      const up = await admin.from("ingredients").update(p).eq("id", id);
      if (up.error) return fail([up.error.message]);
      updated++;
    }
    return { ok: true, inserted, updated, deleted: 0, errors: [] };
  } catch (e) {
    return fail([e instanceof Error ? e.message : "Impor bahan gagal"]);
  }
}

/** Impor produk. Kategori baru dibuat otomatis. replace = ganti seluruh data; merge = upsert by nama. */
export async function importProducts(
  rows: ImportProductRow[],
  mode: ImportMode,
): Promise<ImportResult> {
  await assertRole(["owner"]);
  const errors: string[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const line = `Baris ${i + 2}`;
    if (!r.nama?.trim()) errors.push(`${line}: nama kosong`);
    if (!r.kategori?.trim()) errors.push(`${line}: kategori kosong`);
    if (!Number.isFinite(r.harga) || r.harga < 0) errors.push(`${line}: harga tidak valid`);
    const key = r.nama?.trim().toLowerCase();
    if (key && seen.has(key)) errors.push(`${line}: nama produk "${r.nama}" duplikat dalam file`);
    if (key) seen.add(key);
  });
  if (errors.length) return fail(errors);

  const admin = createSupabaseAdminClient();
  try {
    // Kategori: pakai yang sudah ada (match nama), buat sisanya.
    const { data: cats, error: cErr } = await admin.from("categories").select("id, name, sort_order");
    if (cErr) return fail([cErr.message]);
    const catByName = new Map((cats ?? []).map((c) => [c.name.trim().toLowerCase(), c.id as string]));
    const newCatNames = [...new Set(rows.map((r) => r.kategori.trim()))].filter(
      (n) => !catByName.has(n.toLowerCase()),
    );
    if (newCatNames.length) {
      const maxSort = (cats ?? []).reduce((m, c) => Math.max(m, c.sort_order ?? 0), 0);
      const ins = await admin
        .from("categories")
        .insert(newCatNames.map((name, i) => ({ name, sort_order: maxSort + 1 + i, active: true })))
        .select("id, name");
      if (ins.error) return fail([ins.error.message]);
      for (const c of ins.data ?? []) catByName.set(c.name.trim().toLowerCase(), c.id);
    }

    const payload = rows.map((r, i) => ({
      name: r.nama.trim(),
      category_id: catByName.get(r.kategori.trim().toLowerCase())!,
      price: Math.round(r.harga),
      description: r.deskripsi?.trim() || null,
      image_url: r.gambar?.trim() || null,
      is_active: r.aktif,
      track_stock: true,
      sort_order: i + 1,
    }));

    if (mode === "replace") {
      const before = await admin.from("products").select("id", { count: "exact", head: true });
      const del = await admin.from("products").delete().neq("id", ZERO);
      if (del.error) return fail([del.error.message]);
      const ins = await admin.from("products").insert(payload);
      if (ins.error) return fail([ins.error.message]);
      return { ok: true, inserted: payload.length, updated: 0, deleted: before.count ?? 0, errors: [] };
    }

    const { data: existing, error: exErr } = await admin.from("products").select("id, name");
    if (exErr) return fail([exErr.message]);
    const byName = new Map((existing ?? []).map((x) => [x.name.trim().toLowerCase(), x.id as string]));
    const toInsert = payload.filter((p) => !byName.has(p.name.toLowerCase()));
    let inserted = 0;
    let updated = 0;
    if (toInsert.length) {
      const ins = await admin.from("products").insert(toInsert);
      if (ins.error) return fail([ins.error.message]);
      inserted = toInsert.length;
    }
    for (const p of payload) {
      const id = byName.get(p.name.toLowerCase());
      if (!id) continue;
      const up = await admin.from("products").update(p).eq("id", id);
      if (up.error) return fail([up.error.message]);
      updated++;
    }
    return { ok: true, inserted, updated, deleted: 0, errors: [] };
  } catch (e) {
    return fail([e instanceof Error ? e.message : "Impor produk gagal"]);
  }
}

/**
 * Impor resep BOM — baris dengan produk yang sama diganti seluruhnya
 * (produk yang tidak disebut dalam file tidak tersentuh).
 */
export async function importRecipes(rows: ImportRecipeRow[]): Promise<ImportResult> {
  await assertRole(["owner"]);
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const line = `Baris ${i + 2}`;
    if (!r.produk?.trim()) errors.push(`${line}: nama produk kosong`);
    if (!r.bahan?.trim()) errors.push(`${line}: nama bahan kosong`);
    if (!Number.isFinite(r.qty) || r.qty <= 0) errors.push(`${line}: qty harus > 0`);
  });
  if (errors.length) return fail(errors);

  const admin = createSupabaseAdminClient();
  try {
    const [{ data: prods, error: pErr }, { data: ings, error: iErr }] = await Promise.all([
      admin.from("products").select("id, name"),
      admin.from("ingredients").select("id, name"),
    ]);
    if (pErr) return fail([pErr.message]);
    if (iErr) return fail([iErr.message]);
    const prodByName = new Map((prods ?? []).map((x) => [x.name.trim().toLowerCase(), x.id as string]));
    const ingByName = new Map((ings ?? []).map((x) => [x.name.trim().toLowerCase(), x.id as string]));

    rows.forEach((r, i) => {
      const line = `Baris ${i + 2}`;
      if (!prodByName.has(r.produk.trim().toLowerCase()))
        errors.push(`${line}: produk "${r.produk}" belum ada — impor produk dulu`);
      if (!ingByName.has(r.bahan.trim().toLowerCase()))
        errors.push(`${line}: bahan "${r.bahan}" belum ada — impor bahan dulu`);
    });
    if (errors.length) return fail(errors);

    const productIds = [...new Set(rows.map((r) => prodByName.get(r.produk.trim().toLowerCase())!))];
    const del = await admin.from("recipes").delete().in("product_id", productIds);
    if (del.error) return fail([del.error.message]);

    const ins = await admin.from("recipes").insert(
      rows.map((r) => ({
        product_id: prodByName.get(r.produk.trim().toLowerCase())!,
        ingredient_id: ingByName.get(r.bahan.trim().toLowerCase())!,
        qty_per_unit: r.qty,
        option_delta: [],
      })),
    );
    if (ins.error) return fail([ins.error.message]);
    return { ok: true, inserted: rows.length, updated: 0, deleted: 0, errors: [] };
  } catch (e) {
    return fail([e instanceof Error ? e.message : "Impor resep gagal"]);
  }
}

/** Kosongkan katalog: hapus semua resep, produk, dan bahan (dengan peringatan FK mutasi stok). */
export async function clearCatalog(): Promise<ImportResult> {
  await assertRole(["owner"]);
  const admin = createSupabaseAdminClient();
  const order: { table: "recipes" | "product_option_groups" | "products" | "ingredients"; by: string }[] = [
    { table: "recipes", by: "product_id" },
    { table: "product_option_groups", by: "product_id" },
    { table: "products", by: "id" },
    { table: "ingredients", by: "id" },
  ];
  let deleted = 0;
  try {
    for (const { table, by } of order) {
      const before = await admin.from(table).select("*", { count: "exact", head: true });
      const del = await admin.from(table).delete().neq(by, ZERO);
      if (del.error) {
        return fail([
          `Gagal mengosongkan ${table}: ${del.error.message}. ` +
            "Bahan yang punya riwayat mutasi stok tidak bisa dihapus — hapus riwayatnya dulu.",
        ]);
      }
      deleted += before.count ?? 0;
    }
    return { ok: true, inserted: 0, updated: 0, deleted, errors: [] };
  } catch (e) {
    return fail([e instanceof Error ? e.message : "Gagal mengosongkan katalog"]);
  }
}
