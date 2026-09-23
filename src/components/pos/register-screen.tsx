"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Banknote, CreditCard, Pause, Minus, Percent, Plus, ListOrdered, Tag, Trash2, Wallet } from "lucide-react";
import { loadCatalog, type Catalog, type CatalogProduct } from "@/lib/actions/catalog";
import { useCart } from "@/lib/pos/cart-store";
import {
  computeTotals,
  lineSubtotal,
  unitPrice,
  changeDue,
  makeLineKey,
  type PricingConfig,
} from "@/lib/pos/cart-math";
import { checkoutOrder } from "@/lib/actions/checkout";
import { listHeldOrders, cancelOrder, loadHeldOrder } from "@/lib/actions/orders";
import { formatRupiah } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Numpad } from "@/components/ui/numpad";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { OptionModal } from "@/components/pos/option-modal";
import { OfflineBar, enqueueOfflineOrder } from "@/components/pos/offline-bar";
import { ReceiptView } from "@/components/pos/receipt-view";
import { submitPrint } from "@/lib/printer/print-queue";
import { fetchReceiptPrintData } from "@/lib/printer/receipt-print-data";
import { ShiftControl, ShiftHeaderButtons } from "@/components/pos/shift-panel";
import { useFlags } from "@/components/flags-provider";

const QUICK_CASH = [10000, 20000, 50000, 100000];

const CHANNELS = [
  { id: "dine_in", label: "Makan di Tempat" },
  { id: "takeaway", label: "Bawa Pulang" },
  { id: "delivery", label: "Delivery" },
  { id: "gofood", label: "GoFood" },
  { id: "grabfood", label: "GrabFood" },
  { id: "shopeefood", label: "ShopeeFood" },
] as const;

