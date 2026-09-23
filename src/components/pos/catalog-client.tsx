"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ChefHat, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  listIngredientsForRecipe,
  removeProductImage,
  setProductActive,
  uploadProductImage,
  upsertProduct,
  type ProductWithCost,
} from "@/lib/actions/products";
import { listRecipes, setRecipeLine, type RecipeLineView } from "@/lib/actions/inventory";
import {
  createOption,
  createOptionGroup,
  deleteOption,
  deleteOptionGroup,
  getProductOptionGroupIds,
  listOptionGroups,
  setProductOptionGroups,
  updateOption,
  updateOptionGroup,
  type OptionGroupView,
} from "@/lib/actions/options";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toast";
import { formatRupiah } from "@/lib/utils/format";
import { compressImageFile } from "@/lib/utils/image";
import { cn } from "@/lib/utils/cn";

export function CatalogClient({
  products,
  categories,
}: {
  products: ProductWithCost[];
  categories: { id: string; name: string }[];
}) {
  const [prodModal, setProdModal] = useState<null | "new" | ProductWithCost>(null);
  const [recipeFor, setRecipeFor] = useState<ProductWithCost | null>(null);
  const [optionsFor, setOptionsFor] = useState<ProductWithCost | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setProdModal("new")}
          className="touch-target flex items-center gap-2 rounded-btn bg-brand-600 px-4 py-2 text-sm font-bold text-white"
        >
          <Plus className="size-4" /> Produk Baru
        </button>
      </div>

      <section className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase text-stone-400 dark:border-stone-800">
              <th className="p-3">Produk</th>
              <th className="p-3">Kategori</th>
              <th className="p-3">Harga</th>
              <th className="p-3">HPP</th>
              <th className="p-3">Margin</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-stone-100 dark:border-stone-800">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt=""
                        loading="lazy"
                        className="size-11 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-lg dark:bg-stone-800">
                        🍗
                      </span>
                    )}
                    <span className={cn("font-semibold", !p.is_active && "opacity-40 line-through")}>{p.name}</span>
                  </div>
                </td>
                <td className="p-3 text-stone-500">{p.category_name}</td>
                <td className="p-3 tabular-nums">{formatRupiah(p.price)}</td>
                <td className="p-3 tabular-nums">{formatRupiah(p.cost)}</td>
                <td className={cn("p-3 font-bold tabular-nums", p.margin_percent < 30 ? "text-red-500" : "text-green-600")}>
                  {formatRupiah(p.margin)} ({p.margin_percent}%)
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setRecipeFor(p)}
                      title="Resep BOM"
                      className="touch-target rounded-lg border border-stone-300 p-2 dark:border-stone-700"
                    >
                      <ChefHat className="size-4" />
                    </button>
                    <button
                      onClick={() => setOptionsFor(p)}
                      title="Opsi Menu"
                      className="touch-target rounded-lg border border-stone-300 p-2 dark:border-stone-700"
                    >
                      <SlidersHorizontal className="size-4" />
                    </button>
                    <button
                      onClick={() => setProdModal(p)}
                      title="Edit"
                      className="touch-target rounded-lg border border-stone-300 p-2 dark:border-stone-700"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={async () => {
                        const res = await setProductActive(p.id, !p.is_active);
                        if (res.ok) window.location.reload();
                        else toast.error(res.error ?? "Gagal");
                      }}
                      className="touch-target rounded-lg border border-stone-300 px-2 py-2 text-xs font-semibold dark:border-stone-700"
                    >
                      {p.is_active ? "Arsip" : "Aktifkan"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Modal
        open={prodModal !== null}
        onClose={() => setProdModal(null)}
        title={
          prodModal && prodModal !== "new" ? `Edit — ${prodModal.name}` : "Produk Baru"
        }
      >
        {prodModal && (
          <ProductForm
            product={prodModal === "new" ? null : prodModal}
            categories={categories}
            onDone={() => {
              setProdModal(null);
              window.location.reload();
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!optionsFor}
        onClose={() => setOptionsFor(null)}
        title={`Opsi Menu — ${optionsFor?.name ?? ""}`}
        size="lg"
      >
        {optionsFor && (
          <OptionsEditor productId={optionsFor.id} productName={optionsFor.name} />
        )}
      </Modal>

      <Modal
        open={!!recipeFor}
        onClose={() => setRecipeFor(null)}
        title={`Resep BOM — ${recipeFor?.name ?? ""}`}
        size="lg"
      >
        {recipeFor && (
          <RecipeEditor
            productId={recipeFor.id}
            onDone={() => {
              setRecipeFor(null);
              window.location.reload();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function ProductForm({
  product,
  categories,
  onDone,
}: {
  product: ProductWithCost | null;
  categories: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? "");
  const [price, setPrice] = useState(product?.price ?? 0);
  const [trackStock, setTrackStock] = useState(true);
  const [pending, startTransition] = useTransition();

  // Foto: null = tanpa perubahan; dataUrl = foto baru terpilih (sudah terkompres 4:3).
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [removingPhoto, startRemovePhoto] = useTransition();
  const photoPreview = photoRemoved ? null : (photo ?? product?.image_url ?? null);

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error("Hanya JPG, PNG, atau WebP");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Ukuran file terlalu besar (maks 25 MB)");
      return;
    }
    setProcessingPhoto(true);
    compressImageFile(file)
      .then((dataUrl) => {
        setPhoto(dataUrl);
        setPhotoRemoved(false);
      })
      .catch(() => toast.error("Gambar tidak dapat diproses"))
      .finally(() => setProcessingPhoto(false));
  };

  const doRemovePhoto = () => {
    if (!product?.id) {
      // Produk baru belum punya foto tersimpan — cukup reset pilihan lokal.
      setPhoto(null);
      setPhotoRemoved(false);
      return;
    }
    startRemovePhoto(async () => {
      const res = await removeProductImage(product.id);
      if (res.ok) {
        setPhoto(null);
        setPhotoRemoved(true);
        toast.success("Foto dihapus");
        window.location.reload();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  const submit = () => {
    if (!name.trim() || price <= 0) {
      toast.error("Nama & harga wajib");
      return;
    }
    startTransition(async () => {
      const res = await upsertProduct({
        id: product?.id,
        name: name.trim(),
        category_id: categoryId,
        price,
        track_stock: trackStock,
        is_active: true,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Gagal");
        return;
      }
      if (photo && res.id) {
        const up = await uploadProductImage(res.id, photo);
        if (!up.ok) {
          toast.error(up.error ?? "Produk tersimpan, tapi foto gagal diupload");
          return;
        }
      }
      toast.success("Produk tersimpan");
      onDone();
    });
  };

  return (
    <div className="space-y-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama produk"
        className="w-full rounded-btn border border-stone-300 px-4 py-3 font-semibold dark:border-stone-700 dark:bg-stone-800"
      />
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <MoneyInput label="Harga jual" value={price} onChange={setPrice} />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Foto produk</p>
          <div className="flex items-center gap-2">
            {processingPhoto && <span className="text-xs text-stone-400">Mengompres…</span>}
            {photoPreview && !processingPhoto && (
              <button
                onClick={doRemovePhoto}
                disabled={removingPhoto}
                className="rounded-lg px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10"
              >
                {removingPhoto ? "Menghapus…" : "Hapus foto"}
              </button>
            )}
          </div>
        </div>
        <label className="relative block cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-700">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
              alt="Pratinjau foto produk"
              className="aspect-[4/3] w-full bg-stone-100 object-cover dark:bg-stone-800"
            />
          ) : (
            <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-stone-50 text-stone-400 dark:bg-stone-800/60">
              <span className="text-4xl">{processingPhoto ? "⏳" : "📷"}</span>
              <span className="text-sm font-semibold">
                {processingPhoto ? "Mengompres & crop 4:3…" : "Ketuk untuk pilih foto"}
              </span>
              {!processingPhoto && <span className="text-xs">JPG/PNG/WebP · otomatis dikompres & crop 4:3</span>}
            </span>
          )}
          {photoPreview && !processingPhoto && (
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white">
              📷 Ganti foto
            </span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={trackStock}
          onChange={(e) => setTrackStock(e.target.checked)}
          className="size-4 accent-brand-600"
        />
        Track stok (kurangi bahan otomatis via resep)
      </label>
      <button
        onClick={submit}
        disabled={pending}
        className="touch-target h-12 w-full rounded-btn bg-brand-600 font-bold text-white disabled:opacity-40"
      >
        {pending ? "Menyimpan…" : "Simpan Produk"}
      </button>
    </div>
  );
}

function RecipeEditor({ productId, onDone }: { productId: string; onDone: () => void }) {
  const [lines, setLines] = useState<RecipeLineView[] | null>(null);
  const [ingredients, setIngredients] = useState<{ id: string; name: string; unit: string }[]>([]);
  const [pending, startTransition] = useTransition();

  const [addId, setAddId] = useState("");
  const [addQty, setAddQty] = useState("");

  useEffect(() => {
    listRecipes(productId).then(setLines).catch(() => setLines([]));
    listIngredientsForRecipe().then(setIngredients);
  }, [productId]);

  const save = (ingredientId: string, qty: number) => {
    startTransition(async () => {
      const res = await setRecipeLine(productId, ingredientId, qty, []);
      if (res.ok) {
        toast.success("Resep diperbarui");
        listRecipes(productId).then(setLines);
      } else toast.error(res.error ?? "Gagal");
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        HPP = Σ (qty bahan × biaya moving-average). Resep dipakai untuk mengurangi stok otomatis
        saat order selesai.
      </p>

      <div className="rounded-xl border border-stone-200 dark:border-stone-800">
        {lines === null && <p className="p-4 text-center text-sm text-stone-400">Memuat…</p>}
        {lines?.length === 0 && <p className="p-4 text-center text-sm text-stone-400">Belum ada resep.</p>}
        {lines?.map((l) => (
          <div key={l.ingredient_id} className="flex items-center justify-between gap-2 border-b border-stone-100 p-3 last:border-0 dark:border-stone-800">
            <span className="min-w-0 text-sm font-semibold">
              {l.ingredient_name} <span className="text-xs font-normal text-stone-400">({l.unit})</span>
              {l.purchase_unit && l.conversion_factor != null && l.conversion_factor > 0 && (
                <span className="block text-xs font-semibold text-brand-600 dark:text-brand-400">
                  beli: 1 {l.purchase_unit} = {l.conversion_factor.toLocaleString("id-ID")} {l.unit}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <input
                defaultValue={String(l.qty_per_unit)}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value.replace(",", ".")) || 0;
                  if (v !== l.qty_per_unit) save(l.ingredient_id, v);
                }}
                inputMode="decimal"
                className="w-20 rounded-btn border border-stone-300 px-2 py-1.5 text-right text-sm tabular-nums dark:border-stone-700 dark:bg-stone-800"
              />
              <span className="w-24 text-right text-xs tabular-nums text-stone-500">
                {formatRupiah(Math.round(l.cost_line))}
              </span>
            </div>
          </div>
        ))}
        {lines && lines.length > 0 && (
          <div className="flex justify-between bg-stone-50 p-3 text-sm font-bold dark:bg-stone-800">
            <span>Total HPP</span>
            <span className="tabular-nums">
              {formatRupiah(lines.reduce((s, l) => s + l.cost_line, 0))}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <select
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          className="flex-1 rounded-btn border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800"
        >
          <option value="">Pilih bahan…</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
          ))}
        </select>
        <input
          value={addQty}
          onChange={(e) => setAddQty(e.target.value)}
          placeholder="Qty"
          inputMode="decimal"
          className="w-24 rounded-btn border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800"
        />
        <button
          onClick={() => {
            const qty = parseFloat(addQty.replace(",", ".")) || 0;
            if (!addId || qty <= 0) {
              toast.error("Pilih bahan & qty");
              return;
            }
            save(addId, qty);
            setAddId("");
            setAddQty("");
          }}
          disabled={pending}
          className="touch-target rounded-btn bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          Tambah
        </button>
      </div>

      <button onClick={onDone} className="w-full py-2 text-sm font-semibold text-stone-500 hover:underline">
        Selesai
      </button>
    </div>
  );
}

/* ── Editor opsi menu (ukuran, topping, level pedas) ─────────── */

function OptionsEditor({ productId, productName }: { productId: string; productName: string }) {
  const [groups, setGroups] = useState<OptionGroupView[]>([]);
  const [attached, setAttached] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newGroup, setNewGroup] = useState({ name: "", input_type: "single" as "single" | "multi" });
  const [newOption, setNewOption] = useState<Record<string, { name: string; price_delta: number }>>({});

  const reload = useCallback(async () => {
    const [g, a] = await Promise.all([listOptionGroups(), getProductOptionGroupIds(productId)]);
    setGroups(g);
    setAttached(new Set(a));
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    reload().catch(() => toast.error("Gagal memuat opsi"));
  }, [reload]);

  const toggleAttach = async (groupId: string) => {
    const next = new Set(attached);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setAttached(next);
    const { error } = await setProductOptionGroups(productId, [...next]);
    if (error) {
      toast.error(error);
      reload();
    } else toast.success(next.has(groupId) ? "Opsi dipasang" : "Opsi dilepas");
  };

  const addGroup = async () => {
    if (!newGroup.name.trim()) return;
    const { error } = await createOptionGroup({
      name: newGroup.name.trim(),
      input_type: newGroup.input_type,
      is_required: false,
    });
    if (error) return toast.error(error);
    setNewGroup({ name: "", input_type: "single" });
    reload();
  };

  const addOption = async (groupId: string) => {
    const draft = newOption[groupId];
    if (!draft?.name.trim()) return;
    const { error } = await createOption(groupId, draft.name.trim(), draft.price_delta);
    if (error) return toast.error(error);
    setNewOption((s) => ({ ...s, [groupId]: { name: "", price_delta: 0 } }));
    reload();
  };

  if (loading) return <p className="py-6 text-center text-sm text-stone-500">Memuat…</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">
        Pasang grup opsi ke <b>{productName}</b>. Centang grup yang dipakai; isi item (ukuran/topping) dan selisih
        harganya.
      </p>

      {groups.length === 0 && <p className="py-4 text-center text-sm text-stone-400">Belum ada grup opsi.</p>}

      {groups.map((g) => {
        const draft = newOption[g.id] ?? { name: "", price_delta: 0 };
        const isAttached = attached.has(g.id);
        return (
          <div
            key={g.id}
            className={cn(
              "rounded-lg border p-3",
              isAttached ? "border-brand-400 bg-brand-50/50 dark:bg-brand-900/10" : "border-stone-200 dark:border-stone-800",
            )}
          >
            <div className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  checked={isAttached}
                  onChange={() => toggleAttach(g.id)}
                  className="size-4 accent-amber-600"
                />
                <input
                  defaultValue={g.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== g.name) updateOptionGroup(g.id, { name: v }).then(reload);
                  }}
                  className="rounded-md border border-stone-300 bg-transparent px-2 py-1 text-sm font-semibold dark:border-stone-700"
                />
              </label>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500 dark:bg-stone-800">
                {g.input_type === "single" ? "Pilih 1" : "Multi"}
              </span>
              <label className="flex items-center gap-1 text-xs text-stone-500">
                <input
                  type="checkbox"
                  checked={g.is_required}
                  onChange={(e) => updateOptionGroup(g.id, { is_required: e.target.checked }).then(reload)}
                  className="size-3.5 accent-amber-600"
                />
                Wajib
              </label>
              <button
                onClick={async () => {
                  if (!confirm(`Hapus grup "${g.name}" beserta opsinya?`)) return;
                  const { error } = await deleteOptionGroup(g.id);
                  if (error) return toast.error(error);
                  reload();
                }}
                title="Hapus grup"
                className="rounded-md p-1 text-stone-400 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            <div className="mt-2 space-y-1 pl-6">
              {g.options.map((o) => (
                <div key={o.id} className="flex items-center gap-2 text-sm">
                  <input
                    defaultValue={o.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== o.name) updateOption(o.id, { name: v }).then(reload);
                    }}
                    className="w-32 rounded-md border border-stone-300 bg-transparent px-2 py-1 dark:border-stone-700"
                  />
                  <div className="w-28">
                    <MoneyInput
                      value={o.price_delta}
                      onChange={(v) => updateOption(o.id, { price_delta: v }).then(reload)}
                      placeholder="Harga +"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      const { error } = await deleteOption(o.id);
                      if (error) return toast.error(error);
                      reload();
                    }}
                    title="Hapus opsi"
                    className="rounded-md p-1 text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 text-sm">
                <input
                  value={draft.name}
                  onChange={(e) => setNewOption((s) => ({ ...s, [g.id]: { ...draft, name: e.target.value } }))}
                  placeholder="Item baru…"
                  className="w-32 rounded-md border border-stone-300 bg-transparent px-2 py-1 dark:border-stone-700"
                />
                <div className="w-28">
                  <MoneyInput
                    value={draft.price_delta}
                    onChange={(v) => setNewOption((s) => ({ ...s, [g.id]: { ...draft, price_delta: v } }))}
                    placeholder="Harga +"
                  />
                </div>
                <button
                  onClick={() => addOption(g.id)}
                  disabled={!draft.name.trim()}
                  className="touch-target rounded-md bg-stone-200 px-2 py-1 text-xs font-semibold disabled:opacity-40 dark:bg-stone-800"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-2 border-t border-stone-200 pt-3 dark:border-stone-800">
        <input
          value={newGroup.name}
          onChange={(e) => setNewGroup((s) => ({ ...s, name: e.target.value }))}
          placeholder="Grup baru (mis. Level Pedas)…"
          className="flex-1 rounded-md border border-stone-300 bg-transparent px-2 py-1.5 text-sm dark:border-stone-700"
        />
        <select
          value={newGroup.input_type}
          onChange={(e) => setNewGroup((s) => ({ ...s, input_type: e.target.value as "single" | "multi" }))}
          className="rounded-md border border-stone-300 bg-transparent px-2 py-1.5 text-sm dark:border-stone-700"
        >
          <option value="single">Pilih 1</option>
          <option value="multi">Multi</option>
        </select>
        <button
          onClick={addGroup}
          disabled={!newGroup.name.trim()}
          className="touch-target rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Buat Grup
        </button>
      </div>

      <button onClick={reload} className="w-full py-2 text-sm font-semibold text-stone-500 hover:underline">
        Selesai
      </button>
    </div>
  );
}
