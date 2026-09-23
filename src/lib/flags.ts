/** Kunci feature flags dan default-nya. Semua modul bisa on/off dari Pengaturan. */
export const FLAG_DEFAULTS = {
  kds: true, // dapur KDS (papan BARU→DIMASAK→SIAP) — matikan utk warung tanpa layar dapur (order langsung "selesai")
  queue_board: true, // papan nomor antrean big-screen
  loyalty: true, // program loyalitas & poin
  promotions: true, // voucher/bundle/happy hour/BOGO
  kiosk: false, // self-order layar sentuh di toko
  e_receipt: true, // struk digital via QR
  marketplace_channels: true, // GoFood/GrabFood/ShopeeFood tracker
  self_delivery: true, // portal + rider internal
  on_demand_courier: false, // Lalamove/PandaGo overflow
  bluetooth_printer: true, // ESC/POS via Web Bluetooth
  sound_alerts: true, // alert suara order masuk
  training_mode: true, // mode latihan kasir
  customer_rating: true, // rating bintang portal
  pre_order: true, // pre-order dengan DP
  portal: true, // portal pelanggan
  inventory: true, // persediaan + BOM/HPP
  finance: true, // pengeluaran & P&L
  split_payment: true, // pembayaran gabungan multi-metode
  tax_service_charge: true, // pajak & service charge otomatis
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

export const FLAG_LABELS: Record<FlagKey, string> = {
  kds: "Dapur / KDS",
  queue_board: "Papan Antrean",
  loyalty: "Loyalty & Poin",
  promotions: "Promo & Voucher",
  kiosk: "Kiosk Self-Order",
  e_receipt: "E-Receipt (QR)",
  marketplace_channels: "Kanal Marketplace (GoFood/GrabFood/ShopeeFood)",
  self_delivery: "Portal & Delivery Mandiri",
  on_demand_courier: "Kurir On-Demand (Lalamove/PandaGo)",
  bluetooth_printer: "Printer Bluetooth",
  sound_alerts: "Alert Suara Order",
  training_mode: "Mode Latihan (Sandbox)",
  customer_rating: "Rating Pelanggan",
  pre_order: "Pre-Order & DP",
  portal: "Portal Pelanggan",
  inventory: "Persediaan & BOM/HPP",
  finance: "Keuangan (Pengeluaran/P&L)",
  split_payment: "Pembayaran Gabungan (Split)",
  tax_service_charge: "Pajak & Service Charge",
};

export type Flags = Record<FlagKey, boolean>;
