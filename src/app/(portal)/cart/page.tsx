import { loadPortalBootstrap } from "@/lib/actions/portal";
import { PortalCartClient } from "@/components/portal/portal-cart-client";

export const dynamic = "force-dynamic";

export default async function PortalCartPage() {
  const { settings, member } = await loadPortalBootstrap();
  return (
    <PortalCartClient
      loggedIn={!!member}
      memberPoints={member?.points ?? 0}
      deliveryFeeFlat={settings.deliveryFeeFlat}
      deliveryFeePerKm={settings.deliveryFeePerKm}
    />
  );
}
