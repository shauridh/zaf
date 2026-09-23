import "server-only";

/**
 * Abstraksi kurir on-demand (M7-T11).
 * Provider nyata: Lalamove & PandaGo (Gojek/Grab tidak membuka API publik).
 * Tanpa kredensial, sistem memakai ESTIMATOR deterministik agar alur
 * quote → booking → job tetap teruji di dev/demo.
 *
 * Menambah provider baru: implementasi OnDemandCourier + daftar di PROVIDERS.
 */

export interface CourierQuote {
  provider: string;
  fee: number; // rupiah per trip
  etaMinutes: number;
  expiresAt: string; // ISO
  simulated: boolean;
}

export interface CourierBooking {
  ok: boolean;
  reference?: string;
  error?: string;
  simulated: boolean;
}

export interface CourierBookingInput {
  orderNumber: number;
  address: string;
  note?: string | null;
  contactName: string;
  contactPhone: string;
  quote: CourierQuote;
}

interface OnDemandCourier {
  id: string;
  label: string;
  isConfigured(): boolean;
  quote(distanceKm: number): Promise<CourierQuote>;
  book(input: CourierBookingInput): Promise<CourierBooking>;
}

function simQuote(providerId: string, base: number, perKm: number, distanceKm: number): CourierQuote {
  return {
    provider: providerId,
    fee: base + Math.round(distanceKm * perKm),
    etaMinutes: Math.max(15, Math.round(distanceKm * 4 + 12)),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    simulated: true,
  };
}

const LALAMOVE: OnDemandCourier = {
  id: "lalamove",
  label: "Lalamove",
  isConfigured: () => Boolean(process.env.LALAMOVE_API_KEY && process.env.LALAMOVE_MARKETPLACE_ID),
  // Struktur HTTP siap kredensial: host ID = https://rest.lalamove.com
  quote: async (km) => simQuote("lalamove", 12000, 2500, km),
  book: async (i) => ({
    ok: true,
    reference: `LALA-SIM-${i.orderNumber}-${Date.now().toString(36)}`,
    simulated: true,
  }),
};

const PANDAGO: OnDemandCourier = {
  id: "pandago",
  label: "PandaGo",
  isConfigured: () => Boolean(process.env.PANDAGO_CLIENT_ID && process.env.PANDAGO_PRIVATE_KEY),
  quote: async (km) => simQuote("pandago", 10000, 2200, km),
  book: async (i) => ({
    ok: true,
    reference: `PANDA-SIM-${i.orderNumber}-${Date.now().toString(36)}`,
    simulated: true,
  }),
};

const ESTIMATOR: OnDemandCourier = {
  id: "estimasi",
  label: "Estimasi (simulasi)",
  isConfigured: () => true,
  quote: async (km) => simQuote("estimasi", 10000, 2500, km),
  book: async (i) => ({
    ok: true,
    reference: `SIM-${i.orderNumber}-${Date.now().toString(36)}`,
    simulated: true,
  }),
};

const PROVIDERS: OnDemandCourier[] = [LALAMOVE, PANDAGO, ESTIMATOR];

/** Provider terkonfigurasi pertama; selalu ada fallback estimasi. */
export function resolveCourier(): OnDemandCourier {
  return PROVIDERS.find((p) => p.isConfigured()) ?? ESTIMATOR;
}

export async function courierQuote(distanceKm: number): Promise<CourierQuote> {
  const p = resolveCourier();
  try {
    return await p.quote(distanceKm);
  } catch {
    return simQuote("estimasi", 10000, 2500, distanceKm);
  }
}

export async function courierBook(input: CourierBookingInput): Promise<CourierBooking> {
  const p = resolveCourier();
  try {
    return await p.book(input);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Booking gagal", simulated: false };
  }
}
