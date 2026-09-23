import { describe, it, expect } from "vitest";
import {
  unitPrice,
  lineSubtotal,
  cartSubtotal,
  computeTotals,
  changeDue,
  makeLineKey,
  type CartLine,
} from "@/lib/pos/cart-math";

function line(partial: Partial<CartLine>): CartLine {
  return {
    key: "k",
    product_id: "p1",
    name: "Ayam",
    base_price: 20000,
    qty: 1,
    options: [],
    note: "",
    discount: 0,
    ...partial,
  };
}

describe("unitPrice", () => {
  it("harga dasar tanpa opsi", () => {
    expect(unitPrice(line({}))).toBe(20000);
  });

  it("menjumlahkan delta opsi", () => {
    expect(
      unitPrice(
        line({
          options: [
            { option_id: "o1", option_group_id: "g1", group_name: "Ukuran", name: "Jumbo", price_delta: 10000 },
            { option_id: "o2", option_group_id: "g2", group_name: "Toping", name: "Krupuk", price_delta: 3000 },
          ],
        }),
      ),
    ).toBe(33000);
  });
});

describe("lineSubtotal & cartSubtotal", () => {
  it("qty × unit price − diskon baris", () => {
    expect(lineSubtotal(line({ qty: 3, discount: 5000 }))).toBe(55000);
  });

  it("tidak pernah negatif", () => {
    expect(lineSubtotal(line({ discount: 999999 }))).toBe(0);
  });

  it("cartSubtotal menjumlahkan semua baris", () => {
    expect(cartSubtotal([line({ qty: 2 }), line({ base_price: 10000 })])).toBe(50000);
  });
});

describe("computeTotals", () => {
  it("pajak & service charge dibulatkan", () => {
    const t = computeTotals(
      [line({ base_price: 10000 })],
      { taxPercent: 11, servicePercent: 5, orderDiscount: 0, promoDiscount: 0, deliveryFee: 0, pointsRedeemed: 0 },
    );
    // taxable 10000 → service 500 → pajak 11% × 10500 = 1155 → total 11655
    expect(t.serviceCharge).toBe(500);
    expect(t.tax).toBe(1155);
    expect(t.total).toBe(11655);
  });

  it("diskon order + promo mengurangi dasar pajak", () => {
    const t = computeTotals(
      [line({ base_price: 50000 })],
      { taxPercent: 10, servicePercent: 0, orderDiscount: 10000, promoDiscount: 5000, deliveryFee: 0, pointsRedeemed: 0 },
    );
    expect(t.total).toBe(50000 - 15000 + 3500);
  });

  it("redeem poin dibatasi subtotal & ikut mengurangi pajak", () => {
    const t = computeTotals(
      [line({ base_price: 20000 })],
      { taxPercent: 0, servicePercent: 0, orderDiscount: 0, promoDiscount: 0, deliveryFee: 0, pointsRedeemed: 999999 },
    );
    expect(t.pointsDiscount).toBe(20000);
    expect(t.total).toBe(0);
  });

  it("ongkir ditambahkan setelah pajak", () => {
    const t = computeTotals(
      [line({ base_price: 10000 })],
      { taxPercent: 0, servicePercent: 0, orderDiscount: 0, promoDiscount: 0, deliveryFee: 12000, pointsRedeemed: 0 },
    );
    expect(t.total).toBe(22000);
  });
});

describe("changeDue & makeLineKey", () => {
  it("kembalian tidak negatif", () => {
    expect(changeDue(30000, 25000)).toBe(5000);
    expect(changeDue(20000, 25000)).toBe(0);
  });

  it("line key sama untuk opsi urutan beda & catatan trim", () => {
    expect(makeLineKey("p1", ["a", "b"], "  tanpa bawang ")).toBe(
      makeLineKey("p1", ["b", "a"], "tanpa bawang"),
    );
    expect(makeLineKey("p1", ["a"], "")).not.toBe(makeLineKey("p1", ["a", "b"], ""));
  });
});
