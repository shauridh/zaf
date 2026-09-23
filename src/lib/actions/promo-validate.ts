"use server";

import "server-only";
import { validatePromoCode } from "@/lib/pos/pricing";

export async function validatePromoCodeAction(
  code: string,
  subtotal: number,
  lines: { product_id: string; qty: number; unit_price: number }[],
) {
  return validatePromoCode(code, subtotal, lines);
}
