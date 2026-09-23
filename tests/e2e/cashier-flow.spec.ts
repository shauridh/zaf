import { test, expect } from "@playwright/test";

/**
 * Smoke test alur kasir inti (M8-T5):
 *   login PIN → pilih produk → keranjang → bayar tunai (numpad) → struk.
 *
 * Prasyarat:
 *   - .env.local terisi (Supabase) + migrasi & seed sudah dijalankan.
 *   - PIN staf seed harus hash valid (default seed memakai hash contoh PIN "1234";
 *     ganti via staff_change_pin bila perlu).
 *   - Jalankan: npm run test:e2e
 */

const PIN = process.env.E2E_STAFF_PIN ?? "1234";

async function pressNumpad(page: import("@playwright/test").Page, digits: string) {
  for (const d of digits) {
    await page.getByRole("button", { name: d, exact: true }).click();
  }
}

test("kasir: login → tambah item → bayar tunai → struk", async ({ page }) => {
  await page.goto("/login");

  // Tunggu hasil load: daftar staf muncul ATAU banner DB belum siap
  const dbWarning = page.getByText("Database belum terhubung");
  const ownerButton = page.getByRole("button", { name: /Owner/ }).first();
  await expect
    .poll(
      async () => {
        if (await dbWarning.isVisible().catch(() => false)) return "no-db";
        if (await ownerButton.isVisible().catch(() => false)) return "ready";
        return "loading";
      },
      { timeout: 20_000, intervals: [500, 1_000, 2_000] },
    )
    .toMatch(/^(ready|no-db)$/);

  // DB belum siap → lewati (bukan gagal)
  if (await dbWarning.isVisible().catch(() => false)) {
    test.skip(true, "Database belum terhubung — isi .env.local dan jalankan migrasi/seed");
    return;
  }

  // 1. Pilih staf owner lalu PIN
  await page.getByRole("button", { name: /Owner/ }).first().click();
  await pressNumpad(page, PIN);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/register", { timeout: 20_000 });

  // 2. Tambah produk pertama ke keranjang
  const firstProduct = page.locator("main button", { hasText: "Rp" }).first();
  await firstProduct.click();
  await expect(page.getByRole("button", { name: /Bayar ·/ })).toBeVisible();

  // 3. Buka pembayaran → tunai
  await page.getByRole("button", { name: /Bayar ·/ }).first().click();
  await page.getByRole("button", { name: "Tunai" }).click();

  // 4. Numpad uang 50.000 → kembalian muncul
  await pressNumpad(page, "50000");
  await expect(page.getByText("Kembalian")).toBeVisible();

  // 5. Selesaikan → diarahkan ke struk
  await page.getByRole("button", { name: "Selesaikan" }).click();
  await expect(page).toHaveURL(/receipt/, { timeout: 30_000 });
});
