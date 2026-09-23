import { describe, it, expect } from "vitest";
import { formatRupiah, businessDateWIB } from "@/lib/utils/format";
import { calcPointsEarned, calcPointsValue } from "@/lib/pos/loyalty";

// Replika formula expected cash (harus identik dengan lib/actions/shifts.ts)
function expectedCash(opening: number, cashSales: number, cashIn: number, cashOut: number): number {
  return opening + cashSales + cashIn - cashOut;
}

describe("rekonsiliasi laci kas (modal 350.000)", () => {
  it("modal default 350rb + tunai = expected", () => {
    expect(expectedCash(350000, 150000, 0, 0)).toBe(500000);
  });

  it("pay-in menambah, pay-out mengurangi", () => {
    expect(expectedCash(350000, 100000, 50000, 30000)).toBe(470000);
  });

  it("cash drop mengurangi laci (dicatat sbg pay-out)", () => {
    const drop = 200000;
    expect(expectedCash(350000, 400000, 0, drop)).toBe(550000);
  });

  it("variance = hitung fisik − expected", () => {
    const expected = expectedCash(350000, 200000, 0, 0);
    const counted = 548000;
    expect(counted - expected).toBe(-2000);
  });

  it("kas pas → variance nol", () => {
    const expected = expectedCash(350000, 650000, 10000, 0);
    // Hitung fisik: modal + tunai masuk tercatat = expected → variance 0
    const counted = expected;
    expect(counted - expected).toBe(0);
  });
});

describe("format", () => {
  it("formatRupiah id-ID", () => {
    const s = formatRupiah(350000);
    expect(s).toContain("350.000");
    expect(s.startsWith("Rp")).toBe(true);
  });

  it("business date WIB YYYY-MM-DD", () => {
    // 23:00 WIB (16:00Z) → masih 21 Sep
    expect(businessDateWIB(new Date("2026-09-21T16:00:00Z"))).toBe("2026-09-21");
    // 00:00 WIB (17:00Z) → sudah 22 Sep
    expect(businessDateWIB(new Date("2026-09-21T17:00:00Z"))).toBe("2026-09-22");
  });
});

describe("loyalty", () => {
  it("1 poin per Rp10.000", () => {
    expect(calcPointsEarned(35000)).toBe(3);
    expect(calcPointsEarned(10000)).toBe(1);
    expect(calcPointsEarned(9999)).toBe(0);
  });

  it("1 poin = Rp100", () => {
    expect(calcPointsValue(50)).toBe(5000);
  });
});
