"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaff, assertRole } from "@/lib/auth/session";
import { businessDateWIB } from "@/lib/utils/format";

const OUTLET_ID = "00000000-0000-0000-0000-000000000001";

export interface ExpenseView {
  id: string;
  category: string;
  amount: number;
  note: string | null;
  spent_at: string;
}

export async function listExpenses(from: string, to: string): Promise<ExpenseView[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("expenses")
    .select("id, category, amount, note, spent_at")
    .gte("spent_at", from)
    .lte("spent_at", to)
    .order("spent_at", { ascending: false });
  return (data ?? []) as unknown as ExpenseView[];
}

export async function addExpense(
  category: string,
  amount: number,
  note: string,
  spentAt: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Sesi berakhir" };
    if (amount <= 0) return { ok: false, error: "Nominal tidak valid" };
    if (!category.trim()) return { ok: false, error: "Kategori wajib" };

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("expenses").insert({
      outlet_id: OUTLET_ID,
      category: category.trim(),
      amount,
      note: note || null,
      spent_at: spentAt || businessDateWIB(),
      created_by: staff.uid,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal simpan pengeluaran" };
  }
}

// ---------- Settlement marketplace ----------

export interface SettlementView {
  id: string;
  channel: string;
  period_start: string;
  period_end: string;
  gross_sales: number;
  commission: number;
  promo_co_funding: number;
  other_fees: number;
  net_transfer: number;
  expected_net: number;
  diff: number;
  matched: boolean;
}

export async function listSettlements(limit = 20): Promise<SettlementView[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("marketplace_settlements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const gross = Number(r.gross_sales);
    const net = Number(r.net_transfer);
    const expected = gross - Number(r.commission) - Number(r.promo_co_funding) - Number(r.other_fees);
    return {
      id: r.id as string,
      channel: r.channel as string,
      period_start: r.period_start as string,
      period_end: r.period_end as string,
      gross_sales: gross,
      commission: Number(r.commission),
      promo_co_funding: Number(r.promo_co_funding),
      other_fees: Number(r.other_fees),
      net_transfer: net,
      expected_net: expected,
      diff: net - expected,
      matched: r.matched as boolean,
    };
  });
}

export async function addSettlement(input: {
  channel: "gofood" | "grabfood" | "shopeefood";
  period_start: string;
  period_end: string;
  gross_sales: number;
  commission: number;
  promo_co_funding: number;
  other_fees: number;
  net_transfer: number;
  note?: string;
}): Promise<{ ok: boolean; error?: string; diff?: number }> {
  try {
    await assertRole(["owner", "manager"]);
    const admin = createSupabaseAdminClient();
    const expected =
      input.gross_sales - input.commission - input.promo_co_funding - input.other_fees;
    const diff = input.net_transfer - expected;
    const { error } = await admin.from("marketplace_settlements").insert({
      outlet_id: OUTLET_ID,
      ...input,
      matched: Math.abs(diff) <= 1,
      note: input.note || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true, diff };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal simpan settlement" };
  }
}
