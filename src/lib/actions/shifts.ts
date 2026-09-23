"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaff, assertRole } from "@/lib/auth/session";

const OUTLET_ID = "00000000-0000-0000-0000-000000000001";

export interface ShiftView {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  expected_cash: number;
  counted_cash: number | null;
  variance: number | null;
  status: string;
  cash_in: number;
  cash_out: number;
  cash_sales: number;
  non_cash_sales: number;
  order_count: number;
  movements: { id: string; kind: string; amount: number; note: string | null; created_at: string }[];
}

interface ShiftRow {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  expected_cash: number | string;
  counted_cash: number | string | null;
  variance: number | string | null;
  status: string;
}

interface PaymentRow {
  order_id: string;
  method: string;
  amount: number;
}

/** Shift terbuka untuk outlet (atau null). */
export async function getOpenShift(): Promise<ShiftView | null> {
  const admin = createSupabaseAdminClient();
  const { data: shift } = await admin
    .from("shifts")
    .select("*")
    .eq("outlet_id", OUTLET_ID)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!shift) return null;
  return enrichShift(shift as unknown as ShiftRow, admin);
}

/** Riwayat shift tertutup. */
export async function listClosedShifts(limit = 14): Promise<ShiftRow[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("shifts")
    .select("*")
    .eq("outlet_id", OUTLET_ID)
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as ShiftRow[];
}

/** Shift tertutup lengkap dengan angka kas (pembayaran/mutasi teratribusi shift_id) — untuk riwayat + Z Report. */
export async function listClosedShiftsEnriched(limit = 14): Promise<ShiftView[]> {
  const admin = createSupabaseAdminClient();
  const rows = await listClosedShifts(limit);
  return Promise.all(rows.map((r) => enrichShift(r, admin)));
}

export async function openShift(openingCash: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await assertRole(["owner", "manager", "cashier"]);
    const admin = createSupabaseAdminClient();

    const existing = await getOpenShift();
    if (existing) return { ok: false, error: "Masih ada shift terbuka — tutup dulu." };

    const settings = await admin
      .from("outlet_settings")
      .select("opening_float")
      .eq("outlet_id", OUTLET_ID)
      .maybeSingle();

    const { error } = await admin.from("shifts").insert({
      outlet_id: OUTLET_ID,
      opened_by: staff.uid,
      opening_cash: openingCash > 0 ? openingCash : Number(settings.data?.opening_float ?? 350000),
      status: "open",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal buka shift" };
  }
}

function expectedCashFor(
  shift: ShiftRow,
  cashSales: number,
  cashIn: number,
  cashOut: number,
): number {
  return Number(shift.opening_cash) + cashSales + cashIn - cashOut;
}

async function enrichShift(shift: ShiftRow, admin: ReturnType<typeof createSupabaseAdminClient>): Promise<ShiftView> {
  // Uang milik shift ini = pembayaran final yang terikat padanya (shift_id).
  // Pembayaran tanpa shift_id (uang masuk di luar shift) sengaja TIDAK dihitung.
  const [mvRes, payRes] = await Promise.all([
    admin.from("cash_movements").select("id, kind, amount, note, created_at").eq("shift_id", shift.id).order("created_at"),
    admin
      .from("payments")
      .select("order_id, method, amount")
      .eq("kind", "final")
      .eq("shift_id", shift.id),
  ]);
  const payments = (payRes.data ?? []) as unknown as PaymentRow[];

  // Kembalian (orders.change_due) tidak pernah masuk laci — penjualan tunai
  // yang mengisi laci = amount payment − kembalian order tsb.
  const cashPerOrder = new Map<string, number>();
  for (const p of payments) {
    if (p.method === "cash") cashPerOrder.set(p.order_id, (cashPerOrder.get(p.order_id) ?? 0) + p.amount);
  }
  let changeByOrder = new Map<string, number>();
  if (cashPerOrder.size > 0) {
    const { data: orows } = await admin
      .from("orders")
      .select("id, change_due")
      .in("id", [...cashPerOrder.keys()]);
    changeByOrder = new Map((orows ?? []).map((o) => [o.id, Number(o.change_due ?? 0)]));
  }
  const cashSales = [...cashPerOrder.entries()].reduce(
    (s, [orderId, amount]) => s + amount - (changeByOrder.get(orderId) ?? 0),
    0,
  );
  const nonCashSales = payments.filter((p) => p.method !== "cash").reduce((s, p) => s + p.amount, 0);

  const movements = (mvRes.data ?? []) as unknown as ShiftView["movements"];
  const cashIn = movements.filter((m) => m.kind === "pay_in").reduce((s, m) => s + m.amount, 0);
  const cashOut = movements.filter((m) => m.kind === "pay_out").reduce((s, m) => s + m.amount, 0);

  const expected = expectedCashFor(shift, cashSales, cashIn, cashOut);

  return {
    id: shift.id,
    opened_at: shift.opened_at,
    closed_at: shift.closed_at,
    opening_cash: Number(shift.opening_cash),
    expected_cash: expected,
    counted_cash: shift.counted_cash != null ? Number(shift.counted_cash) : null,
    variance: shift.variance != null ? Number(shift.variance) : null,
    status: shift.status,
    cash_in: cashIn,
    cash_out: cashOut,
    cash_sales: cashSales,
    non_cash_sales: nonCashSales,
    order_count: new Set(payments.map((p) => p.order_id)).size,
    movements,
  };
}

export async function addCashMovement(
  kind: "pay_in" | "pay_out" | "cash_drop",
  amount: number,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    if (amount <= 0) return { ok: false, error: "Nominal harus > 0" };
    const admin = createSupabaseAdminClient();
    const shift = await getOpenShift();
    if (!shift) return { ok: false, error: "Tidak ada shift terbuka" };

    const { error } = await admin.from("cash_movements").insert({
      shift_id: shift.id,
      kind,
      amount,
      note: note || null,
      created_by: staff.uid,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal catat mutasi kas" };
  }
}

export async function closeShift(
  countedCash: number,
): Promise<{ ok: boolean; error?: string; variance?: number }> {
  try {
    const staff = await assertRole(["owner", "manager", "cashier"]);
    const admin = createSupabaseAdminClient();
    const shift = await getOpenShift();
    if (!shift) return { ok: false, error: "Tidak ada shift terbuka" };

    const variance = countedCash - shift.expected_cash;

    const { error } = await admin
      .from("shifts")
      .update({
        counted_cash: countedCash,
        variance,
        expected_cash: shift.expected_cash,
        status: "closed",
        closed_by: staff.uid,
        closed_at: new Date().toISOString(),
      })
      .eq("id", shift.id);
    if (error) throw new Error(error.message);

    await admin.from("audit_logs").insert({
      actor_id: staff.uid,
      action: "shift.close",
      entity: "shifts",
      entity_id: shift.id,
      detail: { expected: shift.expected_cash, counted: countedCash, variance },
    });

    return { ok: true, variance };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal tutup shift" };
  }
}
