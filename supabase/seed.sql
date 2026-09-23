-- ============================================================
-- ChickenPOS — Seed data awal (idempotent)
-- Jalankan setelah SEMUA migrasi (0001–0007), sebelum 0008.
-- PIN staf contoh: 1234 — bcrypt pgcrypto (gen_salt('bf')),
-- kompatibel dengan crypt() di staff_authenticate. GANTI di produksi.
--
-- Skema ID tetap (12 karakter terakhir WAJIB hex 0-9a-f):
--   outlet 0001 · profil a1-a3 · kategori c1-c4 · grup opsi b1-b4
--   opsi e1-ea · produk d1-d8 · supplier f1-f2 · bahan 91-95 · promo eb
-- ============================================================

-- 1. Outlet + settings (float 350.000)
insert into outlets (id, name, address, phone)
values ('00000000-0000-0000-0000-000000000001', 'Gerai Pusat', 'Jl. Merdeka No. 1', '081234567890')
on conflict (id) do nothing;

insert into outlet_settings (outlet_id, tax_percent, service_charge_percent, opening_float, receipt_footer)
values ('00000000-0000-0000-0000-000000000001', 0, 0, 350000, 'Terima kasih telah berkunjung!')
on conflict (outlet_id) do nothing;

-- 2. Feature flags default (semua fitur bisa di-toggle dari Pengaturan)
insert into feature_flags (outlet_id, key, enabled) values
  ('00000000-0000-0000-0000-000000000001', 'loyalty', true),
  ('00000000-0000-0000-0000-000000000001', 'promotions', true),
  ('00000000-0000-0000-0000-000000000001', 'kiosk', false),
  ('00000000-0000-0000-0000-000000000001', 'queue_board', true),
  ('00000000-0000-0000-0000-000000000001', 'e_receipt', true),
  ('00000000-0000-0000-0000-000000000001', 'marketplace_channels', true),
  ('00000000-0000-0000-0000-000000000001', 'self_delivery', true),
  ('00000000-0000-0000-0000-000000000001', 'bluetooth_printer', true),
  ('00000000-0000-0000-0000-000000000001', 'sound_alerts', true),
  ('00000000-0000-0000-0000-000000000001', 'training_mode', true),
  ('00000000-0000-0000-0000-000000000001', 'customer_rating', true),
  ('00000000-0000-0000-0000-000000000001', 'pre_order', true),
  ('00000000-0000-0000-0000-000000000001', 'portal', true),
  ('00000000-0000-0000-0000-000000000001', 'inventory', true),
  ('00000000-0000-0000-0000-000000000001', 'finance', true)
on conflict (outlet_id, key) do nothing;

-- 3. Staf contoh — PIN 1234 (bcrypt pgcrypto, cocok dgn staff_authenticate).
-- GANTI PIN di produksi: select staff_change_pin('<id>', '1234', '<pin-baru>');
insert into profiles (id, name, role, pin_hash) values
  ('00000000-0000-0000-0000-0000000000a1', 'Owner', 'owner',
   '$2a$10$/ufyHyi3t/3Gxo67iXtpFucUntOGJguOMDUpqTbWu1AAeVcq/PNty'),
  ('00000000-0000-0000-0000-0000000000a2', 'Manager Toko', 'manager',
   '$2a$10$DIZwOnMz2uv6jbYHois3ZeQSyXzgd9VHAmWDAcBN2vBSsjrtztjj6'),
  ('00000000-0000-0000-0000-0000000000a3', 'Kasir 1', 'cashier',
   '$2a$10$npKMBmv9Ef/7XeT3QKIJPu3HuWt4OauEcoeK2UosaJCeF.bOtOwfy')
on conflict (id) do nothing;

-- 4. Kategori
insert into categories (id, name, sort_order) values
  ('00000000-0000-0000-0000-0000000000c1', 'Paket Hemat', 1),
  ('00000000-0000-0000-0000-0000000000c2', 'Ayam', 2),
  ('00000000-0000-0000-0000-0000000000c3', 'Sidedish', 3),
  ('00000000-0000-0000-0000-0000000000c4', 'Minuman', 4)
on conflict (id) do nothing;

-- 5. Grup opsi
insert into option_groups (id, name, input_type, is_required, min_select, max_select, sort_order) values
  ('00000000-0000-0000-0000-0000000000b1', 'Ukuran', 'single', true, 1, 1, 1),
  ('00000000-0000-0000-0000-0000000000b2', 'Level Pedas', 'single', true, 1, 1, 2),
  ('00000000-0000-0000-0000-0000000000b3', 'Topping', 'multi', false, 0, 5, 3),
  ('00000000-0000-0000-0000-0000000000b4', 'Es / Panas', 'single', true, 1, 1, 4)
