-- ============================================================
-- ChickenPOS — 0006: Rating pelanggan & konteks portal
-- ============================================================

alter table orders add column if not exists rating smallint check (rating between 1 and 5);
alter table orders add column if not exists rating_note text;

-- Rating diisi pelanggan portal via RPC (server-side), bukan update langsung.
create or replace function portal_rate_order(p_order_id uuid, p_portal_customer uuid, p_rating smallint, p_note text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating harus 1-5';
  end if;
  update orders
    set rating = p_rating, rating_note = p_note
    where id = p_order_id and portal_customer_id = p_portal_customer;
end $$;

revoke execute on function portal_rate_order(uuid, uuid, smallint, text) from public, anon, authenticated;
grant execute on function portal_rate_order(uuid, uuid, smallint, text) to service_role;
