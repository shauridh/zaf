"use client";

import { useState, useTransition } from "react";
import { updateOutletSettings, type OutletSettingsView } from "@/lib/actions/settings";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toast";

export function SettingsForm({ initial }: { initial: OutletSettingsView }) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<OutletSettingsView>) => setForm((f) => ({ ...f, ...patch }));

  const save = () => {
    startTransition(async () => {
      const res = await updateOutletSettings(form);
      if (res.ok) toast.success("Pengaturan tersimpan");
      else toast.error(res.error ?? "Gagal menyimpan");
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumField
          label="Pajak (%)"
          value={form.taxPercent}
          onChange={(v) => set({ taxPercent: v })}
          decimals
        />
        <NumField
          label="Service charge (%)"
          value={form.servicePercent}
          onChange={(v) => set({ servicePercent: v })}
          decimals
        />
        <MoneyInput
          label="Modal laci kas (Rp)"
          value={form.openingFloat}
          onChange={(v) => set({ openingFloat: v })}
          quickAmounts={[100000, 350000, 500000]}
        />
        <MoneyInput
          label="Ongkir flat (Rp)"
          value={form.deliveryFeeFlat}
          onChange={(v) => set({ deliveryFeeFlat: v })}
          quickAmounts={[5000, 10000, 15000]}
        />
        <NumField
          label="Ongkir per km (Rp)"
          value={form.deliveryFeePerKm}
          onChange={(v) => set({ deliveryFeePerKm: v })}
        />
        <NumField
          label="Radius delivery (km)"
          value={form.deliveryRadiusKm}
          onChange={(v) => set({ deliveryRadiusKm: v })}
          decimals
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-400">
          Footer struk
        </label>
        <textarea
          value={form.receiptFooter}
          onChange={(e) => set({ receiptFooter: e.target.value })}
          rows={2}
          className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
        />
      </div>

      <button
        onClick={save}
        disabled={pending}
        className="touch-target rounded-btn bg-brand-600 px-8 py-3 font-bold text-white disabled:opacity-40"
      >
        {pending ? "Menyimpan…" : "Simpan Pengaturan"}
      </button>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  decimals,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  decimals?: boolean;
}) {
  return (
    <MoneyInput
      label={label}
      value={value}
      onChange={onChange}
      decimals={decimals}
      suffix={decimals ? "%" : undefined}
    />
  );
}
