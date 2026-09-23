-- ============================================================
-- ChickenPOS — 0007: Hardening (M8-T6)
-- ============================================================

-- ------------------------------------------------------------
-- 1. 2FA step-up (faktor kedua) untuk owner
--    - twofa_secret format: "totp:<base32secret>" (tanpa kredensial = fitur mati)
--    - Verifikasi & enroll dilakukan server-side (TOTP 6 digit, window ±1)
-- ------------------------------------------------------------
alter table profiles add column if not exists twofa_enabled boolean not null default false;
alter table profiles add column if not exists twofa_secret text;

create table if not exists security_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  kind text not null,               -- twofa_enabled | twofa_disabled | stepup_ok | stepup_failed
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table security_events enable row level security;

-- ------------------------------------------------------------
-- 2. Rate limit DB utk autentikasi PIN (anti brute-force)
--    dipakai oleh staff_authenticate & portal_authenticate
-- ------------------------------------------------------------
create table if not exists auth_attempts (
  key text primary key,             -- "staff:<id>" | "portal:<phone>" | "ip:<ip>"
  failures integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function auth_check_locked(p_key text)
returns boolean
language sql security definer set search_path = public, extensions as $$
  select coalesce(locked_until > now(), false) from auth_attempts where key = p_key;
$$;

create or replace function auth_record_failure(p_key text, p_max int default 5, p_lock_min int default 15)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  f int;
begin
  insert into auth_attempts(key, failures) values (p_key, 1)
  on conflict (key) do update set
    failures = auth_attempts.failures + 1,
    updated_at = now();
  select failures into f from auth_attempts where key = p_key;
  if f >= p_max then
    update auth_attempts
    set locked_until = now() + make_interval(mins => p_lock_min)
    where key = p_key;
  end if;
end $$;

create or replace function auth_reset(p_key text)
returns void
language sql security definer set search_path = public, extensions as $$
  delete from auth_attempts where key = p_key;
$$;

revoke all on function auth_check_locked(text) from public, anon, authenticated;
revoke all on function auth_record_failure(text, int, int) from public, anon, authenticated;
revoke all on function auth_reset(text) from public, anon, authenticated;
grant execute on function auth_check_locked(text) to service_role;
grant execute on function auth_record_failure(text, int, int) to service_role;
grant execute on function auth_reset(text) to service_role;

-- Identik dengan definisi di 0001 (basis JWT sub), didefinisikan ulang agar idempotent.
create or replace function is_manager_or_above()
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from profiles p
    where p.id::text = coalesce(auth.jwt()->>'sub', '')
      and p.active
      and p.role in ('owner','manager')
  );
$$;

create policy staff_read_security_events on security_events
  for select to authenticated using (is_manager_or_above());

-- ------------------------------------------------------------
-- 3. Integrasi rate-limit ke staff_authenticate (idempotent)
-- ------------------------------------------------------------
create or replace function staff_authenticate(p_id uuid, p_pin text)
returns table (id uuid, name text, role text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_locked boolean;
  v_profile profiles;
begin
  v_locked := auth_check_locked('staff:' || p_id::text);
  if v_locked then
    raise exception 'AUTH_LOCKED';
  end if;

  select * into v_profile from profiles where profiles.id = p_id and profiles.active for update;
  if v_profile is null or v_profile.pin_hash <> crypt(p_pin, v_profile.pin_hash) then
    perform auth_record_failure('staff:' || p_id::text);
    raise exception 'AUTH_FAILED';
  end if;

  perform auth_reset('staff:' || p_id::text);
  return query select v_profile.id, v_profile.name, v_profile.role;
end $$;

revoke all on function staff_authenticate(uuid, text) from public, anon, authenticated;
grant execute on function staff_authenticate(uuid, text) to service_role;

-- ------------------------------------------------------------
-- 4. Catatan checklist (dijalankan via SQL editor saat audit):
--    - select tablename, rowsecurity from pg_tables where schemaname='public';
--      → semua tabel harus rowsecurity = true
--    - verifikasi tidak ada policy "using (true)" utk role anon
--    - keyset real on portal_authenticate sudah aktif via auth_attempts
-- ------------------------------------------------------------
