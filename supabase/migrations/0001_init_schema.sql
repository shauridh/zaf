-- ============================================================
-- ChickenPOS — Skema awal (0001)
-- Uang = integer rupiah. Waktu = timestamptz (UTC).
-- Business date dihitung di aplikasi (Asia/Jakarta) dan dikirim
-- sebagai parameter date ke RPC terkait.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 1. OUTLET & STAF
-- ------------------------------------------------------------
create table outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('owner','manager','cashier')),
  pin_hash text not null,           -- scrypt: salt:hash hex
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table outlet_settings (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  tax_percent numeric(5,2) not null default 0,
  service_charge_percent numeric(5,2) not null default 0,
  opening_float integer not null default 350000,   -- modal laci default
  receipt_footer text,
  delivery_fee_flat integer not null default 0,
  delivery_fee_per_km integer not null default 0,
  delivery_radius_km numeric(5,1) not null default 8.0,
  payment_methods text[] not null default '{cash,qris,debit,transfer}',
  updated_at timestamptz not null default now()
);

create table feature_flags (
  outlet_id uuid not null references outlets(id) on delete cascade,
  key text not null,
  enabled boolean not null default true,
  primary key (outlet_id, key)
);

-- ------------------------------------------------------------
-- 2. KATALOG
-- ------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table option_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  input_type text not null default 'single' check (input_type in ('single','multi')),
  is_required boolean not null default false,
  min_select integer not null default 0,
  max_select integer,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references option_groups(id) on delete cascade,
  name text not null,
  price_delta integer not null default 0,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  name text not null,
  description text,
  price integer not null check (price >= 0),
  image_url text,
  is_active boolean not null default true,
  track_stock boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table product_option_groups (
  product_id uuid not null references products(id) on delete cascade,
  group_id uuid not null references option_groups(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, group_id)
);

-- ------------------------------------------------------------
-- 3. PERSEDIAAN & BOM
-- ------------------------------------------------------------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  lead_time_days integer not null default 1,
  active boolean not null default true
);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  stock_qty numeric(12,3) not null default 0,
  min_stock_qty numeric(12,3) not null default 0,
  cost_per_unit numeric(12,4) not null default 0,  -- moving average
  supplier_id uuid references suppliers(id),
  barcode text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table recipes (
  product_id uuid not null references products(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  qty_per_unit numeric(12,3) not null,
  option_delta jsonb not null default '[]',  -- [{option_id, qty_delta}]
  primary key (product_id, ingredient_id)
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id),
  total integer not null default 0,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  qty numeric(12,3) not null,
  unit_cost integer not null,
  subtotal integer not null
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id),
  movement_type text not null check (movement_type in ('sale','purchase','adjustment','waste')),
  qty_change numeric(12,3) not null,
  stock_after numeric(12,3) not null,
  reference_id uuid,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. ORDER & PEMBAYARAN
-- ------------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id),
  order_number integer not null,
  channel text not null check (channel in (
    'dine_in','takeaway','delivery','gofood','grabfood','shopeefood',
    'self_delivery','pickup','kiosk')),
  status text not null default 'held' check (status in (
    'held','unpaid','confirmed','preparing','ready','completed','cancelled','refunded')),
  training boolean not null default false,
  customer_name text,
  customer_phone text,
  portal_customer_id uuid,
  table_label text,
  queue_number integer,
  scheduled_at timestamptz,          -- pre-order
  note text,
  address text,
  subtotal integer not null default 0,
  order_discount integer not null default 0,
  promo_id uuid,
  promo_discount integer not null default 0,
  delivery_fee integer not null default 0,
  tax integer not null default 0,
  service_charge integer not null default 0,
  total integer not null default 0,
  total_paid integer not null default 0,
  change_due integer not null default 0,
  points_earned integer not null default 0,
  points_redeemed integer not null default 0,
  created_by uuid references profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  name text not null,
  qty integer not null check (qty > 0),
  unit_price integer not null,
  subtotal integer not null,
  discount integer not null default 0,
  note text
);

