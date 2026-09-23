import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Rentang UTC dari rentang business date WIB (inklusif). */
export function wibRange(from: string, to: string): { start: string; end: string } {
  return {
    start: new Date(`${from}T00:00:00+07:00`).toISOString(),
    end: new Date(`${to}T23:59:59.999+07:00`).toISOString(),
  };
}

export interface SalesSummary {
  gross: number; // subtotal sebelum diskon
  discounts: number; // order + promo
  net: number; // total after discount, excl. fee marketplace
  channelFees: number;
  tax: number;
  serviceCharge: number;
  orderCount: number;
  avgTicket: number;
  trainingOrders: number;
}

interface OrderLite {
  training: boolean;
  status: string;
  channel: string;
  subtotal: number;
  order_discount: number;
  promo_discount: number;
  total: number;
  channel_fee: number;
  tax: number;
  service_charge: number;
  created_at: string;
}

function isCounted(o: OrderLite): boolean {
  return ["completed", "ready", "preparing", "confirmed"].includes(o.status) && !o.training;
}

export async function salesSummary(from: string, to: string): Promise<SalesSummary> {
  const admin = createSupabaseAdminClient();
  const { start, end } = wibRange(from, to);
  const { data } = await admin
    .from("orders")
    .select(
      "training, status, channel, subtotal, order_discount, promo_discount, total, channel_fee, tax, service_charge, created_at",
    )
    .gte("created_at", start)
    .lte("created_at", end);
  const orders = ((data ?? []) as unknown as OrderLite[]).filter(isCounted);

  const gross = orders.reduce((s, o) => s + o.subtotal, 0);
  const discounts = orders.reduce((s, o) => s + o.order_discount + o.promo_discount, 0);
  const channelFees = orders.reduce((s, o) => s + (o.channel_fee ?? 0), 0);
  const net = orders.reduce((s, o) => s + o.total, 0) - channelFees;
  const tax = orders.reduce((s, o) => s + o.tax, 0);
  const serviceCharge = orders.reduce((s, o) => s + o.service_charge, 0);
  const orderCount = orders.length;

  return {
    gross,
    discounts,
    net,
    channelFees,
    tax,
    serviceCharge,
    orderCount,
    avgTicket: orderCount > 0 ? Math.round(gross / orderCount) : 0,
    trainingOrders: ((data ?? []) as unknown as OrderLite[]).filter((o) => o.training).length,
  };
}

export async function hourlySales(from: string, to: string): Promise<{ hour: number; total: number; orders: number }[]> {
  const admin = createSupabaseAdminClient();
  const { start, end } = wibRange(from, to);
  const { data } = await admin
    .from("orders")
    .select("total, created_at")
    .gte("created_at", start)
    .lte("created_at", end);
  const map = new Map<number, { total: number; orders: number }>();
  for (const o of ((data ?? []) as unknown as { total: number; created_at: string }[]).filter((o) => o.total > 0)) {
    // Jam WIB
    const hourWIB = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }).format(
        new Date(o.created_at),
      ),
    );
    const entry = map.get(hourWIB) ?? { total: 0, orders: 0 };
    entry.total += o.total;
    entry.orders += 1;
    map.set(hourWIB, entry);
  }
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    total: map.get(hour)?.total ?? 0,
    orders: map.get(hour)?.orders ?? 0,
  }));
}

export async function salesByChannel(from: string, to: string): Promise<{ channel: string; orders: number; gross: number; fee: number; net: number }[]> {
  const admin = createSupabaseAdminClient();
  const { start, end } = wibRange(from, to);
  const { data } = await admin
    .from("orders")
    .select("channel, total, channel_fee")
    .gte("created_at", start)
    .lte("created_at", end);
  const map = new Map<string, { orders: number; gross: number; fee: number }>();
  for (const o of ((data ?? []) as unknown as OrderLite[]).filter(isCounted)) {
    const e = map.get(o.channel) ?? { orders: 0, gross: 0, fee: 0 };
    e.orders += 1;
    e.gross += o.total;
    e.fee += o.channel_fee ?? 0;
    map.set(o.channel, e);
  }
  return [...map.entries()]
    .map(([channel, e]) => ({ channel, ...e, net: e.gross - e.fee }))
    .sort((a, b) => b.gross - a.gross);
}

