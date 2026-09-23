import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

const OUTLET_ID = "00000000-0000-0000-0000-000000000001";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select(
      `id, order_number, queue_number, channel, status, created_at, table_label, customer_name,
       subtotal, order_discount, promo_discount, tax, service_charge, total, total_paid, change_due, note,
       order_items(id, name, qty, unit_price, subtotal, note, order_item_options(name, group_name, price_delta))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Struk tidak ditemukan" }, { status: 404 });
  }

  const { data: settings } = await admin
    .from("outlet_settings")
    .select("receipt_footer")
    .eq("outlet_id", OUTLET_ID)
    .maybeSingle();

  const { data: outlet } = await admin
    .from("outlets")
    .select("name, address")
    .eq("id", OUTLET_ID)
    .maybeSingle();

  const qr = await QRCode.toDataURL(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/receipt/${id}`, {
    width: 160,
    margin: 0,
  });

  return NextResponse.json({
    order,
    outlet: outlet ?? { name: "ChickenPOS", address: null },
    footer: settings?.receipt_footer ?? "Terima kasih!",
    eReceiptUrl: `/receipt/${id}`,
    qr,
  });
}
