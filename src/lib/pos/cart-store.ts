"use client";

import { create } from "zustand";
import type { CartLine, CartOption } from "@/lib/pos/cart-math";
import { makeLineKey } from "@/lib/pos/cart-math";
import type { OrderChannel } from "@/lib/types/database";

export interface CartMeta {
  channel: OrderChannel;
  tableLabel: string;
  customerName: string;
  customerPhone: string;
  note: string;
  scheduledAt: string | null; // pre-order ISO
  training: boolean;
}

interface CartState {
  meta: CartMeta;
  lines: CartLine[];
  orderDiscount: number;
  promoId: string | null;
  promoCode: string;
  promoDiscount: number;
  addLine: (line: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  setLineDiscount: (key: string, discount: number) => void;
  setLineNote: (key: string, note: string) => void;
  setMeta: (patch: Partial<CartMeta>) => void;
  setTraining: (on: boolean) => void;
  setOrderDiscount: (amount: number) => void;
  applyPromo: (id: string, code: string, discount: number) => void;
  clearPromo: () => void;
  clear: () => void;
  loadLines: (meta: Partial<CartMeta>, lines: CartLine[]) => void;
}

const DEFAULT_META: CartMeta = {
  channel: "takeaway", // default pesanan baru: bawa pulang (warung fried chicken umumnya take away)
  tableLabel: "",
  customerName: "",
  customerPhone: "",
  note: "",
  scheduledAt: null,
  training: false,
};

export const useCart = create<CartState>((set) => ({
  meta: { ...DEFAULT_META },
  lines: [],
  orderDiscount: 0,
  promoId: null,
  promoCode: "",
  promoDiscount: 0,

  addLine: (line) =>
    set((s) => {
      const key = makeLineKey(
        line.product_id,
        line.options.map((o) => o.option_id),
        line.note,
      );
      const existing = s.lines.find((l) => l.key === key);
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.key === key ? { ...l, qty: l.qty + line.qty, discount: l.discount + line.discount } : l,
          ),
        };
      }
      return { lines: [...s.lines, { ...line, key }] };
    }),

  setQty: (key, qty) =>
    set((s) => ({
      lines:
        qty <= 0
          ? s.lines.filter((l) => l.key !== key)
          : s.lines.map((l) => (l.key === key ? { ...l, qty } : l)),
    })),

  removeLine: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),

  setLineDiscount: (key, discount) =>
    set((s) => ({ lines: s.lines.map((l) => (l.key === key ? { ...l, discount } : l)) })),

  setLineNote: (key, note) =>
    set((s) => ({ lines: s.lines.map((l) => (l.key === key ? { ...l, note } : l)) })),

  setMeta: (patch) => set((s) => ({ meta: { ...s.meta, ...patch } })),

  setTraining: (on) => set((s) => ({ meta: { ...s.meta, training: on } })),

  setOrderDiscount: (amount) => set({ orderDiscount: amount }),

  applyPromo: (id, code, discount) => set({ promoId: id, promoCode: code, promoDiscount: discount }),
  clearPromo: () => set({ promoId: null, promoCode: "", promoDiscount: 0 }),

  clear: () =>
    set({
      meta: { ...DEFAULT_META },
      lines: [],
      orderDiscount: 0,
      promoId: null,
      promoCode: "",
      promoDiscount: 0,
    }),

  loadLines: (meta, lines) => set({ meta: { ...DEFAULT_META, ...meta }, lines }),
}));

export function makeCartOption(o: {
  option_id: string;
  option_group_id: string;
  group_name: string;
  name: string;
  price_delta: number;
}): CartOption {
  return { ...o };
}
