import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  mintToken,
  verifyToken,
  STAFF_SESSION_TTL_SECONDS,
} from "@/lib/auth/jwt";

export const STAFF_COOKIE = "cp_token";

export interface StaffSession {
  uid: string;
  role: "owner" | "manager" | "cashier";
  name: string;
}

export async function setStaffSession(profile: {
  id: string;
  name: string;
  role: StaffSession["role"];
}): Promise<void> {
  const token = mintToken(
    {
      sub: profile.id,
      role: "authenticated",
      staff_role: profile.role,
      name: profile.name,
    },
    STAFF_SESSION_TTL_SECONDS,
  );
  const store = await cookies();
  store.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: STAFF_SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearStaffSession(): Promise<void> {
  const store = await cookies();
  store.delete(STAFF_COOKIE);
}

/** Ambil sesi staf dari cookie — null bila tidak valid/Expired. */
export async function getStaff(): Promise<StaffSession | null> {
  const raw = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!raw) return null;
  const payload = verifyToken(raw);
  if (!payload || payload.role !== "authenticated") return null;
  return {
    uid: payload.sub,
    role: (payload["staff_role"] as StaffSession["role"]) ?? "cashier",
    name: (payload["name"] as string) ?? "",
  };
}

/** Untuk Server Component: redirect ke /login bila belum login. */
export async function requireStaff(): Promise<StaffSession> {
  const session = await getStaff();
  if (!session) redirect("/login");
  return session;
}

/** Untuk Server Component: hanya owner/manager. */
export async function requireManager(): Promise<StaffSession> {
  const session = await requireStaff();
  if (session.role === "cashier") redirect("/register");
  return session;
}

/** Untuk Server Action: lempar Error bila tidak berhak (caller menangani). */
export async function assertRole(roles: StaffSession["role"][]): Promise<StaffSession> {
  const session = await getStaff();
  if (!session || !roles.includes(session.role)) {
    throw new Error("Tidak diizinkan — peran staf tidak memenuhi syarat.");
  }
  return session;
}
