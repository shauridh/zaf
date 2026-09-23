import { NextRequest, NextResponse } from "next/server";

const STAFF_COOKIE = "cp_token";
const POS_PREFIXES = [
  "/login", "/register", "/orders", "/kitchen", "/queue-board", "/shifts",
  "/inventory", "/catalog", "/promotions", "/channels", "/delivery",
  "/reports", "/finance", "/members", "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(STAFF_COOKIE);

  if (POS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!hasSession && pathname !== "/login") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (hasSession && pathname === "/login") {
      return NextResponse.redirect(new URL("/register", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js).*)"],
};
