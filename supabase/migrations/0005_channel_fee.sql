-- ============================================================
-- ChickenPOS — 0005: Channel fee & referensi eksternal
-- ============================================================

alter table orders add column if not exists channel_fee integer not null default 0;
alter table orders add column if not exists external_ref text;
