"use server";

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface KitchenOrder {
  id: string;
  order_number: number;
  queue_number: number | null;
  channel: string;
  table_label: string | null;
  status: string;
  created_at: string;
  note: string | null;
  training: boolean;
  items: { name: string; qty: number; options: { name: string }[]; note: string | null }[];
}

interface RawOrderRow {
  id: string;
  order_number: number;
  queue_number: number | null;
  channel: string;
  table_label: string | null;
  status: string;
  created_at: string;
  note: string | null;
  training: boolean;
  items: unknown;
}

/** Order aktif untuk papan dapur (KDS). */
export async function listKitchenOrders(): Promise<KitchenOrder[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(
      "id, order_number, queue_number, channel, table_label, status, created_at, note, training, items",
    )
    .in("status", ["confirmed", "preparing", "ready"])
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RawOrderRow[]).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    queue_number: o.queue_number,
    channel: o.channel,
    table_label: o.table_label,
    status: o.status,
    created_at: o.created_at,
    note: o.note,
    training: o.training,
    items: Array.isArray(o.items)
      ? (o.items as { name: string; qty: number; options?: { name: string }[]; note?: string | null }[]).map(
          (i) => ({
            name: i.name,
            qty: i.qty,
            options: i.options ?? [],
            note: i.note ?? null,
          }),
        )
      : [],
  }));
}
