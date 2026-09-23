"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useCart } from "@/lib/pos/cart-store";
import type { CatalogGroup } from "@/lib/actions/catalog";
import { formatRupiah } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface ProductLite {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category_id: string;
  hasOptions: boolean;
  optionGroups: CatalogGroup[];
}

export function PortalMenuClient({
  categories,
  products,
}: {
  categories: { id: string; name: string }[];
  products: ProductLite[];
}) {
  const cart = useCart();
  const [activeCat, setActiveCat] = useState<string>("all");
  const [optionProduct, setOptionProduct] = useState<ProductLite & { option_groups: CatalogGroup[] } | null>(null);

  const visible = useMemo(
    () => (activeCat === "all" ? products : products.filter((p) => p.category_id === activeCat)),
    [products, activeCat],
  );

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCat("all")}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
            activeCat === "all" ? "bg-brand-600 text-white" : "bg-white text-stone-600 dark:bg-stone-800 dark:text-stone-300",
          )}
        >
          Semua
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
              activeCat === c.id ? "bg-brand-600 text-white" : "bg-white text-stone-600 dark:bg-stone-800 dark:text-stone-300",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {visible.map((p) => (
          <li key={p.id} className="card flex items-center gap-3 p-3">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt={p.name}
                loading="lazy"
                className="size-20 shrink-0 rounded-xl bg-stone-100 object-cover dark:bg-stone-800"
              />
            ) : (
              <span className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-2xl dark:bg-stone-800">
                🍗
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold">{p.name}</p>
              <p className="truncate text-xs text-stone-500">{p.description}</p>
              <p className="mt-1 text-sm font-bold text-brand-600">{formatRupiah(p.price)}</p>
            </div>
            <button
              onClick={() => {
                if (p.hasOptions) {
                  setOptionProduct({ ...p, option_groups: p.optionGroups });
                } else {
                  cart.addLine({
                    product_id: p.id,
                    name: p.name,
                    base_price: p.price,
                    qty: 1,
                    options: [],
                    note: "",
                    discount: 0,
                  });
                }
              }}
              className="touch-target flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white active:scale-90"
              aria-label={`Tambah ${p.name}`}
            >
              <Plus className="size-5" />
            </button>
          </li>
        ))}
      </ul>

      {/* Modal opsi reuse kasir — product minimal shape */}
      {optionProduct && (
        <PortalOptionModal
          product={{
            id: optionProduct.id,
            name: optionProduct.name,
            price: optionProduct.price,
            option_groups: optionProduct.optionGroups,
          }}
          onClose={() => setOptionProduct(null)}
        />
      )}
    </div>
  );
}

// Wrapper agar OptionModal (menerima CatalogProduct) bisa dipakai dengan shape ringkas.
import { Modal } from "@/components/ui/modal";
import { useEffect } from "react";
import { toast } from "@/components/ui/toast";

interface MinimalProduct {
  id: string;
  name: string;
  price: number;
  option_groups: CatalogGroup[];
}

function PortalOptionModal({ product, onClose }: { product: MinimalProduct; onClose: () => void }) {
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const init: Record<string, string[]> = {};
    for (const g of product.option_groups) {
      // Grup wajib (is_required atau min_select>0) single-select → preselect opsi pertama.
      const mustPick = g.is_required || (g.min_select ?? 0) > 0;
      init[g.id] = mustPick && g.input_type === "single" && g.options[0] ? [g.options[0].id] : [];
    }
    setSelected(init);
  }, [product]);

  const unitTotal = product.price + product.option_groups.reduce(
    (sum, g) => sum + (selected[g.id] ?? []).reduce((s, oid) => s + (g.options.find((o) => o.id === oid)?.price_delta ?? 0), 0),
    0,
  );

  const toggle = (groupId: string, optionId: string) => {
    const g = product.option_groups.find((x) => x.id === groupId);
    if (!g) return;
    const mustPick = g.is_required || (g.min_select ?? 0) > 0;
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (g.input_type === "multi") {
        let next = current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId];
        if (g.max_select != null && next.length > g.max_select) next = next.slice(0, g.max_select);
        return { ...prev, [groupId]: next };
      }
      // Single-select: grup wajib tidak boleh dikosongkan (klik terpilih = tetap).
      if (current.includes(optionId)) {
        return mustPick ? prev : { ...prev, [groupId]: [] };
      }
      return { ...prev, [groupId]: [optionId] };
    });
  };

  const add = () => {
    for (const g of product.option_groups) {
      // Kebutuhan efektif: gabungan is_required (min 1) dan min_select.
      const requiredCount = Math.max(g.min_select ?? 0, g.is_required ? 1 : 0);
      if ((selected[g.id] ?? []).length < requiredCount) {
        toast.error(
          requiredCount > 1 ? `${g.name}: pilih minimal ${requiredCount}` : `Pilih ${g.name} dulu`,
        );
        return;
      }
    }
    const options = product.option_groups.flatMap((g) =>
      (selected[g.id] ?? []).map((oid) => {
        const opt = g.options.find((o) => o.id === oid)!;
        return {
          option_id: opt.id,
          option_group_id: g.id,
          group_name: g.name,
          name: opt.name,
          price_delta: opt.price_delta,
        };
      }),
    );
    cart.addLine({
      product_id: product.id,
      name: product.name,
      base_price: product.price,
      qty,
      options,
      note,
      discount: 0,
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={product.name}>
      <div className="space-y-5">
        {product.option_groups.map((g) => (
          <div key={g.id}>
            <p className="mb-2 text-sm font-bold">
              {g.name} {g.is_required && <span className="text-xs text-red-500">wajib</span>}
            </p>
            <div className="grid gap-2">
              {g.options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => toggle(g.id, o.id)}
                  className={cn(
                    "touch-target flex items-center justify-between rounded-btn border-2 px-4 py-3 text-left",
                    (selected[g.id] ?? []).includes(o.id)
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                      : "border-stone-200 dark:border-stone-700",
                  )}
                >
                  <span className="font-semibold">{o.name}</span>
                  {o.price_delta > 0 && <span className="text-sm font-bold text-brand-600">+{formatRupiah(o.price_delta)}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
        />
        <div className="flex items-center gap-3">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="touch-target size-11 rounded-btn border-2 border-stone-300 text-xl font-bold dark:border-stone-700">−</button>
          <span className="w-8 text-center text-xl font-bold">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="touch-target size-11 rounded-btn border-2 border-stone-300 text-xl font-bold dark:border-stone-700">+</button>
        </div>
        <button onClick={add} className="touch-target h-13 w-full rounded-btn bg-brand-600 py-3.5 text-lg font-bold text-white">
          Tambah · {formatRupiah(unitTotal * qty)}
        </button>
      </div>
    </Modal>
  );
}
