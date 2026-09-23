import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mintToken, verifyToken, PORTAL_SESSION_TTL_SECONDS } from "@/lib/auth/jwt";

export const PORTAL_COOKIE = "cp_portal";

export interface PortalSession {
  portalCustomerId: string;
  memberId: string | null;
  name: string;
}

export async function setPortalSession(session: {
  portalCustomerId: string;
  memberId: string | null;
  name: string;
}): Promise<void> {
  const token = mintToken(
    {
      sub: session.portalCustomerId,
      role: "portal", // bukan "authenticated" — RLS staf tidak berlaku
      member_id: session.memberId ?? "",
      name: session.name,
    },
    PORTAL_SESSION_TTL_SECONDS,
  );
  const store = await cookies();
  store.set(PORTAL_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PORTAL_SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearPortalSession(): Promise<void> {
  (await cookies()).delete(PORTAL_COOKIE);
}

export async function getPortal(): Promise<PortalSession | null> {
  const raw = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (!raw) return null;
  const payload = verifyToken(raw);
  if (!payload || payload.role !== "portal") return null;
  return {
    portalCustomerId: payload.sub,
    memberId: (payload["member_id"] as string) || null,
    name: (payload["name"] as string) ?? "",
  };
}

export async function requirePortal(): Promise<PortalSession> {
  const session = await getPortal();
  if (!session) redirect("/portal-login");
  return session;
}