create table order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  option_id uuid not null references options(id),
  option_group_id uuid not null references option_groups(id),
  name text not null,               -- snapshot
  group_name text not null,         -- snapshot
  price_delta integer not null
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method text not null check (method in ('cash','qris','debit','transfer')),
  kind text not null default 'final' check (kind in ('deposit','final')),
  amount integer not null check (amount > 0),
  reference text,
  proof_url text,                   -- bukti transfer portal (private storage)
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  amount integer not null check (amount > 0),
  reason text not null,
  restock boolean not null default false,
  approved_by uuid not null references profiles(id),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. KAS & SHIFT
-- ------------------------------------------------------------
create table shifts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id),
  opened_by uuid not null references profiles(id),
  closed_by uuid references profiles(id),
  opening_cash integer not null,
  expected_cash numeric(14,2) not null default 0,
  counted_cash numeric(14,2),
  variance numeric(14,2),
  status text not null default 'open' check (status in ('open','closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts(id) on delete cascade,
  kind text not null check (kind in ('pay_in','pay_out','cash_drop')),
  amount integer not null check (amount > 0),
  note text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. LOYALTY, PROMO, PORTAL
-- ------------------------------------------------------------
create table members (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  points integer not null default 0,
  birth_date date,
  created_at timestamptz not null default now()
);

create table point_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  order_id uuid references orders(id),
  points_change integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('voucher','bundle','happy_hour','bogo')),
  code text unique,
  value_percent numeric(5,2),
  value_amount integer,
  min_spend integer not null default 0,
  bundle_product_ids uuid[],
  buy_qty integer,
  get_qty integer,
  start_at timestamptz,
  end_at timestamptz,
  days_of_week integer[],
  start_time text,
  end_time text,
  active boolean not null default true
);

create table portal_customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  pin_hash text not null,
  name text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. DELIVERY
-- ------------------------------------------------------------
create table riders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  active boolean not null default true
);

create table delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null default 'internal' check (provider in ('internal','pandago','lalamove')),
  status text not null default 'pending' check (status in (
    'pending','assigned','picked_up','delivered','failed','cancelled')),
  rider_id uuid references riders(id),
  fee integer not null default 0,
  tracking_url text,
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 8. KEUANGAN & AUDIT
-- ------------------------------------------------------------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id),
  category text not null,
  amount integer not null check (amount > 0),
  note text,
  spent_at date not null default current_date,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table marketplace_settlements (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id),
  channel text not null check (channel in ('gofood','grabfood','shopeefood')),
  period_start date not null,
  period_end date not null,
  gross_sales integer not null default 0,
  commission integer not null default 0,
  promo_co_funding integer not null default 0,
  other_fees integer not null default 0,
  net_transfer integer not null default 0,
  matched boolean not null default false,
  note text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEKS
-- ============================================================
create index idx_products_category on products(category_id) where is_active;
create index idx_orders_outlet_created on orders(outlet_id, created_at desc);
create index idx_orders_status on orders(status) where status in ('held','unpaid','confirmed','preparing','ready');
create index idx_orders_channel on orders(channel, created_at desc);
create index idx_order_items_order on order_items(order_id);
create index idx_payments_order on payments(order_id);
create index idx_stock_movements_ing on stock_movements(ingredient_id, created_at desc);
create index idx_cash_movements_shift on cash_movements(shift_id);
create index idx_point_tx_member on point_transactions(member_id, created_at desc);
create index idx_delivery_jobs_order on delivery_jobs(order_id);
create index idx_expenses_outlet_date on expenses(outlet_id, spent_at);

-- ============================================================
-- FUNGSI & TRIGGER
-- ============================================================

-- Nomor order harian per outlet (reset tiap hari, aman konkurensi)
create or replace function next_order_number(p_outlet uuid)
returns integer language plpgsql set search_path = public, extensions as $$
declare v_num integer;
begin
  select coalesce(max(order_number), 0) + 1 into v_num
  from orders
  where outlet_id = p_outlet
    and created_at >= date_trunc('day', now() at time zone 'Asia/Jakarta')
      at time zone 'Asia/Jakarta';
  return v_num;
