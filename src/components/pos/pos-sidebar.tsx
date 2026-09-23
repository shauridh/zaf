"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UtensilsCrossed, ClipboardList, ChefHat, MonitorPlay, Globe, Bike,
  Boxes, BookOpen, Tag, Users, BarChart3, Wallet, Settings, LogOut,
} from "lucide-react";
import { staffLogout } from "@/lib/actions/auth";
import { PrintQueueButton } from "@/components/pos/print-queue-button";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/register": UtensilsCrossed,
  "/orders": ClipboardList,
  "/kitchen": ChefHat,
  "/queue-board": MonitorPlay,
  "/channels": Globe,
  "/delivery": Bike,
  "/inventory": Boxes,
  "/catalog": BookOpen,
  "/promotions": Tag,
  "/members": Users,
  "/reports": BarChart3,
  "/finance": Wallet,
  "/settings": Settings,
};

interface NavItemLite {
  href: string;
  label: string;
  group: string;
  managerOnly?: boolean;
}

const GROUP_ORDER = ["Operasional", "Penjualan", "Manajemen"];

export function PosSidebar({
  role,
  name,
  items,
}: {
  role: "owner" | "manager" | "cashier";
  name: string;
  items: NavItemLite[];
}) {
  const pathname = usePathname();
  const visible = items.filter((i) => !i.managerOnly || role === "owner" || role === "manager");

  // Kelompokkan per kategori, urut sesuai GROUP_ORDER (grup tak dikenal di akhir).
  const groups = GROUP_ORDER.map((g) => ({
    label: g,
    items: visible.filter((i) => i.group === g),
  })).filter((g) => g.items.length > 0);
  for (const i of visible) {
    if (!GROUP_ORDER.includes(i.group)) {
      let g = groups.find((x) => x.label === i.group);
      if (!g) {
        g = { label: i.group, items: [] };
        groups.push(g);
      }
      g.items.push(i);
    }
  }

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-20 shrink-0 flex-col items-center border-r border-stone-200 bg-white py-4 dark:border-stone-800 dark:bg-stone-900 lg:flex">
        <Link href="/register" className="mb-4 flex flex-col items-center gap-1">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-500 text-2xl">🍗</span>
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto no-scrollbar">
          {groups.map((group, gi) => (
            <div key={group.label} className={cn("flex w-full flex-col items-center gap-1", gi > 0 && "mt-2 border-t border-stone-200 pt-2 dark:border-stone-800")}>
              {group.items.map((item) => {
                const Icon = ICONS[item.href] ?? ClipboardList;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      "flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium transition",
                      active
                        ? "bg-brand-500/15 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200"
                        : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
                    )}
                  >
                    <Icon className="size-5" />
                    <span className="max-w-full truncate px-1">{item.label.split(" ")[0]}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-2 pt-2">
          <PrintQueueButton />
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">{name}</span>
          <form action={staffLogout}>
            <button
              type="submit"
              title="Keluar"
              className="flex size-11 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <LogOut className="size-5" />
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex w-full items-center justify-between border-b border-stone-200 bg-white px-4 py-2 dark:border-stone-800 dark:bg-stone-900 lg:hidden">
        <Link href="/register" className="flex items-center gap-2">
          <span className="text-xl">🍗</span>
          <span className="font-bold">ChickenPOS</span>
        </Link>
        <div className="flex items-center gap-2">
          <PrintQueueButton />
          <span className="text-xs text-stone-500">{name} · {role}</span>
          <form action={staffLogout}>
            <button type="submit" className="touch-target p-2 text-stone-400">
              <LogOut className="size-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95 lg:hidden">
        {visible.slice(0, 5).map((item) => {
          const Icon = ICONS[item.href] ?? ClipboardList;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 px-3 py-2 text-xs">
              <Icon className={cn("size-5", active ? "text-brand-600" : "text-stone-400")} />
              <span className={active ? "font-semibold text-brand-700 dark:text-brand-300" : "text-stone-600 dark:text-stone-300"}>
                {item.label.split(" ")[0]}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="h-16 lg:hidden" />
    </>
  );
}
