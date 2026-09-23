import { listDeliveryJobs } from "@/lib/actions/delivery";
import { RiderClient } from "@/components/pos/rider-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Rider" };

export default async function RiderPage() {
  const jobs = await listDeliveryJobs();
  return <RiderClient jobs={jobs} />;
}
