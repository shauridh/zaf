import { listPreorders } from "@/lib/actions/preorder";
import { OrdersClient } from "@/components/pos/orders-client";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const preorders = await listPreorders();
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Pesanan & Pre-Order</h1>
        <p className="text-sm text-stone-500">
          Pre-order dengan uang muka (DP), jadwal ambil, dan pelunasan saat pengambilan.
        </p>
      </header>
      <OrdersClient preorders={preorders} />
    </div>
  );
}
