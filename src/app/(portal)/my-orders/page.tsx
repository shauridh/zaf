import { requirePortal } from "@/lib/auth/portal-session";
import { listPortalOrders } from "@/lib/actions/portal";
import { portalLogout } from "@/lib/actions/portal-auth";
import { PortalMyOrdersClient } from "@/components/portal/portal-orders-client";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  unpaid: "Menunggu Verifikasi",
  confirmed: "Diterima",
  preparing: "Dimasak",
  ready: "Siap",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  refunded: "Refund",
  held: "Ditahan",
};

export default async function PortalOrdersPage() {
  await requirePortal();
  const orders = await listPortalOrders();
  return (
    <PortalMyOrdersClient
      orders={orders.map((o) => ({
        ...o,
        statusLabel: STATUS_LABEL[o.status] ?? o.status,
      }))}
      logoutAction={portalLogout}
    />
  );
}
