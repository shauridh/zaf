-- ============================================================
-- ChickenPOS — 0009: Snapshot items (jsonb) di orders
-- ============================================================
-- Kode aplikasi (KDS, held orders, portal, checkout) membaca/menulis
-- snapshot `items` jsonb di tabel orders — kolom ini belum ada di 0001.
-- Tabel normalisasi (order_items + order_item_options) tetap ada dan
-- tetap ditulis checkout; snapshot ini untuk baca cepat KDS/portal.
-- ============================================================

alter table orders add column if not exists items jsonb not null default '[]'::jsonb;

-- Backfill dari tabel normalisasi (idempotent: selalu regenerasi)
-- Catatan: UPDATE ... FROM tidak memakai ON — kondisi gabungan di WHERE.
update orders o
set items = sub.items
from (
  select
    oi.order_id,
    jsonb_agg(
      jsonb_build_object(
        'product_id', oi.product_id,
        'name', oi.name,
        'qty', oi.qty,
        'unit_price', oi.unit_price,
        'subtotal', oi.subtotal,
        'discount', oi.discount,
        'note', oi.note,
        'options', coalesce(opt.opts, '[]'::jsonb)
      )
      order by oi.id
    ) as items
  from order_items oi
  left join (
    select
      oio.order_item_id,
      jsonb_agg(
        jsonb_build_object(
          'option_id', oio.option_id,
          'option_group_id', oio.option_group_id,
          'group_name', oio.group_name,
          'name', oio.name,
          'price_delta', oio.price_delta
        )
        order by oio.id
      ) as opts
    from order_item_options oio
    group by oio.order_item_id
  ) opt on opt.order_item_id = oi.id
  group by oi.order_id
) sub
where sub.order_id = o.id;
