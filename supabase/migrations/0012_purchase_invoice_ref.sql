-- ============================================================
-- ChickenPOS — 0012: No. invoice/keterangan pada pembelian
-- Jalankan di SQL Editor setelah 0001–0011.
-- ============================================================

alter table purchases add column if not exists invoice_ref text;
