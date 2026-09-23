import Link from "next/link";
import { ReceiptView } from "@/components/pos/receipt-view";
import { PrintButton } from "@/components/pos/print-button";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="min-h-dvh bg-stone-100 py-8 print:bg-white dark:bg-stone-950">
      <div className="mx-auto max-w-xs space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link href="/register" className="flex items-center gap-1 text-sm font-semibold text-brand-600">
            ← Kasir
          </Link>
          <a href={`/api/receipt/${id}`} target="_blank" rel="noreferrer" className="text-sm text-stone-500 hover:underline">
            Data JSON
          </a>
        </div>
        <ReceiptView orderId={id} />
        <div className="print:hidden">
          <PrintButton />
        </div>
      </div>
    </div>
  );
}
