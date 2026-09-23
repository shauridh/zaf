"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="w-full rounded-btn bg-stone-800 py-3 font-bold text-white dark:bg-stone-200 dark:text-stone-900"
    >
      Cetak Struk
    </button>
  );
}
