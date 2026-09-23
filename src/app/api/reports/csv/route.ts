import { NextResponse } from "next/server";
import { productPerformance, salesByChannel, salesSummary } from "@/lib/reports/queries";

export const dynamic = "force-dynamic";

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!from || !to) return NextResponse.json({ error: "from & to wajib" }, { status: 400 });

  const [summary, channels, products] = await Promise.all([
    salesSummary(from, to),
    salesByChannel(from, to),
    productPerformance(from, to),
  ]);

  const lines: (string | number)[][] = [];
  lines.push(["LAPORAN ChickenPOS", `${from} s/d ${to}`]);
  lines.push([]);
  lines.push(["RINGKASAN"]);
  lines.push(["Omzet kotor", summary.gross]);
  lines.push(["Diskon", summary.discounts]);
  lines.push(["Net setelah fee kanal", summary.net]);
  lines.push(["Fee marketplace", summary.channelFees]);
  lines.push(["Pajak", summary.tax]);
  lines.push(["Service charge", summary.serviceCharge]);
  lines.push(["Jumlah order", summary.orderCount]);
  lines.push(["Rata-rata per order", summary.avgTicket]);
  lines.push([]);
  lines.push(["PER KANAL"]);
  lines.push(["Kanal", "Order", "Kotor", "Fee", "Net"]);
  for (const c of channels) lines.push([c.channel, c.orders, c.gross, c.fee, c.net]);
  lines.push([]);
  lines.push(["PER PRODUK"]);
  lines.push(["Produk", "Qty", "Omzet", "HPP", "Margin", "Margin %", "Popularitas %"]);
  for (const p of products) {
    lines.push([p.name, p.qty, p.revenue, p.hpp, p.margin, p.margin_percent, p.popularity_share]);
  }

  const csv = "\uFEFF" + toCsv(lines); // BOM agar Excel utf-8
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-${from}_${to}.csv"`,
    },
  });
}
