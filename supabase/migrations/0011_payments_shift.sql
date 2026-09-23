-- ============================================================
-- ChickenPOS — 0011: Pembayaran terikat shift laci kas
-- Setiap pembayaran final menempel ke shift tempat uang diterima,
-- sehingga rekonsiliasi laci memakai shift_id (eksak), bukan lagi
-- menebak dari rentang waktu buka–tutup.
--
--   * checkout menolak order bila laci belum dibuka (server-side)
--   * payments.shift_id = shift penerima uang
--
-- Jalankan di SQL Editor setelah 0001–0010. Idempotent.
-- ============================================================

alter table payments
  add column if not exists shift_id uuid references shifts(id) on delete set null;

create index if not exists payments_shift_id_idx on payments (shift_id);

comment on column payments.shift_id is
  'Shift laci kas penerima pembayaran. NULL = uang masuk di luar shift (legacy pra-0011 / replay offline).';

-- ------------------------------------------------------------
-- Backfill pembayaran final lama: tempelkan ke shift yang rentang
-- waktunya memuat created_at (shift terbaru bila ada overlap).
-- ------------------------------------------------------------
update payments p
set shift_id = m.shift_id
from (
  select distinct on (p2.id) p2.id as payment_id, s.id as shift_id
  from payments p2
  join orders o on o.id = p2.order_id
  join shifts s
    on s.outlet_id = o.outlet_id
   and p2.created_at >= s.opened_at
   and p2.created_at <= coalesce(s.closed_at, now())
  where p2.shift_id is null
    and p2.kind = 'final'
  order by p2.id, s.opened_at desc
) m
where p.id = m.payment_id;

-- ------------------------------------------------------------
-- Verifikasi cepat (opsional):
--   select count(*) filter (where shift_id is null) as tanpa_shift,
--          count(*) as total from payments where kind = 'final';
-- ------------------------------------------------------------
