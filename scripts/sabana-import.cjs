// Impor price list Sabana → bahan baku (idempoten: skip nama yang sudah ada).
// Sumber: scripts/pdf-table.txt (hasil ekstrak PDF, dikurasi manual).
const fs = require("fs");

const envText = fs.readFileSync(".env.local", "utf8");
function env(key) {
  const m = new RegExp(`^${key}=(.*)$`, "m").exec(envText);
  return m ? m[1].trim() : "";
}
const { createClient } = require("@supabase/supabase-js");
const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

// [nama, satuanJual, isiPerBeli, satuanBeli, hargaBeli]
const ITEMS = [
  ["Ayam Potong 9", "potong", 9, "pack", 48000],
  ["Ayam Potong 12", "potong", 12, "pack", 48000],
  ["Ayam Boneless", "pcs", 30, "pack", 65000],
  ["Kulit Ayam", "gr", 500, "pack", 20000],
  ["Beras Mentik Wangi 10 Kg", "gr", 10000, "karung", 165000],
  ["Beras Mentik Wangi 25 Kg", "gr", 25000, "karung", 412500],
  ["Tepung Fried Chicken", "pack", 1, "pack", 23500],
  ["SuncO Minyak Goreng 2 Liter", "ml", 2000, "pouch", 43400],
  ["Chicken Patty", "pcs", 1, "pcs", 4500],
  ["Roti Burger", "pcs", 1, "pcs", 2600],
  ["Bakso", "pcs", 50, "pack", 24000],
  ["Chicken Roll", "pcs", 10, "pack", 24400],
  ["Saus Sambal Sabana", "pcs", 125, "pack", 22500],
  ["Saus Tomat Del Monte", "pcs", 20, "pack", 5300],
  ["Saus Sambal Refill 1 Kg Del Monte", "gr", 1000, "pouch", 20700],
  ["Saus Tomat Refill 1 Kg Del Monte", "gr", 1000, "pouch", 15100],
  ["Kemasan Ayam", "pcs", 100, "pack", 23500],
  ["Kemasan Kulit Crispy", "pcs", 100, "pack", 15000],
  ["Kertas Nasi", "pcs", 100, "pack", 13000],
  ["Box Standard", "pcs", 100, "pack", 125000],
  ["Lunch Box", "pcs", 100, "pack", 115000],
  ["Box Serbaguna", "pcs", 100, "pack", 85000],
  ["Box Siap Saji", "pcs", 100, "pack", 60500],
  ["Box Kentang", "pcs", 200, "pack", 119800],
  ["Sambal Geprek", "gr", 500, "pouch", 64000],
  ["Sambal Ijo", "gr", 500, "pouch", 53000],
  ["Sambal Hitam", "gr", 500, "pouch", 51500],
  ["Cup Sauce 35 ML", "pcs", 50, "pack", 15000],
  ["Plastik Kecil", "pcs", 25, "pack", 7000],
  ["Plastik Sedang", "pcs", 25, "pack", 7000],
  ["Plastik Hitam", "pcs", 30, "pack", 15600],
  ["Plastik Merah", "pcs", 30, "pack", 28000],
  ["Sarung Tangan", "pcs", 75, "pack", 11000],
  ["Saud Buldak", "gr", 500, "pouch", 36800],
  ["Saus Tomat Prima", "pcs", 20, "pack", 9300],
  ["Saus Keju Mentai", "gr", 500, "pouch", 27000],
  ["Saus Black Pepper", "pcs", 10, "pack", 16500],
  ["Saus BBQ", "pcs", 10, "pack", 8000],
  ["Saus Extra Pedas (Sadas)", "gr", 500, "pouch", 24500],
  ["Mayonaise Prima 900 GR", "gr", 900, "pouch", 36700],
  ["Fruit Tea Apple 250 ML", "pcs", 1, "pcs", 2500],
  ["Fruit Tea Blackcurrant 250 ML", "pcs", 1, "pcs", 2500],
  ["Fruit Tea Lemon 250 ML", "pcs", 1, "pcs", 2500],
  ["Teh Botol Sosro 250 ML", "pcs", 1, "pcs", 2500],
  ["Concentrate Fruit Tea Rasa Blackcurrant", "botol", 1, "botol", 16700],
  ["Concentrate Fruit Tea Rasa Lemon Tea", "botol", 1, "botol", 16700],
  ["Air Botol 330 ML", "botol", 24, "dus", 59400],
  ["Air Kesehatan Cup 220 ML", "gelas", 48, "dus", 28000],
  ["Kentang Simplot 2.72 Kg", "gr", 2720, "pack", 115000],
  ["Kentang McCain 2.5 Kg", "gr", 2500, "pack", 110500],
  ["Kardus Ukuran 30", "pcs", 1, "pcs", 9500],
  ["Kardus Ukuran 50", "pcs", 1, "pcs", 11000],
  ["Roti Chicken Bun", "pcs", 4, "pack", 8000],
  ["Paper Bowl 500 ML", "pcs", 25, "pack", 38750],
  ["Paper Bowl 650 ML", "pcs", 25, "pack", 41250],
  ["Oregano 25 GR", "gr", 25, "pcs", 8000],
  ["Sendok Garpu Plastik", "pcs", 50, "pack", 10000],
  ["Rice Box", "pcs", 100, "pack", 153200],
  ["Kentang Simplot 2 Kg", "gr", 2000, "pack", 83000],
  ["Chicken Katsu", "pcs", 1, "pcs", 4500],
  ["Kardus Ukuran 40", "pcs", 1, "pcs", 10000],
  ["Cup Sauce Mika", "pcs", 50, "pack", 10000],
];

