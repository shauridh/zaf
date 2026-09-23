"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, AlertTriangle } from "lucide-react";
import { parseCSV, parseNum, parseBool, toCSV } from "@/lib/utils/csv";
import {
  clearCatalog,
  importIngredients,
  importProducts,
  importRecipes,
} from "@/lib/actions/import";
import type {
  ImportIngredientRow,
  ImportMode,
  ImportProductRow,
  ImportRecipeRow,
  ImportResult,
} from "@/lib/import-types";
import { toast } from "@/components/ui/toast";

/* ── Template CSV ─────────────────────────────────────────── */

const TEMPLATES = {
  bahan: [
    ["nama", "satuan", "stok", "min_stok", "satuan_beli", "isi_konversi", "harga_beli"],
    ["Ayam Fillet", "gr", "25000", "5000", "kg", "1000", "45000"],
    ["Tepung Bumbu", "gr", "10000", "2000", "kg", "1000", "12000"],
  ],
  produk: [
    ["nama", "kategori", "harga", "deskripsi", "gambar", "aktif"],
    ["Paket Ayam 1", "Paket Hemat", "32000", "Ayam + nasi + minum", "", "ya"],
  ],
  resep: [
    ["produk", "bahan", "qty"],
    ["Paket Ayam 1", "Ayam Fillet", "250"],
    ["Paket Ayam 1", "Tepung Bumbu", "60"],
  ],
} as const;

type TemplateRows = readonly (readonly (string | number | boolean)[])[];

