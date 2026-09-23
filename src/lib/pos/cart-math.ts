// Kalkulasi cart murni (tanpa IO) — dipakai klien & server.
// Semua uang integer rupiah, pembulatan Math.round.

export interface CartOption {
  option_id: string;
  option_group_id: string;
  group_name: string;
  name: string;
  price_delta: number;
}

export interface CartLine {
  key: string; // unik per kombinasi produk+opsi+catatan
  product_id: string;
  name: string;
  base_price: number;
  qty: number;
  options: CartOption[];
  note: string;
  discount: number; // per baris (rupiah total, bukan per unit)
}

export interface PricingConfig {
  taxPercent: number;
  servicePercent: number;
  orderDiscount: number;
  promoDiscount: number;
  deliveryFee: number;
  pointsRedeemed: number;
}

export function unitPrice(line: Pick<CartLine, "base_price" | "options">): number {
  return line.base_price + line.options.reduce((sum, o) => sum + o.price_delta, 0);
}

export function lineSubtotal(line: CartLine): number {
  return Math.max(0, unitPrice(line) * line.qty - line.discount);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineSubtotal(l), 0);
}

export interface OrderTotals {
  subtotal: number;
  orderDiscount: number;
  promoDiscount: number;
  pointsDiscount: number;
  deliveryFee: number;
  tax: number;
  serviceCharge: number;
  total: number;
}

export function computeTotals(lines: CartLine[], cfg: PricingConfig): OrderTotals {
  const subtotal = cartSubtotal(lines);
  const pointsDiscount = Math.min(cfg.pointsRedeemed, subtotal);
  const taxable = Math.max(0, subtotal - cfg.orderDiscount - cfg.promoDiscount - pointsDiscount);
  const serviceCharge = Math.round((taxable * cfg.servicePercent) / 100);
  const tax = Math.round(((taxable + serviceCharge) * cfg.taxPercent) / 100);
  const total = taxable + serviceCharge + tax + cfg.deliveryFee;
  return {
    subtotal,
    orderDiscount: cfg.orderDiscount,
    promoDiscount: cfg.promoDiscount,
    pointsDiscount,
    deliveryFee: cfg.deliveryFee,
    tax,
    serviceCharge,
    total,
  };
}

export function changeDue(paid: number, total: number): number {
  return Math.max(0, paid - total);
}

/** Kunci unik baris: produk sama + opsi sama + catatan sama → digabung qty. */
export function makeLineKey(
  productId: string,
  optionIds: string[],
  note: string,
): string {
  return [productId, [...optionIds].sort().join("+"), note.trim()].join("|");
}
