"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/auth/session";

export interface OptionItemView {
  id: string;
  name: string;
  price_delta: number;
  active: boolean;
}

export interface OptionGroupView {
  id: string;
  name: string;
  input_type: "single" | "multi";
  is_required: boolean;
  max_select: number | null;
  active: boolean;
  options: OptionItemView[];
}

type Result = { ok: boolean; error?: string };

/** Semua grup opsi beserta item-nya (termasuk nonaktif) — untuk editor Katalog. */
export async function listOptionGroups(): Promise<OptionGroupView[]> {
  const admin = createSupabaseAdminClient();
  const [groupsRes, optsRes] = await Promise.all([
    admin.from("option_groups").select("*").order("sort_order"),
    admin.from("options").select("*").order("sort_order"),
  ]);
  const byGroup = new Map<string, OptionItemView[]>();
  for (const o of (optsRes.data ?? []) as unknown as (OptionItemView & { group_id: string })[]) {
    const list = byGroup.get(o.group_id) ?? [];
    list.push({ id: o.id, name: o.name, price_delta: Number(o.price_delta), active: o.active });
    byGroup.set(o.group_id, list);
  }
  return ((groupsRes.data ?? []) as unknown as OptionGroupView[]).map((g) => ({
    id: g.id,
    name: g.name,
    input_type: g.input_type,
    is_required: g.is_required,
    max_select: g.max_select,
    active: g.active,
    options: byGroup.get(g.id) ?? [],
  }));
}

/** ID grup opsi yang terpasang di suatu produk. */
export async function getProductOptionGroupIds(productId: string): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("product_option_groups")
    .select("group_id, sort_order")
    .eq("product_id", productId)
    .order("sort_order");
  return ((data ?? []) as { group_id: string }[]).map((r) => r.group_id);
}

export async function createOptionGroup(input: {
  name: string;
  input_type: "single" | "multi";
  is_required: boolean;
  max_select?: number | null;
}): Promise<Result & { id?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    if (!input.name.trim()) return { ok: false, error: "Nama grup wajib diisi" };
    const admin = createSupabaseAdminClient();
    const { data: maxRow } = await admin
      .from("option_groups")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await admin
      .from("option_groups")
      .insert({
        name: input.name.trim(),
        input_type: input.input_type,
        is_required: input.is_required,
        max_select: input.input_type === "multi" ? (input.max_select ?? 5) : 1,
        sort_order: Number(maxRow?.sort_order ?? 0) + 1,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: data.id as string };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal membuat grup opsi" };
  }
}

export async function updateOptionGroup(
  id: string,
  patch: { name?: string; is_required?: boolean; active?: boolean },
): Promise<Result> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("option_groups").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal mengubah grup opsi" };
  }
}

export async function deleteOptionGroup(id: string): Promise<Result> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    // Cascade menghapus options + tautan product_option_groups.
    const { error } = await admin.from("option_groups").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menghapus grup opsi" };
  }
}

export async function createOption(
  groupId: string,
  name: string,
  priceDelta: number,
): Promise<Result & { id?: string }> {
  try {
    await assertRole(["owner", "manager"]);
    if (!name.trim()) return { ok: false, error: "Nama opsi wajib diisi" };
    const admin = createSupabaseAdminClient();
    const { data: maxRow } = await admin
      .from("options")
      .select("sort_order")
      .eq("group_id", groupId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await admin
      .from("options")
      .insert({
        group_id: groupId,
        name: name.trim(),
        price_delta: priceDelta,
        sort_order: Number(maxRow?.sort_order ?? 0) + 1,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: data.id as string };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menambah opsi" };
  }
}

export async function updateOption(
  id: string,
  patch: { name?: string; price_delta?: number; active?: boolean },
): Promise<Result> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("options").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal mengubah opsi" };
  }
}

export async function deleteOption(id: string): Promise<Result> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("options").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menghapus opsi" };
  }
}

/** Pasang/lepas grup opsi ke produk (daftar lengkap menggantikan yang lama). */
export async function setProductOptionGroups(productId: string, groupIds: string[]): Promise<Result> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const { error: delErr } = await admin.from("product_option_groups").delete().eq("product_id", productId);
    if (delErr) throw new Error(delErr.message);
    if (groupIds.length > 0) {
      const { error } = await admin.from("product_option_groups").insert(
        groupIds.map((group_id, i) => ({ product_id: productId, group_id, sort_order: i + 1 })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyimpan opsi produk" };
  }
}
