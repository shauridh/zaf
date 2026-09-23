import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Struk order terakhir — dipakai preview struk & "Cetak Struk Terakhir". */
export async function GET(request: Request) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("orders")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Belum ada order" }, { status: 404 });
  }
  return NextResponse.redirect(new URL(`/api/receipt/${data.id}`, request.url));
}
