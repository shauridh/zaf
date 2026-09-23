"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Category, OptionGroup, OptionValue, Product } from "@/lib/types/database";

export interface CatalogGroup extends OptionGroup {
  options: OptionValue[];
}

export interface CatalogProduct extends Product {
  option_groups: CatalogGroup[];
}

export interface Catalog {
  categories: Category[];
  products: CatalogProduct[];
}

/** Muat katalog lengkap untuk layar kasir. */
export async function loadCatalog(): Promise<Catalog> {
  const admin = createSupabaseAdminClient();

  const [catsRes, prodsRes, groupsRes, optsRes, linksRes] = await Promise.all([
    admin.from("categories").select("*").eq("active", true).order("sort_order"),
    admin.from("products").select("*").eq("is_active", true).order("sort_order"),
    admin.from("option_groups").select("*").eq("active", true).order("sort_order"),
    admin.from("options").select("*").eq("active", true).order("sort_order"),
    admin.from("product_option_groups").select("product_id, group_id, sort_order"),
  ]);

  const categories = (catsRes.data ?? []) as unknown as Category[];
  const productsRaw = (prodsRes.data ?? []) as unknown as Product[];
  const groups = (groupsRes.data ?? []) as unknown as OptionGroup[];
  const options = (optsRes.data ?? []) as unknown as OptionValue[];
  const links = (linksRes.data ?? []) as { product_id: string; group_id: string; sort_order: number }[];

  const optionsByGroup = new Map<string, OptionValue[]>();
  for (const o of options) {
    const list = optionsByGroup.get(o.group_id) ?? [];
    list.push(o);
    optionsByGroup.set(o.group_id, list);
  }

  const groupsById = new Map<string, CatalogGroup>();
  for (const g of groups) {
    groupsById.set(g.id, { ...g, options: optionsByGroup.get(g.id) ?? [] });
  }

  const linksByProduct = new Map<string, CatalogGroup[]>();
  for (const link of links.sort((a, b) => a.sort_order - b.sort_order)) {
    const g = groupsById.get(link.group_id);
    if (!g) continue;
    const list = linksByProduct.get(link.product_id) ?? [];
    list.push(g);
    linksByProduct.set(link.product_id, list);
  }

  const products: CatalogProduct[] = productsRaw.map((p) => ({
    ...p,
    option_groups: linksByProduct.get(p.id) ?? [],
  }));

  return { categories, products };
}
