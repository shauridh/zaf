import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";

const STAFF_COOKIE = "cp_token";

/** Dipakai createSupabaseBrowserClient via accessToken callback. */
export async function GET() {
  const raw = (await cookies()).get(STAFF_COOKIE)?.value ?? "";
  if (!raw) return NextResponse.json({ token: null }, { status: 401 });

  const payload = verifyToken(raw);
  if (!payload) return NextResponse.json({ token: null }, { status: 401 });

  return NextResponse.json({ token: raw });
}
