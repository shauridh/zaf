import { redirect } from "next/navigation";
import { getFlags } from "@/lib/flags-server";
import { QueueBoard } from "@/components/pos/queue-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Papan Antrean" };

export default async function QueueBoardPage() {
  const flags = await getFlags();
  if (!flags.queue_board) redirect("/login");
  return <QueueBoard />;
}
