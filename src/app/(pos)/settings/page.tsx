import { requireManager, getStaff } from "@/lib/auth/session";
import { getFlags } from "@/lib/flags-server";
import { FLAG_LABELS } from "@/lib/flags";
import { getOutletSettings } from "@/lib/actions/settings";
import { getTwofaStatus } from "@/lib/actions/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FlagsManager } from "@/components/settings/flags-manager";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { PrinterPanel } from "@/components/pos/printer-panel";
import { ReceiptPreview } from "@/components/settings/receipt-preview";
import { TwofaPanel } from "@/components/settings/twofa-panel";
import { StaffPanel } from "@/components/settings/staff-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireManager();
  const [flags, settings, twofa, staff] = await Promise.all([
    getFlags(),
    getOutletSettings(),
    getTwofaStatus(),
    getStaff(),
  ]);

  // Order terakhir (untuk "Cetak Struk Terakhir" & preview struk).
  const { data: lastOrder } = await createSupabaseAdminClient()
    .from("orders")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastOrderId = lastOrder?.id ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-sm text-stone-500">
          Konfigurasi gerai. Semua modul aplikasi dapat diaktifkan/dinonaktifkan dari tab Fitur &amp; Modul.
        </p>
      </header>

      <SettingsTabs
        gerai={<SettingsForm initial={settings} />}
        struk={
          <div className="grid gap-5 lg:grid-cols-2">
            <PrinterPanel lastOrderId={lastOrderId ?? undefined} />
            <section className="card p-5">
              <h2 className="mb-1 text-lg font-semibold">Preview Struk</h2>
              <p className="mb-4 text-sm text-stone-500">
                Simulasi struk thermal 58mm dari order terakhir — cek format sebelum mencetak ke printer.
              </p>
              <ReceiptPreview />
            </section>
          </div>
        }
        keamanan={
          <section className="card p-5">
            <h2 className="mb-1 text-lg font-semibold">Keamanan — 2FA Owner</h2>
            <p className="mb-4 text-sm text-stone-500">
              Lapisan kedua (TOTP) untuk aksi sensitif owner.
            </p>
            {staff?.role === "owner" ? (
              <TwofaPanel initialEnabled={twofa.enabled} />
            ) : (
              <p className="py-4 text-sm text-stone-400">Hanya owner yang dapat mengelola 2FA.</p>
            )}
          </section>
        }
        fitur={
          <section className="card p-5">
            <h2 className="mb-1 text-lg font-semibold">Fitur &amp; Modul</h2>
            <p className="mb-4 text-sm text-stone-500">
              Matikan modul yang tidak dipakai — navigasi, alur kasir, dan laporan terkait otomatis menyesuaikan.
            </p>
            <FlagsManager initialFlags={flags} labelMap={FLAG_LABELS} />
          </section>
        }
        staf={
          <section className="card p-5">
            <h2 className="mb-1 text-lg font-semibold">Staf &amp; PIN</h2>
            {staff?.role === "owner" ? (
              <StaffPanel />
            ) : (
              <p className="py-4 text-sm text-stone-400">Hanya owner yang dapat mengelola staf.</p>
            )}
          </section>
        }
      />
    </div>
  );
}
