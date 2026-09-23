"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Landmark } from "lucide-react";
import { addExpense, addSettlement, type SettlementView } from "@/lib/actions/finance";
import { Numpad } from "@/components/ui/numpad";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { formatRupiah, formatDateID } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface Props {
  from: string;
  to: string;
  expenses: { id: string; category: string; amount: number; note: string | null; spent_at: string }[];
  settlements: SettlementView[];
  profit: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
  };
}

const EXPENSE_CATEGORIES = ["Bahan", "Gaji", "Sewa", "Listrik & Gas", "Kemasan", "Marketing", "Lainnya"];

export function FinanceClient({ from, to, expenses, settlements, profit }: Props) {
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Pendapatan" value={profit.revenue} />
        <Card label="HPP" value={profit.cogs} />
        <Card label="Laba kotor" value={profit.grossProfit} />
        <Card label="Laba bersih" value={profit.netProfit} highlight={profit.netProfit >= 0} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setExpenseOpen(true)}
          className="touch-target flex items-center gap-2 rounded-btn bg-brand-600 px-4 py-2 text-sm font-bold text-white"
        >
          <Plus className="size-4" /> Catat Pengeluaran
        </button>
        <button
          onClick={() => setSettleOpen(true)}
          className="touch-target flex items-center gap-2 rounded-btn border border-stone-300 px-4 py-2 text-sm font-bold dark:border-stone-700"
        >
          <Landmark className="size-4" /> Input Settlement
        </button>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">Pengeluaran ({from} s/d {to})</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-stone-400">Belum ada pengeluaran.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm dark:divide-stone-800">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-semibold">{e.category}</p>
                  {e.note && <p className="text-xs text-stone-500">{e.note}</p>}
                  <p className="text-xs text-stone-400">{formatDateID(e.spent_at)}</p>
                </div>
                <span className="font-bold tabular-nums">−{formatRupiah(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-bold">Rekonsiliasi Settlement Marketplace</h2>
        <p className="mb-3 text-xs text-stone-500">
          Cocokkan net transfer bank dengan gross − komisi − co-funding − biaya lain.
        </p>
        {settlements.length === 0 ? (
          <p className="text-sm text-stone-400">Belum ada data settlement.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase text-stone-500 dark:text-stone-400 dark:border-stone-800">
                  <th className="pb-2">Kanal</th>
                  <th className="pb-2">Periode</th>
                  <th className="pb-2">Gross</th>
                  <th className="pb-2">Fee+CoFund</th>
                  <th className="pb-2">Net Transfer</th>
                  <th className="pb-2">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-b border-stone-100 dark:border-stone-800">
                    <td className="py-2 font-semibold capitalize">{s.channel}</td>
                    <td className="py-2 text-xs">{s.period_start} → {s.period_end}</td>
                    <td className="py-2 tabular-nums">{formatRupiah(s.gross_sales)}</td>
                    <td className="py-2 tabular-nums">{formatRupiah(s.commission + s.promo_co_funding + s.other_fees)}</td>
                    <td className="py-2 tabular-nums">{formatRupiah(s.net_transfer)}</td>
                    <td className={cn("py-2 font-bold tabular-nums", s.diff === 0 ? "text-green-600" : "text-red-500")}>
                      {formatRupiah(s.diff)} {s.matched ? "✓" : "⚠"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} defaultDate={to} />
      <SettlementModal open={settleOpen} onClose={() => setSettleOpen(false)} />
    </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("card p-4", highlight !== undefined && (highlight ? "border-green-400" : "border-red-300"))}>
      <p className="text-xs uppercase tracking-wide text-stone-600 dark:text-stone-400">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", highlight !== undefined && (highlight ? "text-green-600" : "text-red-500"))}>
        {formatRupiah(value)}
      </p>
    </div>
  );
}

function ExpenseModal({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate: string }) {
  const router = useRouter();
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const res = await addExpense(category, parseInt(amount, 10) || 0, note, date);
      if (res.ok) {
        toast.success("Pengeluaran tercatat");
        onClose();
        router.refresh();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Catat Pengeluaran">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                category === c ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10" : "border-stone-200 dark:border-stone-700",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Keterangan (opsional)" className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800" />
        <div className="rounded-xl bg-stone-100 px-4 py-3 text-right text-xl font-bold tabular-nums dark:bg-stone-800">
          {amount ? formatRupiah(parseInt(amount, 10)) : "Rp0"}
        </div>
        <Numpad value={amount} onChange={setAmount} quickAmounts={[10000, 50000, 100000]} submitLabel="Simpan" onSubmit={submit} disabled={pending} />
      </div>
    </Modal>
  );
}

function SettlementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [channel, setChannel] = useState<"gofood" | "grabfood" | "shopeefood">("gofood");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [gross, setGross] = useState("");
  const [commission, setCommission] = useState("");
  const [coFunding, setCoFunding] = useState("");
  const [other, setOther] = useState("");
  const [net, setNet] = useState("");
  const [pending, startTransition] = useTransition();

  const expected =
    (parseInt(gross, 10) || 0) - (parseInt(commission, 10) || 0) - (parseInt(coFunding, 10) || 0) - (parseInt(other, 10) || 0);
  const diff = (parseInt(net, 10) || 0) - expected;

  const submit = () => {
    startTransition(async () => {
      const res = await addSettlement({
        channel,
        period_start: periodStart,
        period_end: periodEnd,
        gross_sales: parseInt(gross, 10) || 0,
        commission: parseInt(commission, 10) || 0,
        promo_co_funding: parseInt(coFunding, 10) || 0,
        other_fees: parseInt(other, 10) || 0,
        net_transfer: parseInt(net, 10) || 0,
      });
      if (res.ok) {
        toast.success(
          res.diff === 0 ? "Settlement cocok ✓" : `Tersimpan — selisih ${formatRupiah(res.diff ?? 0)}`,
        );
        onClose();
        router.refresh();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  const num = (v: string, set: (s: string) => void, label: string) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-stone-500">{label}</label>
      <input
        value={v}
        onChange={(e) => set(e.target.value)}
        inputMode="numeric"
        className="w-full rounded-btn border border-stone-300 px-3 py-2 text-right tabular-nums dark:border-stone-700 dark:bg-stone-800"
      />
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Input Settlement" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(["gofood", "grabfood", "shopeefood"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={cn(
                "touch-target rounded-btn border-2 py-2.5 text-sm font-bold capitalize",
                channel === c ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-stone-200 dark:border-stone-700",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Periode mulai</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full rounded-btn border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Periode akhir</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full rounded-btn border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {num(gross, setGross, "Gross sales")}
          {num(commission, setCommission, "Komisi")}
          {num(coFunding, setCoFunding, "Promo co-funding")}
          {num(other, setOther, "Biaya lain")}
        </div>
        {num(net, setNet, "Net transfer (dari bank)")}
        <div className={cn("rounded-xl p-3 text-center text-sm font-bold", diff === 0 ? "bg-green-50 text-green-700 dark:bg-green-500/10" : "bg-red-50 text-red-600 dark:bg-red-500/10")}>
          Expected: {formatRupiah(expected)} · Selisih: {formatRupiah(diff)}
        </div>
        <button
          onClick={submit}
          disabled={pending || !periodStart || !periodEnd}
          className="touch-target h-12 w-full rounded-btn bg-brand-600 font-bold text-white disabled:opacity-40"
        >
          {pending ? "Menyimpan…" : "Simpan Settlement"}
        </button>
      </div>
    </Modal>
  );
}