on conflict (id) do nothing;

insert into options (id, group_id, name, price_delta, sort_order) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'Reguler', 0, 1),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b1', 'Jumbo', 10000, 2),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000b2', 'Original', 0, 1),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000b2', 'Pedas', 0, 2),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000b2', 'Geulis (Extra Pedas)', 0, 3),
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000b3', 'Extra Nasi', 5000, 1),
  ('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000b3', 'Extra Sambal', 2000, 2),
  ('00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-0000000000b3', 'Krupuk', 3000, 3),
  ('00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000b4', 'Panas', 0, 1),
  ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000b4', 'Es', 2000, 2)
on conflict (id) do nothing;

-- 6. Produk
insert into products (id, category_id, name, description, price, image_url, sort_order, track_stock) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Paket Ayam 1', 'Ayam + nasi + teh', 32000, '/products/paket-ayam-1.jpg', 1, true),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'Paket Ayam 2', 'Ayam + kentang + cola', 38000, '/products/paket-ayam-2.jpg', 2, true),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c2', 'Ayam Krispi', 'Potongan ayam krispi', 20000, '/products/ayam-krispi.jpg', 3, true),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c2', 'Ayam Geprek', 'Ayam krispi digeprek sambal', 23000, '/products/ayam-geprek.jpg', 4, true),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c3', 'Kentang Goreng', 'Kentang goreng gurih', 15000, '/products/kentang.jpg', 5, true),
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000c3', 'Tahu Krispi', 'Tahu goreng crispy', 10000, '/products/tahu.jpg', 6, true),
  ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000c4', 'Teh Manis', 'Teh melati manis', 8000, '/products/teh.jpg', 7, false),
  ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000c4', 'Cola', 'Soft drink', 9000, '/products/cola.jpg', 8, false)
on conflict (id) do nothing;

-- Opsi per produk
insert into product_option_groups (product_id, group_id, sort_order)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 1),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b2', 2),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b3', 3),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', 1),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b2', 2),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', 1),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b2', 2),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b3', 3),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b2', 1),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b3', 2),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b1', 1),
  ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000b4', 1),
  ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b4', 1)
on conflict do nothing;

-- 7. Supplier & bahan baku
insert into suppliers (id, name, contact_name, phone, lead_time_days) values
  ('00000000-0000-0000-0000-0000000000f1', 'PT Ayam Segar', 'Budi', '081298765432', 1),
  ('00000000-0000-0000-0000-0000000000f2', 'Tepung Makmur', 'Sari', '081377712345', 3)
on conflict (id) do nothing;

insert into ingredients (id, name, unit, stock_qty, min_stock_qty, cost_per_unit, supplier_id) values
  ('00000000-0000-0000-0000-000000000091', 'Ayam Fillet', 'gr', 25000, 5000, 45, '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-000000000092', 'Tepung Bumbu', 'gr', 10000, 2000, 12, '00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-000000000093', 'Minyak Goreng', 'ml', 20000, 5000, 14, '00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-000000000094', 'Beras/Nasi', 'gr', 15000, 3000, 8, '00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-000000000095', 'Sambal', 'gr', 3000, 500, 20, '00000000-0000-0000-0000-0000000000f2')
on conflict (id) do nothing;

-- 8. Resep BOM (delta opsi: Extra Nasi +150gr beras, Extra Sambal +30gr)
insert into recipes (product_id, ingredient_id, qty_per_unit, option_delta) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000091', 250,
   '[{"option_id":"00000000-0000-0000-0000-0000000000e6","qty_delta":0}]'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000092', 60, '[]'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000093', 40, '[]'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000094', 200,
   '[{"option_id":"00000000-0000-0000-0000-0000000000e6","qty_delta":150}]'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000095', 30,
   '[{"option_id":"00000000-0000-0000-0000-0000000000e7","qty_delta":30}]'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000091', 200, '[]'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000092', 50, '[]'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000093', 35, '[]')
on conflict (product_id, ingredient_id) do nothing;

-- 9. Promo contoh
insert into promotions (id, name, type, code, value_percent, min_spend, start_at, end_at) values
  ('00000000-0000-0000-0000-0000000000eb', 'Promo Buka Puasa', 'voucher', 'BUKA20', 20, 50000,
   '2026-01-01', '2026-12-31')
on conflict (id) do nothing;

-- 10. Rider internal contoh (guard manual — riders tanpa unique constraint)
insert into riders (name, phone)
select 'Andi Rider', '081200011122'
where not exists (select 1 from riders where name = 'Andi Rider');