(async () => {
  // Supplier Sabana (idempoten)
  let supplierId;
  {
    const { data: existing } = await admin.from("suppliers").select("id").eq("name", "Sabana").maybeSingle();
    if (existing) supplierId = existing.id;
    else {
      const { data: created, error } = await admin
        .from("suppliers")
        .insert({ name: "Sabana", lead_time_days: 2 })
        .select("id")
        .single();
      if (error) throw error;
      supplierId = created.id;
    }
  }

  const { data: existingIngs } = await admin.from("ingredients").select("name").in("active", [true, false]);
  const existingNames = new Set((existingIngs ?? []).map((r) => r.name.toLowerCase()));

  let inserted = 0;
  let skipped = 0;
  const errors = [];
  for (const [name, unit, factor, purchaseUnit, price] of ITEMS) {
    if (existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    const { error } = await admin.from("ingredients").insert({
      name,
      unit,
      purchase_unit: purchaseUnit,
      conversion_factor: factor,
      stock_qty: 0,
      min_stock_qty: 0,
      cost_per_unit: Math.round(price / factor),
      supplier_id: supplierId,
      active: true,
    });
    if (error) errors.push(`${name}: ${error.message}`);
    else inserted++;
  }
  console.log(JSON.stringify({ total: ITEMS.length, inserted, skipped, errors }, null, 2));
})();

/**
 * Set minimum stok masuk akal untuk bahan Sabana yang masih 0.
 * Heuristik per kategori (dalam satuan jual):
 *   bahan segar (ayam/kentang/roti/bakso) ≈ 1 hari operasional,
 *   kemasan/disposables ≈ 1 pack konversi, saus/refill ≈ 500 gr, minuman kemasan ≈ 12 pcs.
 */
const MIN_STOCK = [
  ["Ayam Potong", 9], ["Ayam Boneless", 15], ["Kulit Ayam", 500], ["Chicken Patty", 10],
  ["Chicken Katsu", 10], ["Chicken Roll", 5], ["Bakso", 10], ["Roti Burger", 10],
  ["Roti Chicken Bun", 4], ["Kentang", 1000], ["Beras", 3000], ["SuncO", 2000],
  ["Tepung", 1], ["Sambal", 250], ["Saus", 50], ["Saud", 250], ["Mayonaise", 450],
  ["Oregano", 25], ["Kemasan", 50], ["Kertas", 50], ["Box", 50], ["Lunch", 50],
  ["Paper", 25], ["Plastik", 25], ["Sarung", 40], ["Sendok", 50], ["Cup Sauce", 25],
  ["Fruit Tea", 12], ["Teh Botol", 12], ["Air Botol", 12], ["Air Kesehatan", 24],
  ["Concentrate", 1], ["Kardus", 5], ["Rice Box", 50],
];

async function setMinStock() {
  let updated = 0;
  for (const [prefix, min] of MIN_STOCK) {
    const { data, error } = await admin
      .from("ingredients")
      .select("id, name")
      .ilike("name", `${prefix}%`)
      .eq("min_stock_qty", 0);
    if (error) throw error;
    for (const row of data ?? []) {
      const { error: upErr } = await admin.from("ingredients").update({ min_stock_qty: min }).eq("id", row.id);
      if (upErr) throw upErr;
      updated++;
    }
  }
  console.log(`min_stock di-set untuk ${updated} bahan`);
}

if (process.argv.includes("--min-stock")) setMinStock();
