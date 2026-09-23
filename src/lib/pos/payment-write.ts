import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentKind, PaymentMethod } from "@/lib/types/database";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** id shift laci yang sedang terbuka untuk outlet (null bila laci belum dibuka). */
export async function resolveOpenShiftId(admin: Admin, outletId: string): Promise<string | null> {
  const { data } = await admin
    .from("shifts")
    .select("id")
    .eq("outlet_id", outletId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export interface PaymentWrite {
  order_id: string;
  method: PaymentMethod;
  kind: PaymentKind;
  amount: number;
  reference?: string | null;
  proof_url?: string | null;
  /** Shift penerima uang (migrasi 0011). null = uang masuk di luar shift. */
  shift_id: string | null;
}

/**
 * Satu-satunya cara menulis baris `payments`: tipe ini mewajibkan `shift_id`,
 * jadi tidak ada jalur yang bisa menyisipkan pembayaran tanpa pemilik shift.
 */
export async function insertPayment(admin: Admin, row: PaymentWrite): Promise<void> {
  const { error } = await admin.from("payments").insert(row);
  if (error) throw new Error(error.message);
}
