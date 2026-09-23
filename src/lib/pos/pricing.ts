import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface PricingSettings {
  taxPercent: number;
  servicePercent: number;
  openingFloat: number;
}

/** Ambil settings harga outlet (cache sederhana per proses). */
let cachedSettings: { at: number; value: PricingSettings } | null = null;

export async function getPricingSettings(): Promise<PricingSettings> {
  if (cachedSettings && Date.now() - cachedSettings.at < 60_000) return cachedSettings.value;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("outlet_settings").select("*").limit(1).maybeSingle();
  const value: PricingSettings = {
    taxPercent: Number(data?.tax_percent ?? 0),
    servicePercent: Number(data?.service_charge_percent ?? 0),
    openingFloat: Number(data?.opening_float ?? 350000),
  };
  cachedSettings = { at: Date.now(), value };
  return value;
}

export interface PromoValidation {
  ok: boolean;
  error?: string;
  discount: number;
  promoId?: string;
  name?: string;
}

interface PromoRow {
  id: string;
  name: string;
  type: string;
  code: string | null;
  value_percent: number | null;
  value_amount: number | null;
  min_spend: number;
  buy_qty: number | null;
  get_qty: number | null;
  start_at: string | null;
  end_at: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  active: boolean;
  bundle_product_ids: string[] | null;
}



function withinHappyHour(promo: PromoRow, now = new Date()): boolean {
  // WIB
  const jakarta = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const day = jakarta.getDay();
  if (promo.days_of_week && promo.days_of_week.length > 0 && !promo.days_of_week.includes(day)) {
    return false;
  }
  if (!promo.start_time || !promo.end_time) return true;
  const minutes = jakarta.getHours() * 60 + jakarta.getMinutes();
  const [sh, sm] = promo.start_time.split(":").map(Number);
  const [eh, em] = promo.end_time.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return minutes >= start && minutes <= end;
}

/**
 * Validasi kode promo untuk subtotal & isi cart tertentu.
 * Mendukung: voucher (persen/nominal, min_spend, periode),
 * happy hour (jam WIB), bogo (buy X get Y dari qty item), bundle (semua produk ada).
 */
export async function validatePromoCode(
  code: string,
  subtotal: number,
  lines: { product_id: string; qty: number; unit_price: number }[],
): Promise<PromoValidation> {
  if (!code.trim()) return { ok: false, error: "Masukkan kode promo", discount: 0 };

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("promotions")
    .select("*")
    .eq("active", true)
    .ilike("code", code.trim());
  const promo = (data as PromoRow[] | null)?.[0];

  if (!promo) return { ok: false, error: "Kode promo tidak ditemukan", discount: 0 };

  const now = new Date();
  if (promo.start_at && now < new Date(promo.start_at)) {
    return { ok: false, error: "Promo belum dimulai", discount: 0 };
  }
  if (promo.end_at && now > new Date(promo.end_at)) {
    return { ok: false, error: "Promo sudah berakhir", discount: 0 };
  }
  if (subtotal < promo.min_spend) {
    return { ok: false, error: `Minimal belanja Rp${promo.min_spend.toLocaleString("id-ID")}`, discount: 0 };
  }

  switch (promo.type) {
    case "voucher": {
      const discount =
        promo.value_percent != null
          ? Math.round((subtotal * Number(promo.value_percent)) / 100)
          : Math.min(promo.value_amount ?? 0, subtotal);
      return { ok: true, discount, promoId: promo.id, name: promo.name };
    }
    case "happy_hour": {
      if (!withinHappyHour(promo)) {
        return { ok: false, error: "Di luar jam happy hour", discount: 0 };
      }
      const discount =
        promo.value_percent != null
          ? Math.round((subtotal * Number(promo.value_percent)) / 100)
          : Math.min(promo.value_amount ?? 0, subtotal);
      return { ok: true, discount, promoId: promo.id, name: promo.name };
    }
    case "bogo": {
      const buy = promo.buy_qty ?? 1;
      const get = promo.get_qty ?? 1;
      if (!promo.bundle_product_ids || promo.bundle_product_ids.length === 0) {
        return { ok: false, error: "Produk BOGO belum diatur", discount: 0 };
      }
      // Unit gratis = floor(qty / (buy+get)) * get, diambil dari harga termurah yang memenuhi
      let cheapest = Infinity;
      let freeUnits = 0;
      for (const line of lines) {
        if (promo.bundle_product_ids.includes(line.product_id)) {
          freeUnits += Math.floor(line.qty / (buy + get)) * get;
          if (line.unit_price < cheapest) cheapest = line.unit_price;
        }
      }
      if (freeUnits === 0 || !Number.isFinite(cheapest)) {
        return { ok: false, error: `Beli ${buy} gratis ${get} — qty belum cukup`, discount: 0 };
      }
      const discount = Math.min(freeUnits * cheapest, subtotal);
      return { ok: true, discount, promoId: promo.id, name: promo.name };
    }
    case "bundle": {
      const required = promo.bundle_product_ids ?? [];
      const owned = new Set(lines.map((l) => l.product_id));
      if (!required.every((id) => owned.has(id))) {
        return { ok: false, error: "Paket belum lengkap", discount: 0 };
      }
      const discount =
        promo.value_percent != null
          ? Math.round((subtotal * Number(promo.value_percent)) / 100)
          : Math.min(promo.value_amount ?? 0, subtotal);
      return { ok: true, discount, promoId: promo.id, name: promo.name };
    }
    default:
      return { ok: false, error: "Tipe promo tidak dikenal", discount: 0 };
  }
}
