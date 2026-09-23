# 🍗 ChickenPOS

POS modern untuk gerai fried chicken — kasir layar sentuh cepat, operasional real-time, persediaan & HPP/BOM, laporan lengkap, PWA, plus customer portal & kiosk self-order.

> ⚠️ Proyek dalam pengembangan. Lihat [`docs/PROGRESS.md`](docs/PROGRESS.md) untuk status per task (WBS 71 task, 8 milestone, bobot %).

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn-style components
- Supabase (PostgreSQL + Auth + Realtime + Storage)
- PWA via Serwist (rencana M1-T7)
- ESC/POS via Web Bluetooth (M8)

## Menjalankan

```bash
npm install
npm run dev
```

Environment (lihat `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Struktur

```
src/
  app/(pos)/      # dasbor kasir & operasional
  app/(portal)/   # portal pelanggan
  app/kiosk/      # self-order layar sentuh
  app/rider/      # halaman rider
  lib/            # core logic, utils, db
  components/     # UI reusable (Numpad, dll)
supabase/
  migrations/     # skema SQL + RLS
  seed.sql        # data awal
docs/PROGRESS.md  # tracker pekerjaan
```
