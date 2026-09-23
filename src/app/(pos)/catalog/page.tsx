import { listProductsWithCost, listCategories } from "@/lib/actions/products";
import { CatalogClient } from "@/components/pos/catalog-client";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const [products, categories] = await Promise.all([listProductsWithCost(), listCategories()]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Katalog & BOM/HPP</h1>
        <p className="text-sm text-stone-500">
          Kelola produk, atur resep bahan (BOM), dan pantau HPP serta margin per produk.
        </p>
      </header>
      <CatalogClient products={products} categories={categories} />
    </div>
  );
}
