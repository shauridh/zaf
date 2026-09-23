import { getPricingSettings } from "@/lib/pos/pricing";
import { RegisterScreen } from "@/components/pos/register-screen";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const settings = await getPricingSettings();
  return <RegisterScreen taxPercent={settings.taxPercent} servicePercent={settings.servicePercent} />;
}
