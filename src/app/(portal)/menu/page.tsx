import { loadPortalBootstrap } from "@/lib/actions/portal";
import { PortalMenuClient } from "@/components/portal/portal-menu-client";

export const dynamic = "force-dynamic";

export default async function PortalMenuPage() {
  const { catalog } = await loadPortalBootstrap();
  return (
    <PortalMenuClient
      categories={catalog.categories.map((c) => ({ id: c.id, name: c.name }))}
      products={catalog.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        price: p.price,
        image_url: p.image_url ?? null,
        category_id: p.category_id,
        hasOptions: p.option_groups.length > 0,
        optionGroups: p.option_groups,
      }))}
    />
  );
}
