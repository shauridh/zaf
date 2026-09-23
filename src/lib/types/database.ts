// ============================================================
// Kontrak skema ChickenPOS untuk TypeScript.
// Sumber kebenaran: supabase/migrations/0001_init_schema.sql
// Uang selalu INTEGER rupiah. Waktu = timestamptz.
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type StaffRole = "owner" | "manager" | "cashier";
export type OrderChannel =
  | "dine_in"
  | "takeaway"
  | "delivery"
  | "gofood"
  | "grabfood"
  | "shopeefood"
  | "self_delivery"
  | "pickup"
  | "kiosk";
export type OrderStatus =
  | "held"
  | "unpaid" // portal: menunggu verifikasi transfer
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled"
  | "refunded";
export type PaymentMethod = "cash" | "qris" | "debit" | "transfer";
export type PaymentKind = "deposit" | "final";
export type OptionInputType = "single" | "multi";
export type MovementType = "sale" | "purchase" | "adjustment" | "waste";
export type ShiftStatus = "open" | "closed";
export type CashMovementKind = "pay_in" | "pay_out" | "cash_drop";
export type DeliveryProvider = "internal" | "pandago" | "lalamove";
export type DeliveryJobStatus =
  | "pending"
  | "assigned"
  | "picked_up"
  | "delivered"
  | "failed"
  | "cancelled";
export type PromotionType = "voucher" | "bundle" | "happy_hour" | "bogo";

export type Profile = {
  id: string;
  name: string;
  role: StaffRole;
  pin_hash: string;
  active: boolean;
  twofa_enabled: boolean;
  twofa_secret: string | null;
  created_at: string;
}

export type Outlet = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export type OutletSettings = {
  outlet_id: string;
  tax_percent: number; // 0–100, bisa pecahan
  service_charge_percent: number;
  opening_float: number; // integer rupiah (default 350000)
  receipt_footer: string | null;
  delivery_fee_flat: number;
  delivery_fee_per_km: number;
  delivery_radius_km: number;
  payment_methods: PaymentMethod[];
  updated_at: string;
}

export type FeatureFlag = {
  outlet_id: string;
  key: string;
  enabled: boolean;
}

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export type OptionValue = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  sort_order: number;
  active: boolean;
}

export type OptionGroup = {
  id: string;
  name: string;
  input_type: OptionInputType;
  is_required: boolean;
  min_select: number;
  max_select: number | null;
  sort_order: number;
  active: boolean;
  options: OptionValue[];
}

export type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  track_stock: boolean;
  sort_order: number;
  option_groups: OptionGroup[];
}

export type Ingredient = {
  id: string;
  name: string;
  unit: string; // gr, ml, pcs, dll (satuan jual/resep)
  purchase_unit: string | null; // satuan saat beli ke supplier (galon, karung, dst)
  conversion_factor: number; // 1 satuan beli = berapa satuan jual (> 0)
  stock_qty: number;
  min_stock_qty: number;
  cost_per_unit: number; // biaya per satuan jual (moving average)
  supplier_id: string | null;
  barcode: string | null;
  active: boolean;
  created_at: string;
}

export type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  lead_time_days: number;
  active: boolean;
}

export type RecipeLine = {
  product_id: string;
  ingredient_id: string;
  qty_per_unit: number;
  // delta stok tambahan per value opsi tertentu (mis. nasi extra)
  option_delta?: { option_id: string; qty_delta: number }[];
}

export type Purchase = {
  id: string;
  supplier_id: string | null;
  total: number;
  note: string | null;
  invoice_ref: string | null;
  created_by: string;
  created_at: string;
  items: PurchaseItem[];
}

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  ingredient_id: string;
  qty: number;
  unit_cost: number;
  subtotal: number;
}

