import { redirect } from "next/navigation";
import { getFlags } from "@/lib/flags-server";
import { loadCatalog } from "@/lib/actions/catalog";
import { channelSummaryToday } from "@/lib/actions/channels";
import { ChannelsClient } from "@/components/pos/channels-client";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const flags = await getFlags();
  if (!flags.marketplace_channels) redirect("/register");
  const [catalog, summary] = await Promise.all([loadCatalog(), channelSummaryToday()]);
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Kanal Online</h1>
        <p className="text-sm text-stone-500">
          Entri cepat order GoFood/GrabFood/ShopeeFood + tracking fee. Order langsung muncul di dapur.
        </p>
      </header>
      <ChannelsClient
        summary={summary}
        products={catalog.products.map((p) => ({ id: p.id, name: p.name, price: p.price }))}
      />
    </div>
  );
}
