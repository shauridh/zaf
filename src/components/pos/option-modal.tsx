"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { useCart } from "@/lib/pos/cart-store";
import { formatRupiah } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { CatalogProduct } from "@/lib/actions/catalog";

export function OptionModal({
  product,
  onClose,
}: {
  product: CatalogProduct | null;
  onClose: () => void;
}) {
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (product) {
      setQty(1);
      setNote("");
      const init: Record<string, string[]> = {};
      for (const g of product.option_groups) {
        // Grup wajib (is_required atau min_select>0) single-select → preselect opsi pertama.
        const mustPick = g.is_required || (g.min_select ?? 0) > 0;
        init[g.id] = mustPick && g.input_type === "single" && g.options[0] ? [g.options[0].id] : [];
      }
      setSelected(init);
    }
  }, [product]);

  const unitTotal = useMemo(() => {
    if (!product) return 0;
    let total = product.price;
    for (const g of product.option_groups) {
      for (const oid of selected[g.id] ?? []) {
        const opt = g.options.find((o) => o.id === oid);
        if (opt) total += opt.price_delta;
      }
    }
    return total;
  }, [product, selected]);

  if (!product) return null;

  const toggle = (groupId: string, optionId: string) => {
    const g = product.option_groups.find((x) => x.id === groupId);
    if (!g) return;
    const mustPick = g.is_required || (g.min_select ?? 0) > 0;
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (g.input_type === "multi") {
        let next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
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

  const validate = (): boolean => {
    for (const g of product.option_groups) {
      const count = (selected[g.id] ?? []).length;
      // Kebutuhan efektif: gabungan is_required (min 1) dan min_select.
      const requiredCount = Math.max(g.min_select ?? 0, g.is_required ? 1 : 0);
      if (count < requiredCount) {
        toast.error(
          requiredCount > 1 ? `${g.name}: pilih minimal ${requiredCount}` : `Pilih ${g.name} dulu`,
        );
        return false;
      }
    }
    return true;
  };

  const addToCart = () => {
    if (!validate()) return;
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
    <Modal open={!!product} onClose={onClose} title={product.name} size="md">
      <div className="space-y-5">
        {product.option_groups.map((g) => (
          <div key={g.id}>
            <p className="mb-2 text-sm font-bold">
              {g.name}
              {g.is_required || g.min_select > 0 ? (
                <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  WAJIB
                </span>
              ) : (
                <span className="ml-1 text-xs font-normal text-stone-400">
                  ({g.input_type === "multi" ? `maks. ${g.max_select ?? "∞"}` : "pilih satu"})
                </span>
              )}
            </p>
            <div className="grid gap-2">
              {g.options.map((o) => {
                const active = (selected[g.id] ?? []).includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggle(g.id, o.id)}
                    className={cn(
                      "touch-target flex items-center justify-between rounded-btn border-2 px-4 py-3 text-left transition active:scale-[0.99]",
                      active
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                        : "border-stone-200 dark:border-stone-700",
                    )}
                  >
                    <span className="font-semibold">{o.name}</span>
                    {o.price_delta > 0 && (
                      <span className="text-sm font-bold text-brand-600">+{formatRupiah(o.price_delta)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <p className="mb-1 text-sm font-bold">Catatan</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="mis. tanpa bawang, sambal dipisah…"
            className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="touch-target size-12 rounded-btn border-2 border-stone-300 text-xl font-bold dark:border-stone-700"
          >
            −
          </button>
          <span className="w-10 text-center text-2xl font-bold tabular-nums">{qty}</span>
          <button
            onClick={() => setQty(qty + 1)}
            className="touch-target size-12 rounded-btn border-2 border-stone-300 text-xl font-bold dark:border-stone-700"
          >
            +
          </button>
        </div>

        <button
          onClick={addToCart}
          className="touch-target h-14 w-full rounded-btn bg-brand-600 text-lg font-bold text-white active:scale-[0.98]"
        >
          Tambah · {formatRupiah(unitTotal * qty)}
        </button>
      </div>
    </Modal>
  );
}
