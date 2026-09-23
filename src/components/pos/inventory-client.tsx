"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, PackagePlus, Trash2, Calculator, Plus } from "lucide-react";
import { adjustStock, recordPurchase, type IngredientView, type ReorderSuggestion, type PurchaseHistoryItem } from "@/lib/actions/inventory";
import { createIngredient } from "@/lib/actions/ingredient-create";
import { Numpad } from "@/components/ui/numpad";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { formatRupiah } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface SupplierLite {
  id: string;
  name: string;
  lead_time_days: number;
}

export function InventoryClient({
  ingredients,
  suppliers,
  suggestions,
  recentPurchases,
}: {
  ingredients: IngredientView[];
  suppliers: SupplierLite[];
  suggestions: ReorderSuggestion[];
  recentPurchases: PurchaseHistoryItem[];
}) {
  const [mode, setMode] = useState<null | { kind: "adjustment" | "waste"; ingredient: IngredientView }>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setNewOpen(true)}
          className="touch-target flex items-center gap-2 rounded-btn border border-brand-600 px-4 py-2 text-sm font-bold text-brand-700 dark:text-brand-300"
        >
          <Plus className="size-4" /> Bahan Baru
        </button>
        <button
          onClick={() => setPurchaseOpen(true)}
          className="touch-target flex items-center gap-2 rounded-btn bg-brand-600 px-4 py-2 text-sm font-bold text-white"
        >
          <PackagePlus className="size-4" /> Catat Pembelian
        </button>
      </div>

      {suggestions.length > 0 && (
        <section className="card border-amber-300 p-5 dark:border-amber-500/40">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <AlertTriangle className="size-5 text-amber-500" /> Saran Reorder
          </h2>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.ingredient_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
                <div>
                  <p className="font-semibold">
                    {s.name} — sisa {s.stock_qty} {s.unit} (min {s.min_stock_qty})
                  </p>
                  <p className="text-xs text-stone-500">{s.reason}</p>
                </div>
                <span className="rounded-full bg-amber-500/20 px-3 py-1 font-bold text-amber-700 dark:text-amber-300">
                  Pesan ± {s.suggested_qty} {s.unit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase text-stone-400 dark:border-stone-800">
              <th className="p-3">Bahan</th>
              <th className="p-3">Stok</th>
              <th className="p-3">Min</th>
              <th className="p-3">Biaya/unit</th>
              <th className="p-3">Nilai</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing) => (
              <tr key={ing.id} className="border-b border-stone-100 dark:border-stone-800">
                <td className="p-3 font-semibold">
                  {ing.name}
                  <span className="block text-xs font-normal text-stone-400">
                    {ing.unit}
                    {ing.purchase_unit && ing.purchase_unit !== ing.unit && (
                      <span className="font-semibold text-brand-600 dark:text-brand-400">
                        {" · beli: "}1 {ing.purchase_unit} = {ing.conversion_factor.toLocaleString("id-ID")} {ing.unit}
                      </span>
                    )}
                  </span>
                </td>
                <td className={cn("p-3 font-bold tabular-nums", ing.stock_qty <= ing.min_stock_qty && "text-red-500")}>
                  {ing.stock_qty.toLocaleString("id-ID")}
                  {ing.stock_qty <= 0 ? (
                    <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 align-middle text-[10px] font-bold text-white">HABIS</span>
                  ) : ing.stock_qty <= ing.min_stock_qty ? (
                    <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 align-middle text-[10px] font-bold text-white">MENIPIS</span>
                  ) : null}
                </td>
                <td className="p-3 tabular-nums text-stone-400">{ing.min_stock_qty.toLocaleString("id-ID")}</td>
                <td className="p-3 tabular-nums">{formatRupiah(Math.round(ing.cost_per_unit))}</td>
                <td className="p-3 tabular-nums">{formatRupiah(Math.round(ing.stock_qty * ing.cost_per_unit))}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setMode({ kind: "adjustment", ingredient: ing })}
                      title="Stok opname"
                      className="touch-target rounded-lg border border-stone-300 p-2 dark:border-stone-700"
                    >
                      <Calculator className="size-4" />
                    </button>
                    <button
                      onClick={() => setMode({ kind: "waste", ingredient: ing })}
                      title="Waste"
                      className="touch-target rounded-lg border border-red-200 p-2 text-red-500 dark:border-red-500/30"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Modal
        open={!!mode}
        onClose={() => setMode(null)}
        title={mode?.kind === "waste" ? `Waste — ${mode.ingredient.name}` : `Stok Opname — ${mode?.ingredient.name ?? ""}`}
      >
        {mode && (
          <AdjustForm
            ingredient={mode.ingredient}
            mode={mode.kind}
            onDone={() => {
              setMode(null);
              window.location.reload();
            }}
          />
        )}
      </Modal>

      <Modal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} title="Catat Pembelian" size="lg">
        <PurchaseForm ingredients={ingredients} suppliers={suppliers} onDone={() => { setPurchaseOpen(false); window.location.reload(); }} />
      </Modal>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Tambah Bahan Baku Baru">
        <NewIngredientForm suppliers={suppliers} onDone={() => { setNewOpen(false); window.location.reload(); }} />
      </Modal>

      {recentPurchases.length > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="p-4 pb-2 font-bold">Riwayat Pembelian Terakhir</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase text-stone-400 dark:border-stone-800">
                <th className="p-3">Waktu</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">No. Invoice / Keterangan</th>
                <th className="p-3">Item</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {recentPurchases.map((p) => (
                <tr key={p.id} className="border-b border-stone-100 dark:border-stone-800">
                  <td className="p-3 whitespace-nowrap text-stone-500">
                    {new Date(p.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="p-3">{p.supplier_name ?? <span className="text-stone-400">—</span>}</td>
                  <td className="p-3">
                    {p.invoice_ref ? (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 font-mono text-xs font-semibold dark:bg-stone-800">{p.invoice_ref}</span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                    {p.note && <span className="block text-xs text-stone-500">{p.note}</span>}
                  </td>
                  <td className="p-3 text-xs">
                    {p.items.map((i) => `${i.name} ${i.qty.toLocaleString("id-ID")} ${i.unit}`).join(", ") || <span className="text-stone-400">—</span>}
                  </td>
                  <td className="p-3 text-right font-bold tabular-nums">{formatRupiah(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/**
 * Kategori satuan (hardcode) — tiap kategori punya daftar satuan jual/resep
 * dan daftar satuan beli yang masuk akal untuk kategori tsb.
 */
const UNIT_CATEGORIES = [
  {
    key: "volume",
    label: "Volume (cair)",
    sellUnits: ["ml", "liter"],
    buyUnits: ["ml", "liter", "galon", "karton", "dus", "botol", "pack"],
  },
  {
    key: "mass",
    label: "Berat (bahan kering/daging)",
    sellUnits: ["gr", "kg"],
    buyUnits: ["gr", "kg", "karung", "sack", "pack", "porsi"],
  },
  {
    key: "unit",
    label: "Satuan (utuh)",
    sellUnits: ["pcs", "porsi", "pack"],
    buyUnits: ["pcs", "dus", "karton", "pack", "rim"],
  },
] as const;

/** Semua satuan jual dari semua kategori, untuk satu dropdown. */
const ALL_SELL_UNITS = UNIT_CATEGORIES.flatMap((c) => c.sellUnits);

/** Kategori tempat satuan tsb berada — menentukan pilihan satuan beli. */
function catForUnit(unit: string) {
  return (
    UNIT_CATEGORIES.find((c) => (c.sellUnits as readonly string[]).includes(unit)) ??
    UNIT_CATEGORIES[0]
  );
}

function NewIngredientForm({
  suppliers,
  onDone,
}: {
  suppliers: SupplierLite[];
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<string>(UNIT_CATEGORIES[0].sellUnits[0]);
  const [purchaseUnit, setPurchaseUnit] = useState<string>(UNIT_CATEGORIES[0].buyUnits[2]);
  const [fillPerBuy, setFillPerBuy] = useState(""); // isi per satuan beli (dalam satuan jual)
  const [purchasePrice, setPurchasePrice] = useState(""); // harga per satuan beli
  const [minQty, setMinQty] = useState("");
  const [initQty, setInitQty] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const factor = parseFloat(fillPerBuy.replace(",", ".")) || 0;
  const price = parseInt(purchasePrice, 10) || 0;
  const hpp = factor > 0 ? Math.round(price / factor) : 0;

  const cat = catForUnit(unit);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Nama bahan wajib");
      return;
    }
    if (factor <= 0 || price <= 0) {
      toast.error("Isi per beli & harga beli wajib (> 0)");
      return;
    }
    startTransition(async () => {
      const res = await createIngredient({
        name: name.trim(),
        unit,
        min_stock_qty: parseFloat(minQty.replace(",", ".")) || 0,
        initial_stock_qty: parseFloat(initQty.replace(",", ".")) || 0,
        purchase_unit: purchaseUnit,
        conversion_factor: factor,
        purchase_price: price,
        supplier_id: supplierId || null,
      });
      if (res.ok) {
        toast.success("Bahan baru tersimpan");
        onDone();
      } else {
        // Gagal (mis. nama duplikat): modal tetap terbuka, pesan tampil di atas form.
        setFormError(res.error ?? "Gagal simpan bahan");
        toast.error(res.error ?? "Gagal simpan bahan");
      }
    });
  };

  return (
    <div className="space-y-4">
      {formError && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {formError}
        </p>
      )}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama bahan (mis. Ayam Fillet)"
        className="w-full rounded-btn border border-stone-300 px-4 py-3 font-semibold dark:border-stone-700 dark:bg-stone-800"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-400">
            Satuan beli
          </label>
          <select
            value={purchaseUnit}
            onChange={(e) => setPurchaseUnit(e.target.value)}
            className="w-full rounded-btn border border-stone-300 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800"
          >
            {cat.buyUnits.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-400">
            Satuan resep
          </label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full rounded-btn border border-stone-300 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800"
          >
            {ALL_SELL_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <NumField
          label={`Isi konversi — 1 ${purchaseUnit} berapa ${unit}?`}
          value={fillPerBuy}
          onChange={setFillPerBuy}
          suffix={unit}
          decimals
        />
        <p className="mt-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
          1 {purchaseUnit} = {factor > 0 ? factor.toLocaleString("id-ID") : "…"} {unit} — acuan resep
        </p>
      </div>

      <NumField
        label={`Harga beli per ${purchaseUnit}`}
        value={purchasePrice}
        onChange={setPurchasePrice}
        suffix="Rp"
      />

      {hpp > 0 && (
        <p className="rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          HPP = {formatRupiah(price)} ÷ {factor.toLocaleString("id-ID")} {unit} ={" "}
          <span className="font-bold">{formatRupiah(hpp)}/{unit}</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumField label="Stok awal" value={initQty} onChange={setInitQty} suffix={unit} decimals />
        <NumField label="Minimal stok" value={minQty} onChange={setMinQty} suffix={unit} decimals />
      </div>
      <select
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        className="w-full rounded-btn border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800"
      >
        <option value="">— Pilih supplier (opsional) —</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <button
        onClick={submit}
        disabled={pending}
        className="touch-target h-12 w-full rounded-btn bg-brand-600 font-bold text-white disabled:opacity-40"
      >
        {pending ? "Menyimpan…" : "Simpan Bahan"}
      </button>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  suffix,
  decimals = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  decimals?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Numpad memakai DRAFT sendiri yang selalu mulai kosong tiap dibuka —
  // mengetik tidak menyambung angka lama; "Selesai" commit, tutup tanpa
  // Selesai = nilai lama utuh.
  const [draft, setDraft] = useState("");
  const fmt = (v: string) => (v !== "" ? (decimals ? v : `${suffix === "Rp" ? "Rp " : ""}${v}${suffix !== "Rp" ? " " + suffix : ""}`) : "");
  const display = fmt(value);
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-400">{label}</label>
      <button
        type="button"
        onClick={() => {
          setDraft("");
          setOpen(true);
        }}
        className="touch-target w-full rounded-btn border border-stone-300 bg-white px-4 py-3 text-left text-lg font-semibold tabular-nums dark:border-stone-700 dark:bg-stone-800"
      >
        {display || <span className="font-normal text-stone-400">0</span>}
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={label}>
          <div className="space-y-3">
            <div className="rounded-xl bg-stone-100 px-4 py-3 text-right text-2xl font-bold tabular-nums dark:bg-stone-800">
              {draft !== "" ? fmt(draft) : value !== "" ? fmt(value) : "0"}
            </div>
            <Numpad
              value={draft}
              onChange={setDraft}
              decimals={decimals}
              submitLabel="Selesai"
              onSubmit={() => {
                if (draft !== "") onChange(draft);
                setOpen(false);
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdjustForm({
  ingredient,
  mode,
  onDone,
}: {
  ingredient: IngredientView;
  mode: "adjustment" | "waste";
  onDone: () => void;
}) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const value = parseFloat(qty.replace(",", ".")) || 0;
      const res = await adjustStock(ingredient.id, value, mode, note);
      if (res.ok) {
        toast.success(mode === "waste" ? "Waste tercatat" : "Stok disesuaikan");
        onDone();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        {mode === "waste"
          ? `Kurangi stok sebanyak N ${ingredient.unit} (rusak/terbuang).`
          : `Stok saat ini: ${ingredient.stock_qty} ${ingredient.unit}. Masukkan hasil hitung fisik.`}
      </p>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Keterangan (opsional)"
        className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
      />
      <Numpad
        value={qty}
        onChange={setQty}
        decimals
        submitLabel={mode === "waste" ? "Catat Waste" : "Simpan Opname"}
        onSubmit={submit}
        disabled={pending}
      />
    </div>
  );
}

function PurchaseForm({
  ingredients,
  suppliers,
  onDone,
}: {
  ingredients: IngredientView[];
  suppliers: SupplierLite[];
  onDone: () => void;
}) {
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [items, setItems] = useState<{ ingredient_id: string; qty: string; unit_cost: string }[]>([
    { ingredient_id: ingredients[0]?.id ?? "", qty: "", unit_cost: "" },
  ]);
  const [pending, startTransition] = useTransition();

  const hasConversion = (ing: IngredientView | undefined) =>
    !!ing?.purchase_unit && ing.purchase_unit !== ing.unit && ing.conversion_factor > 0;

  // qty input = satuan BELI bila bahan punya konversi; dikonversi ke satuan jual di sini.
  const toSellQty = (item: { ingredient_id: string; qty: string }) => {
    const picked = ingredients.find((g) => g.id === item.ingredient_id);
    const raw = parseFloat(item.qty.replace(",", ".")) || 0;
    if (hasConversion(picked)) {
      return Math.round(raw * picked!.conversion_factor * 1e6) / 1e6;
    }
    return raw;
  };
  // unit_cost input = harga per satuan BELI; action menerima harga per satuan JUAL.
  const toSellCost = (item: { ingredient_id: string; unit_cost: string }) => {
    const picked = ingredients.find((g) => g.id === item.ingredient_id);
    const raw = parseInt(item.unit_cost, 10) || 0;
    if (hasConversion(picked)) return raw / picked!.conversion_factor;
    return raw;
  };

  const total = items.reduce(
    (s, i) =>
      s +
      (hasConversion(ingredients.find((g) => g.id === i.ingredient_id))
        ? (parseFloat(i.qty) || 0) * (parseInt(i.unit_cost, 10) || 0)
        : (parseFloat(i.qty.replace(",", ".")) || 0) * (parseInt(i.unit_cost, 10) || 0)),
    0,
  );

  const submit = () => {
    startTransition(async () => {
      const res = await recordPurchase(
        supplierId || null,
        items.map((i) => ({
          ingredient_id: i.ingredient_id,
          qty: toSellQty(i),
          unit_cost: toSellCost(i),
          line_total: (parseFloat(i.qty.replace(",", ".")) || 0) * (parseInt(i.unit_cost, 10) || 0),
        })),
        note,
        invoiceRef,
      );
      if (res.ok) {
        toast.success("Pembelian tercatat — stok & biaya diperbarui");
        setInvoiceRef("");
        onDone();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  return (
    <div className="space-y-4">
      <select
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
      >
        <option value="">— Tanpa supplier —</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} (lead {s.lead_time_days} hari)
          </option>
        ))}
      </select>

      {items.map((item, idx) => {
        const picked = ingredients.find((g) => g.id === item.ingredient_id);
        return (
        <div key={idx} className="space-y-1">
        {picked && hasConversion(picked) && (
          <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
            1 {picked.purchase_unit} = {picked.conversion_factor.toLocaleString("id-ID")} {picked.unit} — acuan resep
            {item.qty && !isNaN(parseFloat(item.qty.replace(",", ".")))
              ? ` · isi ${item.qty} ${picked.purchase_unit} = ${(parseFloat(item.qty.replace(",", ".")) * picked.conversion_factor).toLocaleString("id-ID")} ${picked.unit}`
              : ""}
          </p>
        )}
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
          <select
            value={item.ingredient_id}
            onChange={(e) => setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, ingredient_id: e.target.value } : x)))}
            className="rounded-btn border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800"
          >
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name} ({ing.unit})
              </option>
            ))}
          </select>
          <input
            value={item.qty}
            onChange={(e) => setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))}
            placeholder={`Qty (${picked && hasConversion(picked) ? picked.purchase_unit : picked?.unit ?? ""})`}
            inputMode="decimal"
            className="rounded-btn border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800"
          />
          <input
            value={item.unit_cost}
            onChange={(e) => setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, unit_cost: e.target.value } : x)))}
            placeholder={picked && hasConversion(picked) ? `Harga/${picked.purchase_unit}` : "Harga/unit"}
            inputMode="numeric"
            className="rounded-btn border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800"
          />
        </div>
        </div>
        );
      })}

      <button
        onClick={() => setItems((arr) => [...arr, { ingredient_id: ingredients[0]?.id ?? "", qty: "", unit_cost: "" }])}
        className="w-full rounded-btn border border-dashed border-stone-300 py-2 text-sm font-semibold text-stone-500 dark:border-stone-700"
      >
        + Tambah baris
      </button>

      <div className="flex justify-between border-t border-dashed border-stone-300 pt-3 font-bold dark:border-stone-700">
        <span>Total</span>
        <span className="tabular-nums">{formatRupiah(total)}</span>
      </div>

      <input
        value={invoiceRef}
        onChange={(e) => setInvoiceRef(e.target.value)}
        placeholder="No. invoice / keterangan supplier (opsional)"
        className="w-full rounded-btn border border-stone-300 px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-800"
      />

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan (opsional)"
        className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
      />

      <button
        onClick={submit}
        disabled={pending}
        className="touch-target h-12 w-full rounded-btn bg-brand-600 font-bold text-white disabled:opacity-40"
      >
        {pending ? "Menyimpan…" : "Simpan Pembelian"}
      </button>
    </div>
  );
}