function downloadTemplate(filename: string, rows: TemplateRows) {
  // BOM agar Excel membaca UTF-8 dengan benar.
  const blob = new Blob(["\uFEFF" + toCSV(rows.map((r) => [...r]))], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Parser per jenis (posisi kolom sesuai template) ───────── */

function isHeader(row: string[]): boolean {
  const first = row[0]?.trim().toLowerCase();
  return first === "nama" || first === "produk";
}

function parseBahan(table: string[][]): ImportIngredientRow[] {
  const out: ImportIngredientRow[] = [];
  table.forEach((c, i) => {
    if (i === 0 && isHeader(c)) return;
    const [nama, satuan, stok, minStok, satuanBeli, isiKonversi, hargaBeli] = c.map((x) => x.trim());
    out.push({
      nama,
      satuan,
      stok: parseNum(stok || "0"),
      minStok: parseNum(minStok || "0"),
      satuanBeli: satuanBeli || satuan,
      isiKonversi: parseNum(isiKonversi || "1"),
      hargaBeli: parseNum(hargaBeli || "0"),
    });
  });
  return out;
}

function parseProduk(table: string[][]): ImportProductRow[] {
  const out: ImportProductRow[] = [];
  table.forEach((c, i) => {
    if (i === 0 && isHeader(c)) return;
    const [nama, kategori, harga, deskripsi, gambar, aktif] = c.map((x) => x.trim());
    out.push({
      nama,
      kategori,
      harga: parseNum(harga || "0"),
      deskripsi: deskripsi ?? "",
      gambar: gambar ?? "",
      aktif: aktif ? parseBool(aktif) : true,
    });
  });
  return out;
}

function parseResep(table: string[][]): ImportRecipeRow[] {
  const out: ImportRecipeRow[] = [];
  table.forEach((c, i) => {
    if (i === 0 && isHeader(c)) return;
    const [produk, bahan, qty] = c.map((x) => x.trim());
    out.push({ produk, bahan, qty: parseNum(qty || "0") });
  });
  return out;
}

/* ── Sub-komponen: satu jenis impor ────────────────────────── */

function CsvImporter<T>({
  title,
  desc,
  templateFile,
  template,
  parse,
  run,
  withMode,
}: {
  title: string;
  desc: string;
  templateFile: string;
  template: TemplateRows;
  parse: (table: string[][]) => T[];
  run: (rows: T[], mode: ImportMode) => Promise<ImportResult>;
  withMode?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string[][] | null>(null);
  const [rows, setRows] = useState<T[] | null>(null);
  const [mode, setMode] = useState<ImportMode>("replace");
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    const text = await file.text();
    const table = parseCSV(text);
    if (table.length === 0) {
      toast.error("File kosong");
      return;
    }
    setPreview(table);
    setRows(parse(table));
  };

  const doImport = async () => {
    if (!rows?.length) return;
    setBusy(true);
    try {
      const res = await run(rows, mode);
      if (res.ok) {
        toast.success(
          `Impor ${title}: ${res.inserted} masuk${res.updated ? `, ${res.updated} diperbarui` : ""}${res.deleted ? `, ${res.deleted} lama dihapus` : ""}`,
        );
        setPreview(null);
        setRows(null);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        toast.error(res.errors[0] ?? "Impor gagal");
        // Tampilkan semua error di console untuk perbaikan file.
        if (res.errors.length > 1) console.error(res.errors);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <button
          onClick={() => downloadTemplate(templateFile, template)}
          className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
        >
          <Download className="size-3.5" /> Template
        </button>
      </div>
      <p className="mb-3 text-sm text-stone-500">{desc}</p>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />

      {!rows ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-btn border-2 border-dashed border-stone-300 py-4 text-sm font-bold text-stone-500 hover:border-brand-400 hover:text-brand-600 dark:border-stone-700"
        >
          <Upload className="size-4" /> Pilih file CSV…
        </button>
      ) : (
        <div className="space-y-3">
          <div className="max-h-48 overflow-auto rounded-btn border border-stone-200 dark:border-stone-800">
            <table className="w-full text-xs">
              <tbody>
                {preview?.slice(0, 8).map((r, i) => (
                  <tr key={i} className={i === 0 ? "bg-stone-50 font-bold dark:bg-stone-800" : ""}>
                    {r.map((c, j) => (
                      <td key={j} className="whitespace-nowrap border-b border-stone-100 px-2 py-1 dark:border-stone-800">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-stone-500">{rows.length} baris siap diimpor.</p>

          {withMode && (
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                  className="accent-amber-600"
                />
                <b>Ganti total</b>&nbsp;(hapus data lama)
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={mode === "merge"}
                  onChange={() => setMode("merge")}
                  className="accent-amber-600"
                />
                Gabungkan&nbsp;(upsert by nama)
              </label>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={doImport}
              disabled={busy}
              className="touch-target flex-1 rounded-btn bg-brand-600 py-2.5 font-bold text-white disabled:opacity-50"
            >
              {busy ? "Mengimpor…" : `Impor ${title}`}
            </button>
            <button
              onClick={() => {
                setPreview(null);
                setRows(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="touch-target rounded-btn border-2 border-stone-300 px-4 py-2.5 font-bold dark:border-stone-700"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Panel utama ──────────────────────────────────────────── */

export function ImportPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const doClear = async () => {
    if (!confirm("Hapus SEMUA produk, bahan, dan resep? Tindakan ini tidak bisa dibatalkan.")) return;
    setBusy(true);
    try {
      const res = await clearCatalog();
      if (res.ok) {
        toast.success(`Katalog dikosongkan (${res.deleted} baris dihapus)`);
        router.refresh();
      } else {
        toast.error(res.errors[0] ?? "Gagal");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="mb-1 text-lg font-semibold">Impor Data Gerai</h2>
        <p className="text-sm text-stone-500">
          Isi data asli gerai lewat file CSV — unduh template, isi di Excel/Sheets, lalu impor.
          Urutan yang benar: <b>Bahan → Produk → Resep</b>. Kolom <b>isi_konversi</b> = 1 satuan beli
          berapa satuan resep (mis. 1 kg = 1000 gr); <b>harga_beli</b> per satuan beli (HPP per satuan
          resep dihitung otomatis).
        </p>
      </section>

      <CsvImporter<ImportIngredientRow>
        title="Bahan"
        desc="Nama, satuan resep, stok & min stok, satuan beli + isi konversi, harga beli."
        templateFile="template-bahan.csv"
        template={TEMPLATES.bahan}
        parse={parseBahan}
        run={importIngredients}
        withMode
      />

      <CsvImporter<ImportProductRow>
        title="Produk"
        desc="Nama, kategori (dibuat otomatis bila baru), harga, deskripsi, URL gambar, aktif."
        templateFile="template-produk.csv"
        template={TEMPLATES.produk}
        parse={parseProduk}
        run={importProducts}
        withMode
      />

      <CsvImporter<ImportRecipeRow>
        title="Resep (BOM)"
        desc="Resep per porsi dalam satuan resep. Resep produk yang disebut dalam file diganti seluruhnya; produk lain tidak tersentuh."
        templateFile="template-resep.csv"
        template={TEMPLATES.resep}
        parse={parseResep}
        run={(_rows, _mode) => importRecipes(_rows)}
      />

      <section className="card border-red-200 p-5 dark:border-red-900">
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-red-600">
          <AlertTriangle className="size-4" /> Zona Bahaya
        </h3>
        <p className="mb-3 text-sm text-stone-500">
          Kosongkan katalog: hapus <b>semua</b> produk, bahan, dan resep supaya impor dimulai dari
          lembar bersih. Riwayat transaksi & mutasi stok tidak ikut terhapus — bahan yang punya riwayat
          mutasi akan menahan penghapusan.
        </p>
        <button
          onClick={doClear}
          disabled={busy}
          className="touch-target rounded-btn bg-red-600 px-4 py-2.5 font-bold text-white disabled:opacity-50"
        >
          {busy ? "Mengosongkan…" : "Kosongkan Katalog"}
        </button>
      </section>
    </div>
  );
}