export async function salesByCategory(from: string, to: string): Promise<{ category: string; qty: number; total: number }[]> {
  const admin = createSupabaseAdminClient();
  const { start, end } = wibRange(from, to);
  const { data } = await admin
    .from("orders")
    .select("items, status, training, created_at")
    .gte("created_at", start)
    .lte("created_at", end);
  const catName = new Map<string, string>(
    (((await admin.from("categories").select("id, name")).data ?? []) as { id: string; name: string }[]).map(
      (c): [string, string] => [c.id, c.name],
    ),
  );
  const prodCat = new Map<string, string>(
    (((await admin.from("products").select("id, category_id")).data ?? []) as { id: string; category_id: string }[]).map(
      (p): [string, string] => [p.id, p.category_id],
    ),
  );
  const map = new Map<string, { qty: number; total: number }>();
  for (const o of (data ?? []) as unknown as { items: { product_id: string; qty: number; subtotal: number }[]; status: string; training: boolean }[]) {
    if (!isCounted(o as never)) continue;
    for (const item of Array.isArray(o.items) ? o.items : []) {
      const cat = prodCat.get(item.product_id) ?? "lain";
      const name = catName.get(cat) ?? "Lain-lain";
      const e = map.get(name) ?? { qty: 0, total: 0 };
      e.qty += item.qty;
      e.total += item.subtotal;
      map.set(name, e);
    }
  }
  return [...map.entries()].map(([category, e]) => ({ category, ...e })).sort((a, b) => b.total - a.total);
}

export interface ProductPerformance {
  product_id: string;
  name: string;
  qty: number;
  revenue: number;
  hpp: number;
  margin: number;
  margin_percent: number;
  popularity_share: number;
}

