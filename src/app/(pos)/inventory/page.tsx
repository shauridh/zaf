import { listIngredients, listSuppliers, reorderSuggestions, listRecentPurchases } from "@/lib/actions/inventory";
import { InventoryClient } from "@/components/pos/inventory-client";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [ingredients, suppliers, suggestions, recentPurchases] = await Promise.all([
    listIngredients(),
    listSuppliers(),
    reorderSuggestions(),
    listRecentPurchases(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Persediaan</h1>
        <p className="text-sm text-stone-500">
          Bahan baku, stok opname, waste, dan saran reorder otomatis (velocity × lead time).
        </p>
      </header>
      <InventoryClient ingredients={ingredients} suppliers={suppliers} suggestions={suggestions} recentPurchases={recentPurchases} />
    </div>
  );
}
