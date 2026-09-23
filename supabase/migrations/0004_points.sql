-- ============================================================
-- ChickenPOS — 0004: Poin loyalty
-- ============================================================

create or replace function increment_member_points(p_member uuid, p_points integer)
returns void language sql security definer set search_path = public, extensions as $$
  update members set points = points + p_points where id = p_member;
$$;

revoke execute on function increment_member_points(uuid, integer) from public, anon, authenticated;
grant execute on function increment_member_points(uuid, integer) to service_role;