export type StockMovement = {
  id: string;
  ingredient_id: string;
  movement_type: MovementType;
  qty_change: number; // + masuk, − keluar
  stock_after: number;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export type OrderItemOption = {
  option_id: string;
  option_group_id: string;
  name: string;
  group_name: string;
  price_delta: number;
}

export type OrderItem = {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  subtotal: number;
  discount: number;
  note: string | null;
  options: OrderItemOption[];
}

export type Order = {
  id: string;
  outlet_id: string;
  order_number: number;
  channel: OrderChannel;
  status: OrderStatus;
  training: boolean;
  customer_name: string | null;
  customer_phone: string | null;
  portal_customer_id: string | null;
  table_label: string | null;
  queue_number: number | null;
  scheduled_at: string | null; // pre-order
  note: string | null;
  address: string | null; // delivery mandiri
  items: OrderItem[];
  subtotal: number;
  order_discount: number;
  promo_id: string | null;
  promo_discount: number;
  delivery_fee: number;
  tax: number;
  service_charge: number;
  total: number;
  total_paid: number; // termasuk DP pre-order
  change_due: number;
  channel_fee: number; // fee marketplace (gofood/grabfood/shopeefood)
  external_ref: string | null; // nomor order dari app marketplace
  rating: number | null; // 1-5 dari portal
  rating_note: string | null;
  points_earned: number;
  points_redeemed: number;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Payment = {
  id: string;
  order_id: string;
  shift_id: string | null; // shift laci penerima uang (null = di luar shift)
  method: PaymentMethod;
  kind: PaymentKind;
  amount: number;
  reference: string | null;
  proof_url: string | null; // bukti transfer portal
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export type Refund = {
  id: string;
  order_id: string;
  amount: number;
  reason: string;
  restock: boolean;
  approved_by: string;
  created_by: string;
  created_at: string;
}

export type Shift = {
  id: string;
  outlet_id: string;
  opened_by: string;
  closed_by: string | null;
  opening_cash: number;
  expected_cash: number;
  counted_cash: number | null;
  variance: number | null;
  status: ShiftStatus;
  opened_at: string;
  closed_at: string | null;
}

export type CashMovement = {
  id: string;
  shift_id: string;
  kind: CashMovementKind;
  amount: number;
  note: string | null;
  created_by: string;
  created_at: string;
}

export type Member = {
  id: string;
  phone: string;
  name: string | null;
  points: number;
  birth_date: string | null;
  created_at: string;
}

export type PointTransaction = {
  id: string;
  member_id: string;
  order_id: string | null;
  points_change: number;
  note: string | null;
  created_at: string;
}

export type Promotion = {
  id: string;
  name: string;
  type: PromotionType;
  code: string | null; // utk voucher
  value_percent: number | null;
  value_amount: number | null;
  min_spend: number;
  bundle_product_ids: string[] | null;
  buy_qty: number | null; // bogo
  get_qty: number | null;
  start_at: string | null;
  end_at: string | null;
  days_of_week: number[] | null; // happy hour (0=Minggu)
  start_time: string | null; // "15:00"
  end_time: string | null;
  active: boolean;
}

export type PortalCustomer = {
  id: string;
  phone: string;
  pin_hash: string;
  name: string | null;
  created_at: string;
}

export type Rider = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
}

export type DeliveryJob = {
  id: string;
  order_id: string;
  provider: DeliveryProvider;
  status: DeliveryJobStatus;
  rider_id: string | null;
  fee: number;
  tracking_url: string | null;
  provider_ref: string | null;
  created_at: string;
  updated_at: string;
}

export type Expense = {
  id: string;
  outlet_id: string;
  category: string;
  amount: number;
  note: string | null;
  spent_at: string;
  created_by: string;
  created_at: string;
}

export type MarketplaceSettlement = {
  id: string;
  outlet_id: string;
  channel: "gofood" | "grabfood" | "shopeefood";
  period_start: string;
  period_end: string;
  gross_sales: number;
  commission: number;
  promo_co_funding: number;
  other_fees: number;
  net_transfer: number;
  matched: boolean;
  note: string | null;
  created_by: string;
  created_at: string;
}

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: Json | null;
  created_at: string;
}

export type SecurityEvent = {
  id: string;
  actor_id: string | null;
  kind: string;
  detail: Json | null;
  created_at: string;
}

export type AuthAttempt = {
  key: string;
  failures: number;
  locked_until: string | null;
  updated_at: string;
}

/** Mapping tabel supabase: Insert/Update longgar (kolom default & generated). */
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      outlets: Table<Outlet>;
      outlet_settings: Table<OutletSettings>;
      feature_flags: Table<FeatureFlag>;
      categories: Table<Category>;
      option_groups: Table<OptionGroup>;
      options: Table<OptionValue>;
      products: Table<Product>;
      product_option_groups: Table<{ product_id: string; group_id: string; sort_order: number }>;
      suppliers: Table<Supplier>;
      ingredients: Table<Ingredient>;
      recipes: Table<RecipeLine>;
      purchases: Table<Purchase>;
      purchase_items: Table<PurchaseItem>;
      stock_movements: Table<StockMovement>;
      orders: Table<Order>;
      order_items: Table<OrderItem & { id: string; order_id: string }>;
      order_item_options: Table<OrderItemOption & { id: string; order_item_id: string }>;
      payments: Table<Payment>;
      refunds: Table<Refund>;
      shifts: Table<Shift>;
      cash_movements: Table<CashMovement>;
      members: Table<Member>;
      point_transactions: Table<PointTransaction>;
      promotions: Table<Promotion>;
      portal_customers: Table<PortalCustomer & { member_id: string | null }>;
      riders: Table<Rider>;
      delivery_jobs: Table<DeliveryJob>;
      expenses: Table<Expense>;
      marketplace_settlements: Table<MarketplaceSettlement>;
      audit_logs: Table<AuditLog>;
      security_events: Table<SecurityEvent>;
      auth_attempts: Table<AuthAttempt>;
    };
    Views: Record<string, never>;
    Functions: {
      next_order_number: { Args: { p_outlet: string }; Returns: number };
      next_queue_number: { Args: { p_outlet: string }; Returns: number };
      create_order_atomic: { Args: Record<string, never>; Returns: undefined };
      complete_order_and_deduct_stock: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      staff_authenticate: {
        Args: { p_id: string; p_pin: string };
        Returns: { id: string; name: string; role: string }[];
      };
      staff_register: {
        Args: { p_name: string; p_role: string; p_pin: string };
        Returns: string;
      };
      staff_change_pin: {
        Args: { p_id: string; p_old: string; p_new: string };
        Returns: boolean;
      };
      portal_authenticate: {
        Args: { p_phone: string; p_pin: string };
        Returns: { id: string; name: string | null; member_id: string | null }[];
      };
      portal_register: {
        Args: { p_phone: string; p_name: string; p_pin: string };
        Returns: string;
      };
      restock_order: {
        Args: { p_order_id: string; p_actor: string };
        Returns: undefined;
      };
      increment_member_points: {
        Args: { p_member: string; p_points: number };
        Returns: undefined;
      };
      portal_rate_order: {
        Args: { p_order_id: string; p_portal_customer: string; p_rating: number; p_note: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
