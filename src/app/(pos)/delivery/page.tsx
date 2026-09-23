import { listUnpaidPortalOrders } from "@/lib/actions/portal-verify";
import { listRiders, listDeliveryJobs } from "@/lib/actions/delivery";
import { DeliveryClient } from "@/components/pos/delivery-client";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const [unpaid, riders, jobs] = await Promise.all([
    listUnpaidPortalOrders(),
    listRiders(),
    listDeliveryJobs(),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Delivery & Verifikasi</h1>
        <p className="text-sm text-stone-500">
          Verifikasi bukti transfer portal, assign rider internal, atau booking kurir on-demand.
        </p>
      </header>
      <DeliveryClient unpaid={unpaid} riders={riders} jobs={jobs} />
    </div>
  );
}
