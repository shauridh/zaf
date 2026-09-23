import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getPortal } from "@/lib/auth/portal-session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const portal = await getPortal();
  return (
    <div className="min-h-dvh bg-stone-50 dark:bg-stone-950">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/menu" className="flex items-center gap-2 font-bold">
            <span className="text-2xl">🍗</span> ChickenPOS
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/cart" aria-label="Keranjang" className="touch-target rounded-lg p-2 hover:bg-stone-100 dark:hover:bg-stone-800">
              <ShoppingCart className="size-5" />
            </Link>
            {portal ? (
              <Link href="/orders" className="text-sm font-semibold text-brand-600">
                {portal.name || "Akun"}
              </Link>
            ) : (
              <Link href="/portal-login" className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-bold text-white">
                Masuk
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pb-24 pt-4">{children}</main>
    </div>
  );
}
