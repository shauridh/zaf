import { requireStaff } from "@/lib/auth/session";
import { businessDateWIB } from "@/lib/utils/format";
import {
  salesSummary,
  hourlySales,
  salesByChannel,
  salesByCategory,
  productPerformance,
  paymentMix,
  paymentsByShift,
  pnl,
  bomDetail,
} from "@/lib/reports/queries";
import { ReportsClient } from "@/components/pos/reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const today = businessDateWIB();
  const from = params.from ?? today;
  const to = params.to ?? today;

  const [summary, hourly, channels, categories, products, payments, shiftPayments, profit, bom] = await Promise.all([
    salesSummary(from, to),
    hourlySales(from, to),
    salesByChannel(from, to),
    salesByCategory(from, to),
    productPerformance(from, to),
    paymentMix(from, to),
    paymentsByShift(from, to),
    pnl(from, to),
    bomDetail(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Laporan</h1>
          <p className="text-sm text-stone-500">Business date WIB · {from} s/d {to}</p>
        </div>
      </header>
      <ReportsClient
        from={from}
        to={to}
        summary={summary}
        hourly={hourly}
        channels={channels}
        categories={categories}
        products={products}
        payments={payments}
        shiftPayments={shiftPayments}
        profit={profit}
        bom={bom}
      />
    </div>
  );
}
