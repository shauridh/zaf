-- ============================================================
-- ChickenPOS — 0008: Smoke check setup (M8 QA)
--
-- URUTAN WAJIB: 0001–0007 → seed.sql → file ini TERAKHIR
-- (cek 5–10 memverifikasi isi seed; sebelum seed akan FAIL — itu memang tanda setup belum lengkap).
--
-- Cara pakai:
--   1. Jalankan file ini → langsung mencetak verdict PASS/FAIL per cek.
--   2. Untuk cek ulang kapan pun:
--        select * from run_setup_smoke_check();
--   3. Ringkasan satu baris:
--        select bool_and(passed) as all_pass from run_setup_smoke_check();
--
-- Catatan desain:
--   - Read-only terhadap data bisnis; TIDAK memanggil staff_authenticate
--     agar counter auth_attempts (anti brute-force) tidak ikut terisi.
--     Verifikasi PIN dilakukan langsung via crypt().
--   - Idempotent: aman dijalankan berulang.
-- ------------------------------------------------------------

-- Hardening kecil: auth_attempts (tabel lockout) wajib ber-RLS.
-- Tanpa policy = deny semua; hanya diakses fungsi security definer.
alter table auth_attempts enable row level security;

create or replace function run_setup_smoke_check()
returns table (check_name text, passed boolean, detail text)
language plpgsql
set search_path = public, extensions
as $$
begin
  return query
  -- 1. Semua tabel publik ber-RLS
  with rls as (
    select bool_and(rowsecurity) as all_rls, count(*) as n
    from pg_tables where schemaname = 'public'
  )
  select
    'rls_all_tables'::text,
    coalesce(r.all_rls, false),
    r.n::text || ' tabel publik; semua rowsecurity=' || coalesce(r.all_rls::text, 'NULL')
  from rls r

  union all

  -- 2. Fungsi auth inti ada
  select
    'auth_functions_exist'::text,
    (count(*) = 6),
    count(*)::text || '/6: staff_authenticate, staff_register, staff_change_pin, portal_authenticate, portal_register, portal_rate_order'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'staff_authenticate','staff_register','staff_change_pin',
      'portal_authenticate','portal_register','portal_rate_order'
    )

  union all

  -- 3. Fungsi operasional ada
  select
    'ops_functions_exist'::text,
    (count(*) = 5),
    count(*)::text || '/5: next_order_number, next_queue_number, complete_order_and_deduct_stock, restock_order, increment_member_points'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'next_order_number','next_queue_number','complete_order_and_deduct_stock',
      'restock_order','increment_member_points'
    )

  union all

  -- 4. Tidak ada policy anon yang permissive
  select
    'no_permissive_anon_policy'::text,
    (count(*) = 0),
    count(*)::text || ' policy anon permissive (harus 0)'
  from pg_policies
  where schemaname = 'public'
    and roles @> '{anon}'
    and coalesce(qual, '') in ('true', '(true)')

  union all

  -- 5. Seed inti: outlet, settings float 350rb, >=3 staf
  select
    'seed_core'::text,
    coalesce((select count(*) = 1 from outlets), false)
      and coalesce((select opening_float = 350000 from outlet_settings limit 1), false)
      and (select count(*) from profiles) >= 3,
    'outlets=' || (select count(*) from outlets)
      || ', float=' || coalesce((select opening_float::text from outlet_settings limit 1), 'NULL')
      || ', profiles=' || (select count(*) from profiles)

  union all

  -- 6. Seed katalog: kategori, produk, grup opsi
  select
    'seed_catalog'::text,
    (select count(*) from categories) >= 4
      and (select count(*) from products) >= 8
      and (select count(*) from option_groups) >= 4,
    'categories=' || (select count(*) from categories)
      || ', products=' || (select count(*) from products)
      || ', option_groups=' || (select count(*) from option_groups)

  union all

  -- 7. Seed persediaan: bahan + resep BOM
  select
    'seed_inventory'::text,
    (select count(*) from ingredients) >= 5
      and (select count(*) from recipes) >= 8,
    'ingredients=' || (select count(*) from ingredients)
      || ', recipes=' || (select count(*) from recipes)

  union all

  -- 8. Kredensial valid: hash bcrypt format pgcrypto DAN PIN 1234 cocok
  --    utk owner aktif (verifikasi crypt() langsung, tanpa rate limiter)
  select
    'staff_pin_1234_valid'::text,
    coalesce((
      select count(*) = 1
      from profiles
      where role = 'owner' and active
        and pin_hash like '$2%'
        and pin_hash = crypt('1234', pin_hash)
    ), false),
    'PIN 1234 cocok utk Owner; pin_hash berformat bcrypt ($2a/$2b)'

  union all

  -- 9. Staf aktif ADA (>=1), semua ber-hash bcrypt, & PIN salah tidak cocok
  --    (wajib non-vacuous: 0 staf = FAIL, bukan lolos otomatis)
  select
    'staff_hash_format_ok'::text,
    coalesce((
      select count(*) >= 1
         and count(*) = count(*) filter (where pin_hash like '$2%')
      from profiles where active
    ), false)
      and coalesce((
        select count(*) = 0
        from profiles
        where active and pin_hash = crypt('9999', pin_hash)
      ), false),
    'staf aktif=' || (select count(*) from profiles where active)
      || '; semua bcrypt valid; PIN 9999 ditolak'

  union all

  -- 10. Feature flags ter-seed & modul inti aktif
  select
    'seed_feature_flags'::text,
    (select count(*) from feature_flags) >= 15
      and coalesce((select bool_or(enabled) from feature_flags where key = 'loyalty'), false)
      and coalesce((select bool_or(enabled) from feature_flags where key = 'inventory'), false),
    'flags=' || (select count(*) from feature_flags)
      || '; loyalty & inventory aktif';
end $$;

-- Diagnostik internal: hanya owner DB & service role
revoke execute on function run_setup_smoke_check() from public, anon, authenticated;

-- Eksekusi langsung saat file dijalankan
select * from run_setup_smoke_check();