end $$;

-- Nomor antrean harian per outlet
create or replace function next_queue_number(p_outlet uuid)
returns integer language plpgsql set search_path = public, extensions as $$
declare v_num integer;
begin
  select coalesce(max(queue_number), 0) + 1 into v_num
  from orders
  where outlet_id = p_outlet
    and queue_number is not null
    and created_at >= date_trunc('day', now() at time zone 'Asia/Jakarta')
      at time zone 'Asia/Jakarta';
  return v_num;
end $$;

-- Auto-deduct stok saat order completed (dipanggil dalam transaksi)
create or replace function complete_order_and_deduct_stock(p_order_id uuid)
returns void language plpgsql set search_path = public, extensions as $$
declare
  v_item record;
  v_line record;
  v_delta numeric(12,3);
  v_new_qty numeric(12,3);
  v_staff uuid;
begin
  select created_by into v_staff from orders where id = p_order_id;

  for v_item in
    select oi.product_id, oi.qty, oi.id
    from order_items oi where oi.order_id = p_order_id
  loop
    for v_line in
      select r.ingredient_id, r.qty_per_unit, r.option_delta
      from recipes r where r.product_id = v_item.product_id
    loop
      v_delta := v_line.qty_per_unit * v_item.qty;

      -- delta topping: tiap opsi terpilih menambah konsumsi bahan
      v_delta := v_delta + coalesce((
        select sum((d->>'qty_delta')::numeric * v_item.qty)
        from order_item_options oio,
             jsonb_array_elements(v_line.option_delta) d
        where oio.order_item_id = v_item.id
          and d->>'option_id' = oio.option_id::text
      ), 0);

      update ingredients
        set stock_qty = stock_qty - v_delta
        where id = v_line.ingredient_id
        returning stock_qty into v_new_qty;

      insert into stock_movements (ingredient_id, movement_type, qty_change, stock_after, reference_id, created_by)
      values (v_line.ingredient_id, 'sale', -v_delta, v_new_qty, p_order_id, v_staff);
    end loop;
  end loop;

  update orders set status = 'completed', completed_at = now(), updated_at = now()
  where id = p_order_id;
end $$;

-- Trigger updated_at
create or replace function touch_updated_at()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated before update on orders
  for each row execute function touch_updated_at();
drop trigger if exists trg_delivery_jobs_updated on delivery_jobs;
create trigger trg_delivery_jobs_updated before update on delivery_jobs
  for each row execute function touch_updated_at();

-- ============================================================
-- RLS — aktif di semua tabel
-- Kebijakan: staf terautentikasi (JWT auth.uid() ada di profiles)
-- ============================================================
alter table outlets enable row level security;
alter table profiles enable row level security;
alter table outlet_settings enable row level security;
alter table feature_flags enable row level security;
alter table categories enable row level security;
alter table option_groups enable row level security;
alter table options enable row level security;
alter table products enable row level security;
alter table product_option_groups enable row level security;
alter table suppliers enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table stock_movements enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_options enable row level security;
alter table payments enable row level security;
alter table refunds enable row level security;
alter table shifts enable row level security;
alter table cash_movements enable row level security;
alter table members enable row level security;
alter table point_transactions enable row level security;
alter table promotions enable row level security;
alter table portal_customers enable row level security;
alter table riders enable row level security;
alter table delivery_jobs enable row level security;
alter table expenses enable row level security;
alter table marketplace_settlements enable row level security;
alter table audit_logs enable row level security;

-- Helper: apakah JWT saat ini staf yang aktif?
create or replace function is_active_staff()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from profiles p
    where p.id::text = coalesce(auth.jwt()->>'sub', '')
      and p.active
  );
$$;

-- Helper: staf dengan role manager/owner?
create or replace function is_manager_or_above()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from profiles p
    where p.id::text = coalesce(auth.jwt()->>'sub', '')
      and p.active
      and p.role in ('owner','manager')
  );
$$;

-- Katalog & master: staff read; manager+ write
create policy staff_read_all_outlets on outlets
  for select to authenticated using (true);
