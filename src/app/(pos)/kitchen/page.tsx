import { redirect } from "next/navigation";
import { getFlags } from "@/lib/flags-server";
import { KitchenBoard } from "@/components/pos/kitchen-board";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const flags = await getFlags();
  if (!flags.kds) redirect("/register");
  return <KitchenBoard soundEnabled={flags.sound_alerts} />;
}
