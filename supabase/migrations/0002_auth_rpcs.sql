-- ============================================================
-- ChickenPOS — 0002: RPC autentikasi (staf & portal)
-- PIN diverifikasi via pgcrypto crypt() — cocok dengan seed.
-- Semua fungsi security definer, hanya dieksekusi service_role.
-- ============================================================

-- portal_customers tertaut ke member loyalty (by phone)
alter table portal_customers
  add column if not exists member_id uuid references members(id);

-- ---------- Staf ----------
create or replace function staff_authenticate(p_id uuid, p_pin text)
returns table (id uuid, name text, role text)
language sql security definer set search_path = public, extensions as $$
  select p.id, p.name, p.role
  from profiles p
  where p.id = p_id and p.active and p.pin_hash = crypt(p_pin, p.pin_hash)
$$;

create or replace function staff_register(p_name text, p_role text, p_pin text)
returns uuid
language sql security definer set search_path = public, extensions as $$
  insert into profiles (name, role, pin_hash)
  values (p_name, p_role, crypt(p_pin, gen_salt('bf')))
  returning id
$$;

create or replace function staff_change_pin(p_id uuid, p_old text, p_new text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean;
begin
  select exists(
    select 1 from profiles where id = p_id and pin_hash = crypt(p_old, pin_hash)
  ) into ok;
  if ok then
    update profiles set pin_hash = crypt(p_new, gen_salt('bf')) where id = p_id;
  end if;
  return ok;
end $$;

-- ---------- Portal ----------
create or replace function portal_authenticate(p_phone text, p_pin text)
returns table (id uuid, name text, member_id uuid)
language sql security definer set search_path = public, extensions as $$
  select pc.id, pc.name, pc.member_id
  from portal_customers pc
  where pc.phone = p_phone and pc.pin_hash = crypt(p_pin, pc.pin_hash)
$$;

create or replace function portal_register(p_phone text, p_name text, p_pin text)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_member uuid;
  v_portal uuid;
begin
  insert into members (phone, name) values (p_phone, p_name)
  on conflict (phone) do update set name = coalesce(members.name, excluded.name)
  returning id into v_member;

  insert into portal_customers (phone, pin_hash, name, member_id)
  values (p_phone, crypt(p_pin, gen_salt('bf')), p_name, v_member)
  on conflict (phone) do update
    set pin_hash = crypt(p_pin, gen_salt('bf')), name = coalesce(excluded.name, portal_customers.name),
        member_id = v_member
  returning id into v_portal;

  return v_portal;
end $$;

-- ---------- Hak akses ----------
revoke execute on function next_order_number(uuid) from public, anon, authenticated;
revoke execute on function next_queue_number(uuid) from public, anon, authenticated;
revoke execute on function complete_order_and_deduct_stock(uuid) from public, anon, authenticated;
revoke execute on function staff_authenticate(uuid, text) from public, anon, authenticated;
revoke execute on function staff_register(text, text, text) from public, anon, authenticated;
revoke execute on function staff_change_pin(uuid, text, text) from public, anon, authenticated;
revoke execute on function portal_authenticate(text, text) from public, anon, authenticated;
revoke execute on function portal_register(text, text, text) from public, anon, authenticated;

grant execute on function next_order_number(uuid) to service_role;
grant execute on function next_queue_number(uuid) to service_role;
grant execute on function complete_order_and_deduct_stock(uuid) to service_role;
grant execute on function staff_authenticate(uuid, text) to service_role;
grant execute on function staff_register(text, text, text) to service_role;
grant execute on function staff_change_pin(uuid, text, text) to service_role;
grant execute on function portal_authenticate(text, text) to service_role;
grant execute on function portal_register(text, text, text) to service_role;

-- Storage: bucket privat untuk bukti transfer
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;
