"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Star, Dog, CircleHelp, Dumbbell } from "lucide-react";
import type { SalesSummary, ProductPerformance, BomLine } from "@/lib/reports/queries";
import { formatRupiah } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface Props {
  from: string;
  to: string;
  summary: SalesSummary;
  hourly: { hour: number; total: number; orders: number }[];
  channels: { channel: string; orders: number; gross: number; fee: number; net: number }[];
  categories: { category: string; qty: number; total: number }[];
  products: ProductPerformance[];
  payments: { method: string; amount: number; count: number }[];
  shiftPayments: { label: string; cash: number; nonCash: number }[];
  bom: { product_id: string; name: string; hpp_per_unit: number; lines: BomLine[] }[];
  profit: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    expensesByCategory: { category: string; amount: number }[];
    netProfit: number;
  };
}

export function ReportsClient(props: Props) {
  const router = useRouter();
  const [from, setFrom] = useState(props.from);
  const [to, setTo] = useState(props.to);

  const apply = () => router.push(`/reports?from=${from}&to=${to}`);
  const exportCsv = () => {
    window.location.href = `/api/reports/csv?from=${from}&to=${to}`;
  };

  const maxHour = Math.max(...props.hourly.map((h) => h.total), 1);
  const avgMargin =
    props.products.length > 0
      ? props.products.reduce((s, p) => s + p.margin_percent, 0) / props.products.length
      : 0;
  const avgPop =
    props.products.length > 0
      ? props.products.reduce((s, p) => s + p.popularity_share, 0) / props.products.length
      : 0;

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="block text-xs font-medium text-stone-500">Dari</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-btn border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800" />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500">Sampai</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-btn border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800" />
        </div>
        <button onClick={apply} className="touch-target rounded-btn bg-brand-600 px-5 py-2 text-sm font-bold text-white">
          Tampilkan
        </button>
        <button onClick={exportCsv} className="touch-target flex items-center gap-1 rounded-btn border border-stone-300 px-4 py-2 text-sm font-semibold dark:border-stone-700">
          <Download className="size-4" /> CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Omzet kotor" value={props.summary.gross} />
        <Stat label="Diskon" value={-props.summary.discounts} />
        <Stat label="Net (setelah fee kanal)" value={props.summary.net} highlight />
        <Stat label="Order" value={props.summary.orderCount} plain />
        <Stat label="Rata-rata / order" value={props.summary.avgTicket} />
        <Stat label="Pajak terkumpul" value={props.summary.tax} />
        <Stat label="Service charge" value={props.summary.serviceCharge} />
        <Stat label="Fee marketplace" value={props.summary.channelFees} />
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">Penjualan per Jam (WIB)</h2>
        <div className="flex h-36 items-end gap-1">
          {props.hourly.map((h) => (
            <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn("w-full rounded-t", h.total > 0 ? "bg-brand-500" : "bg-stone-100 dark:bg-stone-800")}
                style={{ height: `${Math.max((h.total / maxHour) * 100, h.total > 0 ? 6 : 2)}%` }}
                title={`${h.hour}:00 — ${formatRupiah(h.total)} (${h.orders} order)`}
              />
              {h.hour % 3 === 0 && <span className="text-[9px] text-stone-400">{h.hour}</span>}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Per Kanal</h2>
          <Table
            head={["Kanal", "Order", "Kotor", "Fee", "Net"]}
            rows={props.channels.map((c) => [c.channel, String(c.orders), formatRupiah(c.gross), formatRupiah(c.fee), formatRupiah(c.net)])}
          />
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold">Per Kategori</h2>
          <Table
            head={["Kategori", "Qty", "Omzet"]}
            rows={props.categories.map((c) => [c.category, String(c.qty), formatRupiah(c.total)])}
          />
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-bold">Tren Pembayaran per Shift</h2>
          <p className="mb-4 text-xs text-stone-500">Tunai vs non-tunai (QRIS/debit/transfer) — batang bertumpuk per shift.</p>
          {props.shiftPayments.length === 0 ? (
            <p className="text-sm text-stone-400">Belum ada shift pada rentang ini.</p>
          ) : (
            <div>
              <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ height: 180 }}>
                {props.shiftPayments.map((s) => {
                  const max = Math.max(...props.shiftPayments.map((x) => x.cash + x.nonCash), 1);
                  const cashH = Math.round((s.cash / max) * 140);
                  const nonH = Math.round((s.nonCash / max) * 140);
                  return (
                    <div key={s.label} className="flex min-w-14 flex-1 flex-col items-center gap-1">
                      <div className="flex w-full flex-col justify-end" style={{ height: 150 }}>
                        {s.nonCash > 0 && (
                          <div
                            className="w-full rounded-t-md bg-stone-700 dark:bg-stone-300"
                            style={{ height: nonH }}
                            title={`Non-tunai ${formatRupiah(s.nonCash)}`}
                          />
                        )}
                        {s.cash > 0 && (
                          <div
                            className={cn("w-full bg-brand-500", s.nonCash === 0 && "rounded-t-md")}
                            style={{ height: cashH }}
                            title={`Tunai ${formatRupiah(s.cash)}`}
                          />
                        )}
                        {s.cash === 0 && s.nonCash === 0 && (
                          <div className="h-1 w-full rounded bg-stone-200 dark:bg-stone-700" />
                        )}
                      </div>
                      <span className="whitespace-nowrap text-[10px] text-stone-500">{s.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-stone-600 dark:text-stone-400">
                <span className="flex items-center gap-1"><span className="inline-block size-3 rounded bg-brand-500" /> Tunai</span>
                <span className="flex items-center gap-1"><span className="inline-block size-3 rounded bg-stone-700 dark:bg-stone-300" /> QRIS / Debit / Transfer</span>
              </div>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold">Payment Mix</h2>
          {props.payments.length === 0 ? (
            <p className="text-sm text-stone-400">Belum ada pembayaran.</p>
          ) : (
            <Table
              head={["Metode", "Jumlah", "Total"]}
              rows={props.payments.map((p) => [p.method, String(p.count), formatRupiah(p.amount)])}
            />
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold">Laba Rugi Ringkas</h2>
          <div className="space-y-2 text-sm">
            <Row label="Pendapatan" value={formatRupiah(props.profit.revenue)} />
            <Row label="HPP (COGS)" value={`−${formatRupiah(props.profit.cogs)}`} />
            <Row label="Laba kotor" value={formatRupiah(props.profit.grossProfit)} bold />
            {props.profit.expensesByCategory.map((e) => (
              <Row key={e.category} label={`Beban ${e.category}`} value={`−${formatRupiah(e.amount)}`} />
            ))}
            {props.profit.expensesByCategory.length === 0 && <Row label="Beban operasional" value="Rp0" />}
            <Row label="Laba bersih" value={formatRupiah(props.profit.netProfit)} bold highlight={props.profit.netProfit >= 0} />
          </div>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-bold">Rincian HPP per Porsi (BOM)</h2>
        <p className="mb-3 text-xs text-stone-500">
          HPP per porsi dari resep aktif, dengan acuan konversi satuan beli.
        </p>
        {props.bom.length === 0 ? (
          <p className="text-sm text-stone-400">Belum ada resep.</p>
        ) : (
          <div className="space-y-3">
            {props.bom.map((p) => (
              <details key={p.product_id} className="rounded-xl border border-stone-200 dark:border-stone-800">
                <summary className="flex cursor-pointer items-center justify-between gap-2 p-3 text-sm font-semibold">
                  <span>{p.name}</span>
                  <span className="tabular-nums">HPP {formatRupiah(p.hpp_per_unit)}/porsi</span>
                </summary>
                <ul className="divide-y divide-stone-100 border-t border-stone-100 px-3 dark:divide-stone-800 dark:border-stone-800">
                  {p.lines.map((l) => (
                    <li key={l.ingredient_name} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0">
                        {l.ingredient_name} <span className="text-xs text-stone-400">{l.qty_per_unit.toLocaleString("id-ID")} {l.unit}</span>
                        {l.purchase_unit && l.conversion_factor != null && l.conversion_factor > 0 && (
                          <span className="block text-xs font-semibold text-brand-600 dark:text-brand-400">
                            beli: 1 {l.purchase_unit} = {l.conversion_factor.toLocaleString("id-ID")} {l.unit}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-stone-500">{formatRupiah(l.cost_line)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-bold">Menu Engineering</h2>
        <p className="mb-3 text-xs text-stone-500">
          Kuadran berdasarkan margin % vs popularitas. Rata-rata margin {avgMargin}% · popularitas {avgPop.toFixed(1)}%.
        </p>
        <Table
          head={["Produk", "Qty", "Omzet", "HPP", "Margin", "Kuadran"]}
          rows={props.products.map((p) => {
            const isHighMargin = p.margin_percent >= avgMargin;
            const isPopular = p.popularity_share >= avgPop;
            const quad = isHighMargin
              ? isPopular
                ? { label: "Bintang", icon: Star, cls: "text-green-600" }
                : { label: "Kuda Beban", icon: Dumbbell, cls: "text-blue-600" }
              : isPopular
                ? { label: "Misteri", icon: CircleHelp, cls: "text-amber-600" }
                : { label: "Anjing", icon: Dog, cls: "text-red-500" };
            const Icon = quad.icon;
            return [
              p.name,
              String(p.qty),
              formatRupiah(p.revenue),
              formatRupiah(p.hpp),
              `${p.margin_percent}%`,
              <span key={p.product_id} className={cn("flex items-center gap-1 font-semibold", quad.cls)}>
                <Icon className="size-3.5" /> {quad.label}
              </span>,
            ];
          })}
        />
      </section>
    </div>
  );
}

function Stat({ label, value, highlight, plain }: { label: string; value: number; highlight?: boolean; plain?: boolean }) {
  return (
    <div className={cn("card p-4", highlight && "border-brand-400 bg-brand-50 dark:bg-brand-500/10")}>
      <p className="text-[11px] uppercase tracking-wide text-stone-500">{label}</p>
      <p className="text-xl font-bold tabular-nums">{plain ? value : formatRupiah(value)}</p>
    </div>
  );
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={cn("flex justify-between", bold && "font-bold border-t border-dashed border-stone-300 pt-2 dark:border-stone-700", highlight && "text-green-600")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) return <p className="text-sm text-stone-400">Belum ada data.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-xs uppercase text-stone-400 dark:border-stone-800">
            {head.map((h) => (
              <th key={h} className="pb-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-stone-100 last:border-0 dark:border-stone-800">
              {row.map((cell, j) => (
                <td key={j} className="py-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
