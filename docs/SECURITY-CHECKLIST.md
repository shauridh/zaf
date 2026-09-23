# 🔐 ChickenPOS — Checklist Keamanan (M8-T6)

Terakhir diaudit: 2026-09-21 (build 0.1.0)

## 1. Autentikasi & Sesi

| # | Kontrol | Status | Lokasi |
|---|---|---|---|
| 1.1 | PIN staf di-hash (pgcrypto `crypt`) di DB — tidak pernah plaintext | ✅ | `0002_auth_rpcs.sql` |
| 1.2 | PIN portal terpisah dari staf (tabel & RPC sendiri) | ✅ | `portal_authenticate` |
| 1.3 | Sesi = JWT HS256 httpOnly cookie, TTL 12 jam | ✅ | `src/lib/auth/jwt.ts`, `session.ts` |
| 1.4 | Middleware guard semua route `(pos)` + kick tanpa sesi | ✅ | `src/middleware.ts` |
| 1.5 | Rate limit login di server action + lockout DB 5 kali/15 menit | ✅ | `auth.ts`, `0007_hardening.sql` |
| 1.6 | 2FA TOTP opsional khusus owner + step-up aksi sensitif | ✅ | `0007_hardening.sql`, `security.ts` |
| 1.7 | Secret 2FA tidak pernah dikirim ke klien setelah enroll | ✅ | `security.ts` |

## 2. Otorisasi & RLS

| # | Kontrol | Status | Catatan |
|---|---|---|---|
| 2.1 | RLS aktif di seluruh 31+ tabel | ✅ | `0001_init_schema.sql` |
| 2.2 | Policy per role (cashier terbatas, manager/owner penuh) | ✅ | 54+ policy |
| 2.3 | JWT claim `role: authenticated` + custom claim id → `auth.uid()` match | ✅ | `jwt.ts` |
| 2.4 | Service role key hanya di server (`server-only` guard) | ✅ | `admin.ts` |
| 2.5 | Tabel `security_events` & `auth_attempts` hanya service_role | ✅ | grant eksplisit |

**Cara audit cepat (SQL editor):**
```sql
-- Semua tabel harus rowsecurity = true
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;

-- Tidak boleh ada policy anon yang permissive
select tablename, policyname, cmd, qual from pg_policies
where schemaname = 'public' and roles @> '{anon}' and qual like '%true%';
```

## 3. Operasional Aman

| # | Kontrol | Status | Catatan |
|---|---|---|---|
| 3.1 | Refund/void wajib approval manager/owner (PIN kedua) | ✅ | `refund.ts` |
| 3.2 | Audit log untuk refund, tutup shift, ubah flags/settings | ✅ | `audit_logs` |
| 3.3 | Anti dobel-submit checkout (RPC atomik + idempotency) | ✅ | `checkout.ts` |
| 3.4 | Nominal uang integer rupiah (tanpa float) | ✅ | seluruh skema |
| 3.5 | Upload bukti transfer ke bucket privat | ✅ | `portal.ts` |

## 4. Klien & Transport

| # | Kontrol | Status | Catatan |
|---|---|---|---|
| 4.1 | Cookie `secure` di produksi, `sameSite=lax` | ✅ | `session.ts` |
| 4.2 | `poweredByHeader: false`, strict TS/ESLint di build | ✅ | `next.config.ts` |
| 4.3 | Service worker hanya cache aset publik, tidak cache API mutasi | ✅ | `sw.ts` |
| 4.4 | URL bukti transfer via signed URL berbatas waktu | ✅ | `portal.ts` |

## 5. Yang Perlu Dilakukan Saat Go-Live

- [ ] Isi `SUPABASE_JWT_SECRET` & service role di env produksi (jangan commit `.env.local`)
- [ ] Rotasi PIN default staf hasil seed sebelum operasional
- [ ] Aktifkan 2FA owner (Pengaturan → Keamanan)
- [ ] Pasca-generate kredensial Lalamove/PandaGo, uji quote→booking dengan alamat nyata
- [ ] Jadwalkan backup harian (lihat `docs/` bagian backup) & uji restore
- [ ] Audit RLS ulang setiap menambah tabel (checklist 2.x di atas)
