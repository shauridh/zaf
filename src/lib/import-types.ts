/** Tipe baris impor CSV data gerai — dipakai panel Pengaturan dan server action impor. */

export type ImportMode = "replace" | "merge";

export interface ImportIngredientRow {
  nama: string;
  satuan: string; // satuan resep
  stok: number;
  minStok: number;
  satuanBeli: string;
  isiKonversi: number; // 1 satuan_beli = ? satuan resep
  hargaBeli: number; // rupiah per satuan_beli
}

export interface ImportProductRow {
  nama: string;
  kategori: string;
  harga: number;
  deskripsi: string;
  gambar: string; // URL gambar (opsional)
  aktif: boolean;
}

export interface ImportRecipeRow {
  produk: string;
  bahan: string;
  qty: number; // per porsi, dalam satuan resep
}

export interface ImportResult {
  ok: boolean;
  inserted: number;
  updated: number;
  deleted: number;
  errors: string[];
}