create policy staff_read_profiles on profiles
  for select to authenticated using (true);
create policy manager_write_profiles on profiles
  for all to authenticated using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_settings on outlet_settings
  for select to authenticated using (true);
create policy manager_write_settings on outlet_settings
  for all to authenticated using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_flags on feature_flags
  for select to authenticated using (true);
create policy manager_write_flags on feature_flags
  for all to authenticated using (is_manager_or_above()) with check (is_manager_or_above());

create policy staff_read_catalog on categories for select to authenticated using (true);
create policy manager_write_catalog on categories for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_catalog on option_groups for select to authenticated using (true);
create policy manager_write_catalog on option_groups for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_catalog on options for select to authenticated using (true);
create policy manager_write_catalog on options for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_catalog on products for select to authenticated using (true);
create policy manager_write_catalog on products for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_catalog on product_option_groups for select to authenticated using (true);
create policy manager_write_catalog on product_option_groups for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());

-- Transaksi: semua staf aktif boleh baca/tulis
create policy staff_all_orders on orders for all to authenticated
  using (is_active_staff()) with check (is_active_staff());
create policy staff_all_order_items on order_items for all to authenticated
  using (is_active_staff()) with check (is_active_staff());
create policy staff_all_order_item_options on order_item_options for all to authenticated
  using (is_active_staff()) with check (is_active_staff());
create policy staff_all_payments on payments for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- Refund hanya manager+
create policy manager_all_refunds on refunds for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());

-- Kas & shift: staf tulis, tanpa delete (audit trail)
create policy staff_read_shifts on shifts for select to authenticated using (true);
create policy staff_insert_shifts on shifts for insert to authenticated with check (is_active_staff());
create policy staff_update_shifts on shifts for update to authenticated using (is_active_staff());
create policy staff_read_cash_movements on cash_movements for select to authenticated using (true);
create policy staff_insert_cash_movements on cash_movements for insert to authenticated
  with check (is_active_staff());

-- Persediaan: staf baca, manager+ tulis
create policy staff_read_inventory on ingredients for select to authenticated using (true);
create policy manager_write_inventory on ingredients for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_suppliers on suppliers for select to authenticated using (true);
create policy manager_write_suppliers on suppliers for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_recipes on recipes for select to authenticated using (true);
create policy manager_write_recipes on recipes for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_purchases on purchases for select to authenticated using (true);
create policy manager_write_purchases on purchases for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_purchase_items on purchase_items for select to authenticated using (true);
create policy manager_write_purchase_items on purchase_items for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_stock_movements on stock_movements for select to authenticated using (true);
create policy staff_insert_stock_movements on stock_movements for insert to authenticated
  with check (is_active_staff());

-- Loyalty & promo
create policy staff_read_members on members for select to authenticated using (true);
create policy staff_write_members on members for all to authenticated
  using (is_active_staff()) with check (is_active_staff());
create policy staff_read_point_tx on point_transactions for select to authenticated using (true);
create policy staff_insert_point_tx on point_transactions for insert to authenticated
  with check (is_active_staff());
create policy staff_read_promotions on promotions for select to authenticated using (true);
create policy manager_write_promotions on promotions for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());

-- Portal customers: hanya service role (server) — tanpa policy = deny all utk anon/auth
-- (dikelola via RPC server-side dengan service key)

-- Delivery
create policy staff_read_riders on riders for select to authenticated using (true);
create policy manager_write_riders on riders for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_all_delivery_jobs on delivery_jobs for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- Keuangan: baca semua staf, tulis manager+
create policy staff_read_expenses on expenses for select to authenticated using (true);
create policy manager_write_expenses on expenses for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());
create policy staff_read_settlements on marketplace_settlements for select to authenticated using (true);
create policy manager_write_settlements on marketplace_settlements for all to authenticated
  using (is_manager_or_above()) with check (is_manager_or_above());

-- Audit: read manager+, insert sistem/staf
create policy manager_read_audit on audit_logs for select to authenticated using (is_manager_or_above());
create policy staff_insert_audit on audit_logs for insert to authenticated with check (is_active_staff());
