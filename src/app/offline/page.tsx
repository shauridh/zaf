export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-5xl">📶</span>
      <h1 className="text-2xl font-bold">Tidak ada koneksi</h1>
      <p className="max-w-sm text-sm text-stone-500">
        Koneksi terputus. Order yang dibuat saat offline tetap bisa masuk —
        mereka otomatis tersinkron ke server begitu koneksi kembali.
      </p>
      <a
        href="/login"
        className="touch-target rounded-btn bg-brand-600 px-6 py-3 text-sm font-bold text-white"
      >
        Coba lagi
      </a>
    </main>
  );
}
