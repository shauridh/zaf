import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Util JWT HS256 + hashing PIN (scrypt) tanpa dependensi eksternal.
 * Token sesi membawa claim { sub: profileId, role: "authenticated" }
 * supaya PostgREST/RLS mengenali request staf/portal.
 */

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "";
export const STAFF_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 jam
export const PORTAL_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 hari

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
}

interface JwtPayload {
  sub: string;
  role: string;
  [key: string]: unknown;
}

export function mintToken(payload: JwtPayload, ttlSeconds: number): string {
  if (!JWT_SECRET) {
    throw new Error("SUPABASE_JWT_SECRET belum diset di environment.");
  }
  const now = Math.floor(Date.now() / 1000);
  const body = {
    iss: "supabase",
    ref: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://supabase.co").hostname.split(".")[0],
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify(body));
  return `${header}.${claims}.${sign(`${header}.${claims}`)}`;
}

export function verifyToken(token: string): JwtPayload | null {
  if (!JWT_SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, claims, signature] = parts;
  const expected = sign(`${header}.${claims}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(claims, "base64url").toString()) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------- PIN hashing (scrypt) ----------------

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 });
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(pin, Buffer.from(saltHex, "hex"), 32, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}
