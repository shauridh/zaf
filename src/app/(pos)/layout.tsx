import { requireStaff } from "@/lib/auth/session";
import { getFlags } from "@/lib/flags-server";
import { type FlagKey } from "@/lib/flags";
import { FlagsProvider } from "@/components/flags-provider";
import { PosSidebar } from "@/components/pos/pos-sidebar";
import { ToastHost } from "@/components/ui/toast";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const flags = await getFlags();

  return (
    <FlagsProvider flags={flags}>
      <div className="flex h-dvh overflow-hidden">
        <PosSidebar
          role={staff.role}
          name={staff.name}
          items={NAV_ITEMS.filter((item) => item.flag === null || flags[item.flag])}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <ToastHost />
    </FlagsProvider>
  );
}

interface NavItem {
  href: string;
  label: string;
  group: string;
  flag: FlagKey | null;
  managerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/register", label: "Kasir", group: "Operasional", flag: null },
  { href: "/orders", label: "Pesanan", group: "Operasional", flag: null },
  { href: "/kitchen", label: "Dapur (KDS)", group: "Operasional", flag: "kds" },
  { href: "/queue-board", label: "Papan Antrean", group: "Operasional", flag: "queue_board" },
  { href: "/channels", label: "Kanal Online", group: "Operasional", flag: "marketplace_channels" },
  { href: "/delivery", label: "Delivery", group: "Operasional", flag: "self_delivery" },
  { href: "/inventory", label: "Persediaan", group: "Operasional", flag: "inventory" },
  { href: "/catalog", label: "Katalog", group: "Penjualan", flag: null },
  { href: "/promotions", label: "Promo", group: "Penjualan", flag: "promotions" },
  { href: "/members", label: "Member", group: "Penjualan", flag: "loyalty" },
  { href: "/reports", label: "Laporan", group: "Manajemen", flag: null },
  { href: "/finance", label: "Keuangan", group: "Manajemen", flag: "finance" },
  { href: "/settings", label: "Pengaturan", group: "Manajemen", flag: null, managerOnly: true },
];
