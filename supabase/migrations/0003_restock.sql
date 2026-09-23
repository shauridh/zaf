-- ============================================================
-- ChickenPOS — 0003: Restock saat refund
-- ============================================================

create or replace function restock_order(p_order_id uuid, p_actor uuid)
returns void language plpgsql set search_path = public, extensions as $$
declare
  v_item record;
  v_line record;
  v_delta numeric(12,3);
  v_new_qty numeric(12,3);
begin
  for v_item in
    select oi.id, oi.product_id, oi.qty
    from order_items oi where oi.order_id = p_order_id
  loop
    for v_line in
      select r.ingredient_id, r.qty_per_unit, r.option_delta
      from recipes r where r.product_id = v_item.product_id
    loop
      v_delta := v_line.qty_per_unit * v_item.qty
        + coalesce((
          select sum((d->>'qty_delta')::numeric * v_item.qty)
          from order_item_options oio,
               jsonb_array_elements(v_line.option_delta) d
          where oio.order_item_id = v_item.id
            and d->>'option_id' = oio.option_id::text
        ), 0);

      update ingredients
        set stock_qty = stock_qty + v_delta
        where id = v_line.ingredient_id
        returning stock_qty into v_new_qty;

      insert into stock_movements (ingredient_id, movement_type, qty_change, stock_after, reference_id, created_by)
      values (v_line.ingredient_id, 'adjustment', v_delta, v_new_qty, p_order_id, p_actor);
    end loop;
  end loop;
end $$;

revoke execute on function restock_order(uuid, uuid) from public, anon, authenticated;
grant execute on function restock_order(uuid, uuid) to service_role;
