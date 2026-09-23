"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/auth/session";

export interface ProductWithCost {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  price: number;
  cost: number; // HPP
  margin: number; // rupiah
  margin_percent: number;
  image_url: string | null;
  is_active: boolean;
}

export async function listProductsWithCost(): Promise<ProductWithCost[]> {
  const admin = createSupabaseAdminClient();
  const [prodsRes, catsRes, recipesRes, ingsRes] = await Promise.all([
    admin.from("products").select("id, name, category_id, price, is_active, image_url").order("sort_order"),
    admin.from("categories").select("id, name"),
    admin.from("recipes").select("product_id, ingredient_id, qty_per_unit"),
    admin.from("ingredients").select("id, cost_per_unit"),
  ]);

  const catName = new Map(
    ((catsRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
  );
  const ingCost = new Map(
    ((ingsRes.data ?? []) as { id: string; cost_per_unit: number }[]).map((i) => [i.id, Number(i.cost_per_unit)]),
  );

  const costByProduct = new Map<string, number>();
  for (const r of (recipesRes.data ?? []) as { product_id: string; ingredient_id: string; qty_per_unit: number }[]) {
    const cost = (costByProduct.get(r.product_id) ?? 0) + Number(r.qty_per_unit) * (ingCost.get(r.ingredient_id) ?? 0);
    costByProduct.set(r.product_id, cost);
  }

  return ((prodsRes.data ?? []) as unknown as Record<string, unknown>[]).map((p) => {
    const price = Number(p.price);
    const cost = Math.round(costByProduct.get(p.id as string) ?? 0);
    const margin = price - cost;
    return {
      id: p.id as string,
      name: p.name as string,
      category_id: p.category_id as string,
      category_name: catName.get(p.category_id as string) ?? "—",
      price,
      cost,
      margin,
      margin_percent: price > 0 ? Math.round((margin / price) * 100) : 0,
      image_url: (p.image_url as string | null) ?? null,
      is_active: p.is_active as boolean,
    };
  });
}

export async function listCategories(): Promise<{ id: string; name: string }[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("categories").select("id, name").eq("active", true).order("sort_order");
  return (data ?? []) as { id: string; name: string }[];
}

export async function upsertProduct(input: {
  id?: string;
  name: string;
  category_id: string;
  price: number;
  description?: string;
  is_active: boolean;
  track_stock: boolean;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    let savedId = input.id;
  if (input.id) {
      const { error } = await admin
          .from("products")
          .update({
            name: input.name,
            category_id: input.category_id,
            price: input.price,
            description: input.description || null,
            is_active: input.is_active,
            track_stock: input.track_stock,
          })
          .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin.from("products").insert({
          name: input.name,
          category_id: input.category_id,
          price: input.price,
          description: input.description || null,
          is_active: input.is_active,
          track_stock: input.track_stock,
        }).select("id").single();
    if (error) throw new Error(error.message);
    savedId = data.id;
  }
    return { ok: true, id: savedId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal simpan produk" };
  }
}

const IMAGE_BUCKET = "products";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB

/** Pastikan bucket publik `products` tersedia (idempotent). */
async function ensureProductsBucket(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.name === IMAGE_BUCKET)) return;
  const { error } = await admin.storage.createBucket(IMAGE_BUCKET, { public: true });
  // Race dengan request lain aman: bucket sudah ada dianggap sukses.
  if (error && !error.message.toLowerCase().includes("exist")) {
    throw new Error(`Gagal siapkan bucket: ${error.message}`);
  }
}

/**
 * Hapus foto produk (M9): remove object Storage + set image_url NULL.
 * Toleran: kalau file sudah tidak ada, tetap bersihkan kolomnya.
 */
export async function removeProductImage(
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();

    const { data: prod, error: fetchErr } = await admin
      .from("products")
      .select("image_url")
      .eq("id", productId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const url = (prod as { image_url: string | null })?.image_url;
    if (url) {
      const marker = "/object/public/products/";
      const idx = url.indexOf(marker);
      if (idx >= 0) {
        const path = url.slice(idx + marker.length);
        const { error: rmErr } = await admin.storage.from(IMAGE_BUCKET).remove([path]);
        if (rmErr && !rmErr.message.toLowerCase().includes("not found")) {
          throw new Error(`Gagal hapus file: ${rmErr.message}`);
        }
      }
    }

    const { error: dbErr } = await admin
      .from("products")
      .update({ image_url: null })
      .eq("id", productId);
    if (dbErr) throw new Error(dbErr.message);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal hapus foto" };
  }
}

/**
 * Upload foto produk (M9): terima data URL dari client, simpan ke Supabase
 * Storage (bucket `products`, publik), lalu update `products.image_url`.
 * Timpa file lama dengan nama sama supaya URL stabil & cache browser tetap efisien.
 */
export async function uploadProductImage(
  productId: string,
  dataUrl: string,
): Promise<{ ok: boolean; image_url?: string; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();

    const match = /^data:([\w/.+-]+);base64,(.+)$/s.exec(dataUrl.trim());
    if (!match) return { ok: false, error: "Format gambar tidak dikenal" };
    const [, mime, base64] = match;
    if (!ALLOWED_IMAGE_TYPES.has(mime)) {
      return { ok: false, error: "Hanya JPG, PNG, atau WebP yang didukung" };
    }
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength === 0) return { ok: false, error: "Gambar kosong" };
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return { ok: false, error: "Ukuran gambar melebihi 3 MB" };
    }

    await ensureProductsBucket(admin);

    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
    const path = `${productId}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(IMAGE_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (upErr) throw new Error(`Gagal upload: ${upErr.message}`);

    const { data } = admin.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Gagal mengambil URL publik");

    const { error: dbErr } = await admin
      .from("products")
      .update({ image_url: data.publicUrl })
      .eq("id", productId);
    if (dbErr) throw new Error(dbErr.message);

    return { ok: true, image_url: data.publicUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal upload foto" };
  }
}

export async function setProductActive(id: string, isActive: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("products").update({ is_active: isActive }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal" };
  }
}

// ---------- CRUD Kategori ----------

export async function createCategory(name: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const clean = name.trim();
    if (!clean) return { ok: false, error: "Nama kategori wajib diisi" };
    const { error: dupErr, data: dup } = await admin
      .from("categories")
      .select("id")
      .ilike("name", clean)
      .limit(1);
    if (dupErr) throw new Error(dupErr.message);
    if (dup && dup.length > 0) return { ok: false, error: `Kategori "${clean}" sudah ada` };
    const { error } = await admin.from("categories").insert({ name: clean, sort_order: 0 });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal tambah kategori" };
  }
}

export async function updateCategory(id: string, name: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const clean = name.trim();
    if (!clean) return { ok: false, error: "Nama kategori wajib diisi" };
    const { error } = await admin.from("categories").update({ name: clean }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal edit kategori" };
  }
}

/** Hapus kategori; tolak bila masih ada produk di dalamnya (FK categories tanpa cascade). */
export async function deleteCategory(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const { count, error: cntErr } = await admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);
    if (cntErr) throw new Error(cntErr.message);
    if ((count ?? 0) > 0) {
      return { ok: false, error: `Masih ada ${count} produk di kategori ini — pindahkan dulu` };
    }
    const { error } = await admin.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal hapus kategori" };
  }
}

/** Bahan tersedia untuk editor resep. */
export async function listIngredientsForRecipe(): Promise<{ id: string; name: string; unit: string }[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("ingredients")
    .select("id, name, unit")
    .eq("active", true)
    .order("name");
  return (data ?? []) as { id: string; name: string; unit: string }[];
}