export function RegisterScreen({
  taxPercent,
  servicePercent,
}: {
  taxPercent: number;
  servicePercent: number;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [optionProduct, setOptionProduct] = useState<CatalogProduct | null>(null);
  const [heldOpen, setHeldOpen] = useState(false);
  const [held, setHeld] = useState<Awaited<ReturnType<typeof listHeldOrders>>>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; number: number } | null>(null);
  const [discOpen, setDiscOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const cart = useCart();
  const flags = useFlags();

  useEffect(() => {
    loadCatalog().then((c) => {
      setCatalog(c);
    });
  }, []);

  const products = useMemo(() => {
    if (!catalog) return [];
    return activeCat === "all"
      ? catalog.products
      : catalog.products.filter((p) => p.category_id === activeCat);
  }, [catalog, activeCat]);

  const totals = useMemo(() => {
    const cfg: PricingConfig = {
      taxPercent,
      servicePercent,
      orderDiscount: cart.orderDiscount,
      promoDiscount: cart.promoDiscount,
      deliveryFee: 0,
      pointsRedeemed: 0,
    };
    return computeTotals(cart.lines, cfg);
  }, [cart.lines, cart.orderDiscount, cart.promoDiscount, taxPercent, servicePercent]);

  const addProduct = (p: CatalogProduct) => {
    if (p.option_groups.length > 0) {
      setOptionProduct(p);
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
  };

  const refreshHeld = () => {
    listHeldOrders().then(setHeld).catch(() => toast.error("Gagal memuat pesanan ditahan"));
  };

  const buildCheckoutInput = (
    payments: Parameters<typeof checkoutOrder>[0]["payments"],
    opts?: { held?: boolean; queueNumber?: boolean },
  ): Parameters<typeof checkoutOrder>[0] => ({
    lines: cart.lines,
    channel: cart.meta.channel,
    tableLabel: cart.meta.tableLabel,
    customerName: cart.meta.customerName,
    customerPhone: cart.meta.customerPhone,
    note: cart.meta.note,
    scheduledAt: cart.meta.scheduledAt,
    orderDiscount: cart.orderDiscount,
    promoId: cart.promoId,
    promoDiscount: cart.promoDiscount,
    deliveryFee: 0,
    pointsRedeemed: 0,
    payments,
    held: opts?.held,
    queueNumber: opts?.queueNumber ?? (cart.meta.channel === "dine_in" || cart.meta.channel === "takeaway"),
    training: cart.meta.training,
    // KDS dimatikan → order langsung selesai + stok BOM terpotong saat checkout
    completeImmediately: opts?.held ? false : !flags.kds,
  });

  const doHold = () => {
    if (cart.lines.length === 0) {
      toast.error("Keranjang kosong — tidak ada yang bisa ditahan");
      return;
    }
    doCheckout(buildCheckoutInput([], { held: true, queueNumber: false }));
  };

  const doCheckout = (input: Parameters<typeof checkoutOrder>[0]) => {
    startTransition(async () => {
      // Offline: masukkan antrean lokal, sync otomatis saat online
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueOfflineOrder(input);
        toast.info("OFFLINE — order masuk antrean, sinkron otomatis saat online");
        setPayOpen(false);
        setHeldOpen(false);
        cart.clear();
        return;
      }
      const res = await checkoutOrder(input);
      if (res.ok) {
        toast.success(
          `Order #${res.orderNumber} tersimpan${res.queueNumber ? ` · antrean ${res.queueNumber}` : ""}`,
        );
        for (const a of res.lowStockAlerts ?? []) {
          toast.warning(
            a.remaining <= 0
              ? `⚠️ ${a.name} HABIS — sisa ${a.remaining} ${a.unit} (min ${a.min})`
              : `⚠️ Stok menipis: ${a.name} sisa ${a.remaining} ${a.unit} (min ${a.min})`,
          );
        }
        setPayOpen(false);
        setHeldOpen(false);
        cart.clear();
        if (res.orderId) setReceipt({ id: res.orderId, number: res.orderNumber ?? 0 });
      } else {
        toast.error(res.error ?? "Checkout gagal");
      }
    });
  };

  // Cetak struk via antrean printer (gagal → job tetap di antrean, retry otomatis).
  const printReceiptNow = async () => {
    if (!receipt) return;
    try {
      const data = await fetchReceiptPrintData(receipt.id);
      const r = await submitPrint("receipt", `Struk #${receipt.number}`, data);
      if (r.printed) toast.success("Struk tercetak ✓");
      else toast.info(`Printer belum terhubung — struk masuk antrean cetak (${r.queued})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal cetak struk");
    }
  };

  if (!catalog) {
    return <div className="flex h-full items-center justify-center text-stone-400">Memuat katalog…</div>;
  }

  return (
    <ShiftControl
      render={({ hasShift, openCashModal, openCloseModal }) => (
        <div className="flex h-full min-h-0">
          <OfflineBar />

      {/* Katalog */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-stone-200 p-3 dark:border-stone-800">
          <button
            onClick={() => setActiveCat("all")}
            className={cn(
              "touch-target shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
              activeCat === "all"
                ? "bg-brand-600 text-white"
                : "bg-white text-stone-600 dark:bg-stone-800 dark:text-stone-300",
            )}
          >
            Semua
          </button>
          {catalog.categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={cn(
                "touch-target shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
                activeCat === c.id
                  ? "bg-brand-600 text-white"
                  : "bg-white text-stone-600 dark:bg-stone-800 dark:text-stone-300",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid flex-1 auto-rows-min grid-cols-2 content-start gap-3 overflow-y-auto p-3 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => addProduct(p)}
              className="card touch-target overflow-hidden p-0 text-left transition active:scale-[0.97] hover:border-brand-400"
            >
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.name}
                  loading="lazy"
                  className="aspect-[4/3] w-full bg-stone-100 object-contain dark:bg-stone-800"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-stone-100 text-3xl dark:bg-stone-800">
                  🍗
                </div>
              )}
              <div className="p-3">
                <span className="block truncate text-sm font-semibold leading-tight">{p.name}</span>
                <span className="text-xs text-stone-500 dark:text-stone-400">{formatRupiah(p.price)}</span>
              </div>
            </button>
          ))}
          {products.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-stone-400">
              Tidak ada produk di kategori ini.
            </p>
          )}
        </div>
      </section>

      {/* Keranjang */}
      <aside className="hidden w-96 shrink-0 flex-col border-l border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 md:flex">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
          <h2 className="font-bold">Pesanan</h2>
          <div className="flex gap-1">
            <ShiftHeaderButtons hasShift={hasShift} onCash={openCashModal} onClose={openCloseModal} />
            <button
              onClick={() => { refreshHeld(); setHeldOpen(true); }}
              title="Pesanan ditahan"
              className="touch-target rounded-lg p-2 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <ListOrdered className="size-5" />
            </button>
            <button
              onClick={() => setMetaOpen(true)}
              title="Info pesanan"
              className="touch-target rounded-lg p-2 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <Wallet className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {cart.lines.length === 0 ? (
            <p className="py-16 text-center text-sm text-stone-400">Keranjang kosong</p>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {cart.lines.map((l) => (
                <li key={l.key} className="flex items-start gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.name}</p>
                    {l.options.map((o) => (
                      <p key={o.option_id} className="text-xs text-stone-500">
                        + {o.name}
                      </p>
                    ))}
                    {l.note && <p className="text-xs italic text-amber-600">“{l.note}”</p>}
                    <p className="mt-0.5 text-sm font-medium">{formatRupiah(lineSubtotal(l))}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => cart.setQty(l.key, l.qty - 1)}
                      className="touch-target rounded-lg border border-stone-300 p-1 dark:border-stone-700"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold tabular-nums">{l.qty}</span>
                    <button
                      onClick={() => cart.setQty(l.key, l.qty + 1)}
                      className="touch-target rounded-lg border border-stone-300 p-1 dark:border-stone-700"
                    >
                      <Plus className="size-4" />
                    </button>
                    <button
                      onClick={() => cart.removeLine(l.key)}
                      className="touch-target rounded-lg p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-stone-200 p-4 dark:border-stone-800">
          <div className="flex justify-between text-sm text-stone-500">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatRupiah(totals.subtotal)}</span>
          </div>
          {(totals.promoDiscount > 0 || cart.promoCode) && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Promo {cart.promoCode}</span>
              <span className="tabular-nums">−{formatRupiah(totals.promoDiscount)}</span>
            </div>
          )}
          {totals.orderDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Diskon</span>
              <span className="tabular-nums">−{formatRupiah(totals.orderDiscount)}</span>
            </div>
          )}
          {totals.tax > 0 && (
            <div className="flex justify-between text-sm text-stone-500">
              <span>Pajak</span>
              <span className="tabular-nums">{formatRupiah(totals.tax)}</span>
            </div>
          )}
          {totals.serviceCharge > 0 && (
            <div className="flex justify-between text-sm text-stone-500">
              <span>Service</span>
              <span className="tabular-nums">{formatRupiah(totals.serviceCharge)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-dashed border-stone-300 pt-2 text-lg font-bold dark:border-stone-700">
            <span>Total</span>
            <span className="tabular-nums">{formatRupiah(totals.total)}</span>
          </div>

          {flags.promotions ? (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => setDiscOpen(true)}
                className="touch-target flex items-center justify-center gap-1 rounded-btn border border-stone-300 py-2 text-xs font-semibold dark:border-stone-700"
              >
                <Percent className="size-4" /> Diskon
              </button>
              <button
                onClick={() => setPromoOpen(true)}
                className="touch-target flex items-center justify-center gap-1 rounded-btn border border-stone-300 py-2 text-xs font-semibold dark:border-stone-700"
              >
                <Tag className="size-4" /> Promo
              </button>
              <button
                onClick={doHold}
                disabled={cart.lines.length === 0}
                className="touch-target flex items-center justify-center gap-1 rounded-btn border border-stone-300 py-2 text-xs font-semibold disabled:opacity-40 dark:border-stone-700"
              >
                <Pause className="size-4" /> Tahan
              </button>
            </div>
          ) : (
            <button
              onClick={doHold}
              disabled={cart.lines.length === 0}
              className="touch-target mt-1 w-full rounded-btn border border-stone-300 py-2 text-xs font-semibold disabled:opacity-40 dark:border-stone-700"
            >
              <Pause className="mr-1 inline size-4" /> Tahan
            </button>
          )}

          <button
            disabled={cart.lines.length === 0}
            onClick={() => setPayOpen(true)}
            className="touch-target h-14 w-full rounded-btn bg-brand-600 text-lg font-bold text-white shadow transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-40"
          >
            Bayar · {formatRupiah(totals.total)}
          </button>
        </div>
      </aside>

      {/* Mobile: bar bawah */}
      {cart.lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-stone-200 bg-white/95 p-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95 md:hidden">
          <button
            onClick={() => setPayOpen(true)}
            className="touch-target h-12 w-full rounded-btn bg-brand-600 font-bold text-white"
          >
            Bayar · {formatRupiah(totals.total)} ({cart.lines.length} item)
          </button>
        </div>
      )}

      <OptionModal product={optionProduct} onClose={() => setOptionProduct(null)} />

      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Struk" size="md">
        {receipt && (
          <div className="space-y-3">
            <div className="max-h-[55vh] overflow-y-auto rounded-btn border border-stone-200 dark:border-stone-800">
              <ReceiptView orderId={receipt.id} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={printReceiptNow}
                className="touch-target rounded-btn bg-brand-600 py-3 font-bold text-white active:scale-[0.98]"
              >
                Cetak Struk
              </button>
              <button
                onClick={() => setReceipt(null)}
                className="touch-target rounded-btn border-2 border-stone-300 py-3 font-bold dark:border-stone-700"
              >
                Selesai
              </button>
            </div>
          </div>
        )}
      </Modal>

      <OrderMetaModal open={metaOpen} onClose={() => setMetaOpen(false)} />

      <Modal open={discOpen} onClose={() => setDiscOpen(false)} title="Diskon Order">
        <OrderDiscountForm
          subtotal={totals.subtotal}
          current={cart.orderDiscount}
          onApply={(amount) => { cart.setOrderDiscount(amount); setDiscOpen(false); }}
        />
      </Modal>

      <Modal open={promoOpen} onClose={() => setPromoOpen(false)} title="Kode Promo">
        <PromoForm
          subtotal={totals.subtotal}
          lines={cart.lines.map((l) => ({ product_id: l.product_id, qty: l.qty, unit_price: unitPrice(l) }))}
          onApply={(id, code, discount) => {
            cart.applyPromo(id, code, discount);
            setPromoOpen(false);
          }}
        />
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Pembayaran" size="lg">
        <PaymentPanel
          total={totals.total}
          pending={pending}
          onCashPaid={(paid) => doCheckout(buildCheckoutInput([{ method: "cash", amount: paid }]))}
          onNonCash={(method, reference) =>
            doCheckout(buildCheckoutInput([{ method, amount: totals.total, reference }]))
          }
          onHold={doHold}
        />
      </Modal>

      <Modal open={heldOpen} onClose={() => setHeldOpen(false)} title="Pesanan Ditahan" size="lg">
        <div className="space-y-2">
          {held.length === 0 && <p className="py-8 text-center text-sm text-stone-400">Tidak ada pesanan ditahan.</p>}
          {held.map((o) => (
            <div key={o.id} className="card flex items-center justify-between p-3">
              <div>
                <p className="font-semibold">
                  #{o.order_number} {o.table_label ? `· Meja ${o.table_label}` : ""} {o.customer_name ? `· ${o.customer_name}` : ""}
                </p>
                <p className="text-xs text-stone-500">
                  {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                </p>
                <p className="text-sm font-bold">{formatRupiah(o.total)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const res = await loadHeldOrder(o.id);
                    if (res.ok && res.order) {
                      const lines = (res.order.items as unknown as Array<{
                        product_id?: string; name: string; qty: number; unit_price?: number; subtotal?: number;
                      }>).map((i) => ({
                        key: makeLineKey(i.product_id ?? i.name, [], ""),
                        product_id: i.product_id ?? "",
                        name: i.name,
                        base_price: i.unit_price ?? i.subtotal ?? 0,
                        qty: i.qty,
                        options: [],
                        note: "",
                        discount: 0,
                      }));
                      cart.loadLines(
                        { channel: o.channel as never, tableLabel: o.table_label ?? "", customerName: o.customer_name ?? "" },
                        lines,
                      );
                      await cancelOrder(o.id, "dilanjutkan ke kasir").catch(() => undefined);
                      setHeldOpen(false);
                      refreshHeld();
                    }
                  }}
                  className="touch-target rounded-btn bg-brand-600 px-4 py-2 text-sm font-bold text-white"
                >
                  Lanjutkan
                </button>
                <button
                  onClick={async () => {
                    const res = await cancelOrder(o.id, "dibatalkan kasir");
                    if (res.ok) { toast.success("Dibatalkan"); refreshHeld(); }
                    else toast.error(res.error ?? "Gagal");
                  }}
                  className="touch-target rounded-btn border border-red-300 px-4 py-2 text-sm font-semibold text-red-600"
                >
                  Batal
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
        </div>
      )}
    />
  );
}

function OrderDiscountForm({
  subtotal,
  current,
  onApply,
}: {
  subtotal: number;
  current: number;
  onApply: (amount: number) => void;
}) {
  const [draft, setDraft] = useState(current ? String(current) : "");
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">Subtotal: {formatRupiah(subtotal)}</p>
      <div className="rounded-xl bg-stone-100 px-4 py-3 text-right text-2xl font-bold tabular-nums dark:bg-stone-800">
        {draft ? formatRupiah(parseInt(draft, 10) || 0) : "Rp0"}
      </div>
      <Numpad
        value={draft}
        onChange={setDraft}
        quickAmounts={[5000, 10000, 20000]}
        submitLabel="Terapkan"
        onSubmit={() => onApply(Math.min(parseInt(draft, 10) || 0, subtotal))}
      />
    </div>
  );
}

function PromoForm({
  subtotal,
  lines,
  onApply,
}: {
  subtotal: number;
  lines: { product_id: string; qty: number; unit_price: number }[];
  onApply: (id: string, code: string, discount: number) => void;
}) {
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const { validatePromoCodeAction } = await import("@/lib/actions/promo-validate");
      const res = await validatePromoCodeAction(code, subtotal, lines);
      if (res.ok) {
        toast.success(`Promo diterapkan: −${formatRupiah(res.discount)}`);
        onApply(res.promoId!, code, res.discount);
      } else {
        toast.error(res.error ?? "Promo tidak valid");
      }
    });
  };

  return (
    <div className="space-y-4">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="KODE PROMO"
        className="w-full rounded-btn border border-stone-300 px-4 py-3 text-lg font-bold uppercase tracking-widest dark:border-stone-700 dark:bg-stone-800"
      />
      <button
        onClick={submit}
        disabled={pending || !code}
        className="touch-target h-12 w-full rounded-btn bg-brand-600 font-bold text-white disabled:opacity-40"
      >
        {pending ? "Memeriksa…" : "Terapkan"}
      </button>
    </div>
  );
}

function OrderMetaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cart = useCart();
  const [channel, setChannel] = useState(cart.meta.channel);
  const [table, setTable] = useState(cart.meta.tableLabel);
  const [training, setTraining] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(cart.meta.scheduledAt ?? "");

  useEffect(() => {
    if (open) {
      setChannel(cart.meta.channel);
      setTable(cart.meta.tableLabel);
      setScheduledAt(cart.meta.scheduledAt ?? "");
    }
  }, [open, cart.meta.channel, cart.meta.tableLabel, cart.meta.scheduledAt]);

  return (
    <Modal open={open} onClose={onClose} title="Info Pesanan">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-stone-600 dark:text-stone-400">Kanal pesanan</p>
          <div className="grid grid-cols-3 gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                className={cn(
                  "touch-target rounded-btn border-2 py-3 text-sm font-bold",
                  channel === c.id
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10"
                    : "border-stone-200 dark:border-stone-700",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-stone-400">
            Order marketplace masuk dari sini — fee dicatat di Keuangan via halaman Kanal Online.
          </p>
        </div>
        {channel === "dine_in" && (
          <input
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder="Nomor meja (opsional)"
            className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
          />
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-400">
            Pre-order — jadwal ambil (opsional)
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
          />
        </div>
        <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm dark:bg-amber-500/10">
          <input
            type="checkbox"
            checked={training}
            onChange={(e) => setTraining(e.target.checked)}
            className="size-4 accent-amber-600"
          />
          <span>
            <strong>Mode latihan</strong> — order tak masuk laporan &amp; kas
          </span>
        </label>
        <button
          onClick={() => {
            cart.setMeta({
              channel,
              tableLabel: table,
              scheduledAt: scheduledAt || null,
            });
            cart.setTraining(training);
            onClose();
          }}
          className="touch-target h-12 w-full rounded-btn bg-brand-600 font-bold text-white"
        >
          Simpan
        </button>
      </div>
    </Modal>
  );
}

function PaymentPanel({
  total,
  pending,
  onCashPaid,
  onNonCash,
  onHold,
}: {
  total: number;
  pending: boolean;
  onCashPaid: (paid: number) => void;
  onNonCash: (method: "qris" | "debit" | "transfer", reference?: string) => void;
  onHold: () => void;
}) {
  const [mode, setMode] = useState<"select" | "cash" | "noncash">("select");
  const [paid, setPaid] = useState("");
  const due = changeDue(parseInt(paid, 10) || 0, total);

  if (mode === "cash") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-xl bg-stone-100 p-4 dark:bg-stone-800">
            <p className="text-xs uppercase tracking-wide text-stone-500">Total tagihan</p>
            <p className="text-2xl font-bold">{formatRupiah(total)}</p>
          </div>
          <div className="rounded-xl bg-stone-100 p-4 dark:bg-stone-800">
            <p className="text-xs uppercase tracking-wide text-stone-500">Kembalian</p>
            <p className={cn("text-2xl font-bold tabular-nums", due > 0 ? "text-green-600" : "text-stone-400")}>
              {formatRupiah(due)}
            </p>
          </div>
          <button
            disabled={pending || (parseInt(paid, 10) || 0) < total}
            onClick={() => onCashPaid(parseInt(paid, 10) || 0)}
            className="touch-target h-12 w-full rounded-btn bg-brand-600 font-bold text-white disabled:opacity-40"
          >
            {pending ? "Menyimpan…" : "Selesaikan"}
          </button>
          <button onClick={() => setMode("select")} className="w-full py-1 text-sm text-stone-500 hover:underline">
            Kembali
          </button>
        </div>
        <div className="space-y-2">
          <div className="rounded-xl bg-stone-100 px-4 py-3 text-right text-xl font-bold tabular-nums dark:bg-stone-800">
            {paid ? formatRupiah(parseInt(paid, 10)) : "Rp0"}
          </div>
          <Numpad value={paid} onChange={setPaid} quickAmounts={QUICK_CASH} exactAmount={total} />
        </div>
      </div>
    );
  }

  if (mode === "noncash") {
    return <NonCashForm total={total} pending={pending} onSubmit={onNonCash} onBack={() => setMode("select")} />;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode("cash")}
          className="card flex flex-col items-center gap-2 py-6 text-center transition hover:border-brand-400 active:scale-[0.98]"
        >
          <Banknote className="size-8 text-brand-600" />
          <span className="font-bold">Tunai</span>
        </button>
        <button
          onClick={() => setMode("noncash")}
          className="card flex flex-col items-center gap-2 py-6 text-center transition hover:border-brand-400 active:scale-[0.98]"
        >
          <CreditCard className="size-8 text-brand-600" />
          <span className="font-bold">QRIS / Debit / Transfer</span>
        </button>
      </div>
      <button onClick={onHold} disabled={pending} className="w-full py-2 text-sm font-semibold text-stone-500 hover:underline">
        Tahan pesanan (bayar nanti)
      </button>
    </div>
  );
}

function NonCashForm({
  total,
  pending,
  onSubmit,
  onBack,
}: {
  total: number;
  pending: boolean;
  onSubmit: (method: "qris" | "debit" | "transfer", reference?: string) => void;
  onBack: () => void;
}) {
  const [method, setMethod] = useState<"qris" | "debit" | "transfer">("qris");
  const [reference, setReference] = useState("");
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-stone-100 p-4 text-center dark:bg-stone-800">
        <p className="text-xs uppercase tracking-wide text-stone-500">Total</p>
        <p className="text-2xl font-bold">{formatRupiah(total)}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["qris", "debit", "transfer"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={cn(
              "touch-target rounded-btn border-2 py-3 text-sm font-bold uppercase",
              method === m ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10" : "border-stone-200 dark:border-stone-700",
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Nomor referensi / approval code (opsional)"
        className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
      />
      <div className="flex gap-2">
        <button onClick={onBack} className="touch-target flex-1 rounded-btn border border-stone-300 py-3 font-semibold dark:border-stone-700">
          Kembali
        </button>
        <button
          onClick={() => onSubmit(method, reference || undefined)}
          disabled={pending}
          className="touch-target flex-1 rounded-btn bg-brand-600 py-3 font-bold text-white disabled:opacity-40"
        >
          {pending ? "Menyimpan…" : "Konfirmasi"}
        </button>
      </div>
    </div>
  );
}
