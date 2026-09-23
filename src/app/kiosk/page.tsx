import { redirect } from "next/navigation";
import { getFlags } from "@/lib/flags-server";
import { loadCatalog } from "@/lib/actions/catalog";
import { KioskClient } from "@/components/pos/kiosk-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kiosk" };

export default async function KioskPage() {
  const flags = await getFlags();
  if (!flags.kiosk) redirect("/login");
  const catalog = await loadCatalog();
  return (
    <KioskClient
      categories={catalog.categories.map((c) => ({ id: c.id, name: c.name }))}
      products={catalog.products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category_id: p.category_id,
        optionGroups: p.option_groups,
        hasOptions: p.option_groups.length > 0,
      }))}
    />
  );
}
