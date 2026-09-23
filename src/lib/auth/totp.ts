import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238) minimalis — 6 digit, SHA-1, periode 30s, window ±1.
 * Secret disimpan base32 di profiles.twofa_secret (format "totp:<secret>").
 */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20): string {
  const buf = randomBytes(bytes);
  let bits = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function b32decode(s: string): Buffer {
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const idx = B32.indexOf(c);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totpCode(secret: string, step = Math.floor(Date.now() / 30000)): string {
  const key = b32decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  counter.writeUInt32BE(step >>> 0, 4);
  const h = createHmac("sha1", key).update(counter).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin =
    ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Verifikasi dengan window ±1 step. */
export function verifyTotp(secret: string, code: string): boolean {
  const now = Math.floor(Date.now() / 30000);
  for (let w = -1; w <= 1; w++) {
    const expected = totpCode(secret, now + w);
    const a = Buffer.from(code);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export function parseTotpSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [scheme, secret] = stored.split(":");
  if (scheme !== "totp" || !secret) return null;
  return secret;
}
