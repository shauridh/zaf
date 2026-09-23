-- ============================================================
-- ChickenPOS — 0010: Satuan beli & konversi bahan baku
-- Bahan dibeli dalam satuan besar (mis. galon 19 L) namun
-- dipakai dalam satuan jual/resep (mis. ml).
--   cost_per_unit (satuan jual) = harga beli / conversion_factor
-- Jalankan di SQL Editor setelah 0001–0009.
-- ============================================================

alter table ingredients
  add column if not exists purchase_unit text;

alter table ingredients
  add column if not exists conversion_factor numeric(12,4) not null default 1
    check (conversion_factor > 0);

-- Backfill: satuan beli default = satuan jual, konversi 1.
update ingredients
set purchase_unit = unit
where purchase_unit is null;

comment on column ingredients.purchase_unit is 'Satuan saat membeli ke supplier (mis. galon, karung, pack).';
comment on column ingredients.conversion_factor is 'Berapa satuan jual dalam 1 satuan beli (1 galon = 19000 ml → 19000).';
