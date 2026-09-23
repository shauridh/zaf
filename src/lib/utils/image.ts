"use client";

/**
 * Util gambar sisi klien (M9):
 * - Kompres & resize otomatis: canvas → JPEG kualitas 0.82, sisi terpanjang 720px.
 * - Crop rasio 4:3 (cover) agar konsisten dengan kartu produk kasir/portal.
 * Output: data URL `data:image/jpeg;base64,...` siap dikirim ke server action.
 */

const MAX_SIDE = 720;
const TARGET_RATIO = 4 / 3; // lebar / tinggi
const JPEG_QUALITY = 0.82;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar tidak dapat dibaca"));
    img.src = src;
  });
}

/** Kompres + crop 4:3 satu file gambar. Melempar Error jika bukan gambar yang valid. */
export async function compressImageFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (!srcW || !srcH) throw new Error("Gambar kosong");

    // 1) Crop 4:3 (cover): potong sisi terpanjang terhadap rasio target.
    let cropW = srcW;
    let cropH = srcH;
    if (srcW / srcH > TARGET_RATIO) {
      cropW = Math.round(srcH * TARGET_RATIO);
    } else {
      cropH = Math.round(srcW / TARGET_RATIO);
    }
    const cropX = Math.round((srcW - cropW) / 2);
    const cropY = Math.round((srcH - cropH) / 2);

    // 2) Resize: sisi terpanjang maks MAX_SIDE (jangan pernah upscale).
    const scale = Math.min(1, MAX_SIDE / Math.max(cropW, cropH));
    const outW = Math.max(1, Math.round(cropW * scale));
    const outH = Math.max(1, Math.round(cropH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak didukung browser");
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
