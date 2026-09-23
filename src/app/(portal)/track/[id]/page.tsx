import { TrackClient } from "@/components/portal/track-client";

export const dynamic = "force-dynamic";

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrackClient orderId={id} />;
}
