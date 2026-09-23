import { requireManager } from "@/lib/auth/session";
import { businessDateWIB } from "@/lib/utils/format";
import { listExpenses, listSettlements, type SettlementView } from "@/lib/actions/finance";
import { getOpenShift, listClosedShiftsEnriched } from "@/lib/actions/shifts";
import { getOutletSettings } from "@/lib/actions/settings";
import { pnl } from "@/lib/reports/queries";
import { FinanceClient } from "@/components/pos/finance-client";
import { ShiftsClient } from "@/components/pos/shifts-client";

export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireManager();
  const params = await searchParams;
  const today = businessDateWIB();
  const monthStart = `${today.slice(0, 7)}-01`;
  const from = params.from ?? monthStart;
  const to = params.to ?? today;

  const [expenses, settlements, profit, openShift, closed, settings] = await Promise.all([
    listExpenses(from, to),
    listSettlements(),
    pnl(from, to),
    getOpenShift(),
    listClosedShiftsEnriched(),
    getOutletSettings(),
  ]);

  const closedLite = closed;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Keuangan</h1>
        <p className="text-sm text-stone-500">
          Laci kas, pengeluaran operasional, dan rekonsiliasi settlement marketplace — {from} s/d {to}.
        </p>
      </header>

      {/* Laci kas: shift terbuka, mutasi kas, rekonsiliasi & Z report */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">💵 Laci Kas</h2>
        <ShiftsClient
          openShift={openShift}
          outletName={settings.outletName ?? "ChickenPOS"}
          receiptFooter={settings.receiptFooter}
          closed={closedLite}
        />
      </section>

      <FinanceClient
        from={from}
        to={to}
        expenses={expenses}
        settlements={settlements as SettlementView[]}
        profit={profit}
      />
    </div>
  );
}