/** Performa produk + kuadran menu engineering (margin × popularitas). */
export async function productPerformance(from: string, to: string): Promise<ProductPerformance[]> {
  const admin = createSupabaseAdminClient();
  const { start, end } = wibRange(from, to);
  const [ordersRes, recipesRes, ingsRes, prodsRes] = await Promise.all([
    admin.from("orders").select("items, status, training, created_at").gte("created_at", start).lte("created_at", end),
    admin.from("recipes").select("product_id, ingredient_id, qty_per_unit"),
    admin.from("ingredients").select("id, cost_per_unit"),
    admin.from("products").select("id, name"),
  ]);

  const ingCost = new Map(((ingsRes.data ?? []) as { id: string; cost_per_unit: number }[]).map((i) => [i.id, Number(i.cost_per_unit)]));
  const hpp = new Map<string, number>();
  for (const r of (recipesRes.data ?? []) as { product_id: string; ingredient_id: string; qty_per_unit: number }[]) {
    hpp.set(r.product_id, (hpp.get(r.product_id) ?? 0) + Number(r.qty_per_unit) * (ingCost.get(r.ingredient_id) ?? 0));
  }
  const prodName = new Map(((prodsRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const map = new Map<string, { qty: number; revenue: number }>();
  let totalQty = 0;
  for (const o of (ordersRes.data ?? []) as unknown as { items: { product_id: string; qty: number; subtotal: number }[]; status: string; training: boolean }[]) {
    if (!isCounted(o as never)) continue;
    for (const item of Array.isArray(o.items) ? o.items : []) {
      const e = map.get(item.product_id) ?? { qty: 0, revenue: 0 };
      e.qty += item.qty;
      e.revenue += item.subtotal;
      map.set(item.product_id, e);
      totalQty += item.qty;
    }
  }

  return [...map.entries()]
    .map(([product_id, e]) => {
      const name = prodName.get(product_id) ?? "—";
      const cost = Math.round((hpp.get(product_id) ?? 0) * e.qty);
      const margin = e.revenue - cost;
      return {
        product_id,
        name,
        qty: e.qty,
        revenue: e.revenue,
        hpp: cost,
        margin,
        margin_percent: e.revenue > 0 ? Math.round((margin / e.revenue) * 100) : 0,
        popularity_share: totalQty > 0 ? Math.round((e.qty / totalQty) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export interface BomLine {
  ingredient_name: string;
  unit: string;
  qty_per_unit: number;
  cost_line: number;
  purchase_unit: string | null;
  conversion_factor: number | null;
}

/** Rincian HPP per porsi (BOM) per produk, termasuk info konversi satuan beli. */
export async function bomDetail(): Promise<{
  product_id: string;
  name: string;
  hpp_per_unit: number;
  lines: BomLine[];
}[]> {
  const admin = createSupabaseAdminClient();
  const [prodsRes, recipesRes, ingsRes] = await Promise.all([
    admin.from("products").select("id, name").order("name"),
    admin.from("recipes").select("product_id, ingredient_id, qty_per_unit"),
    admin.from("ingredients").select("id, name, unit, cost_per_unit, purchase_unit, conversion_factor"),
  ]);
  const ingMap = new Map(
    ((ingsRes.data ?? []) as {
      id: string;
      name: string;
      unit: string;
      cost_per_unit: number;
      purchase_unit: string | null;
      conversion_factor: number | null;
    }[]).map((i) => [i.id, i]),
  );
  const byProduct = new Map<string, BomLine[]>();
  for (const r of (recipesRes.data ?? []) as { product_id: string; ingredient_id: string; qty_per_unit: number }[]) {
    const ing = ingMap.get(r.ingredient_id);
    if (!ing) continue;
    const list = byProduct.get(r.product_id) ?? [];
    const qty = Number(r.qty_per_unit);
    list.push({
      ingredient_name: ing.name,
      unit: ing.unit,
      qty_per_unit: qty,
      cost_line: qty * Number(ing.cost_per_unit),
      purchase_unit: ing.purchase_unit && ing.purchase_unit !== ing.unit ? ing.purchase_unit : null,
      conversion_factor: ing.conversion_factor != null ? Number(ing.conversion_factor) : null,
    });
    byProduct.set(r.product_id, list);
  }
  return ((prodsRes.data ?? []) as { id: string; name: string }[])
    .map((p) => {
      const lines = byProduct.get(p.id) ?? [];
      return {
        product_id: p.id,
        name: p.name,
        hpp_per_unit: lines.reduce((s, l) => s + l.cost_line, 0),
        lines,
      };
    })
    .filter((p) => p.lines.length > 0);
}

export async function paymentMix(from: string, to: string): Promise<{ method: string; amount: number; count: number }[]> {
  const admin = createSupabaseAdminClient();
  const { start, end } = wibRange(from, to);
  const { data } = await admin
    .from("payments")
    .select("method, amount")
    .eq("kind", "final")
    .gte("created_at", start)
    .lte("created_at", end);
  const map = new Map<string, { amount: number; count: number }>();
  for (const p of ((data ?? []) as { method: string; amount: number }[])) {
    const e = map.get(p.method) ?? { amount: 0, count: 0 };
    e.amount += p.amount;
    e.count += 1;
    map.set(p.method, e);
  }
  return [...map.entries()].map(([method, e]) => ({ method, ...e })).sort((a, b) => b.amount - a.amount);
}

export async function paymentsByShift(from: string, to: string): Promise<
  { label: string; cash: number; nonCash: number }[]
> {
  const admin = createSupabaseAdminClient();
  const { start, end } = wibRange(from, to);
  const { data } = await admin
    .from("shifts")
    .select(
      "id, opened_at, closed_at, opening_cash, expected_cash, payments(method, amount)",
    )
    .gte("opened_at", start)
    .lte("opened_at", end)
    .order("opened_at", { ascending: true });
  return ((data ?? []) as unknown as {
    id: string;
    opened_at: string;
    closed_at: string | null;
    opening_cash: number;
    expected_cash: number;
    payments: { method: string; amount: number }[];
  }[]).map((sh) => {
    let cash = 0;
    let nonCash = 0;
    for (const p of sh.payments ?? []) {
      if (p.method === "cash") cash += Number(p.amount);
      else nonCash += Number(p.amount);
    }
    const t = new Date(sh.opened_at);
    const label = `${t.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} ${t.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
    return { label, cash, nonCash };
  });
}

export async function pnl(from: string, to: string): Promise<{
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  expensesByCategory: { category: string; amount: number }[];
  netProfit: number;
}> {
  const admin = createSupabaseAdminClient();

  const perf = await productPerformance(from, to);
  const revenue = perf.reduce((s, p) => s + p.revenue, 0);
  const cogs = perf.reduce((s, p) => s + p.hpp, 0);

  const { data: expData } = await admin
    .from("expenses")
    .select("category, amount")
    .gte("spent_at", from)
    .lte("spent_at", to);
  const expensesByCategory = new Map<string, number>();
  for (const e of ((expData ?? []) as { category: string; amount: number }[])) {
    expensesByCategory.set(e.category, (expensesByCategory.get(e.category) ?? 0) + e.amount);
  }
  const expenses = [...expensesByCategory.values()].reduce((s, v) => s + v, 0);

  return {
    revenue,
    cogs,
    grossProfit: revenue - cogs,
    expenses,
    expensesByCategory: [...expensesByCategory.entries()].map(([category, amount]) => ({ category, amount })),
    netProfit: revenue - cogs - expenses,
  };
}
