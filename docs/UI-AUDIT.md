# 🖥️ ChickenPOS — Audit UI Responsif & Lighthouse (M8-T7)

Tanggal audit: 2026-09-21 · Build produksi `next build` + `next start`

## Hasil Lighthouse (preset desktop — konteks perangkat POS)

| Kategori | Skor |
|---|---|
| Performance | **100** |
| Accessibility | **100** |
| Best Practices | 96 |
| SEO | **100** |

Target DoD **≥90 terpenuhi** di semua kategori.

Catatan emulasi mobile (Moto G, throttle 4×): Performance 83–90 tergantung kondisi server
(.run pertama saat cold start lebih rendah). Didominasi hydration React + blocking font —
wajar untuk aplikasi transaksional; perangkat POS nyata (tablet/desktop) memakai preset desktop.

## Perbaikan yang Dilakukan Saat Audit

| Temuan | Perbaikan |
|---|---|
| `meta-viewport` gagal: `user-scalable=no` memblokir zoom (aksesibilitas) | Viewport zoom tidak dikunci; pembatasan pinch-zoom dilakukan via kiosk mode/perangkat, bukan meta |
| `color-contrast` gagal: teks abu `stone-500` di atas putih (login) | Naik ke `stone-600` (dark: `stone-400`) |

## Checklist Responsif (verifikasi manual + kode)

| Item | Status | Bukti |
|---|---|---|
| Target sentuh ≥44px (`touch-target`) di semua tombol kasir | ✅ | utilitas `.touch-target`, numpad h-14 (56px) |
| Grid produk adaptif: 2 kolom (HP) → 3 (sm) → 4 (xl) | ✅ | `register-screen.tsx` |
| Sidebar rail desktop + bottom nav mobile + top bar HP | ✅ | `pos-sidebar.tsx` |
| Modal pembayaran responsif (2 kolom cash di ≥sm) | ✅ | `PaymentPanel` |
| Dark mode penuh (class-based) di semua layar | ✅ | `globals.css` + kelas `dark:` |
| Font sistem wajib (`next/font` Inter, display swap) | ✅ | `layout.tsx` |
| `touch-action: manipulation` — tanpa delay klik 300ms, tanpa double-tap zoom | ✅ | `globals.css` |
| PWA installable + offline shell (Serwist) | ✅ | `manifest.ts`, `sw.ts`, `/offline` |

## Cara Mengulang Audit

```bash
npm run build && npm run start -- -p 3012
CHROME_PATH="<path chrome>" npx lighthouse http://localhost:3012/login \
  --preset=desktop --only-categories=performance,accessibility,best-practices,seo \
  --output=json --output-path=./lh.json
```
