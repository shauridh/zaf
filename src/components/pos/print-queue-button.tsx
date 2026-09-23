"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { flushPrintQueue, getPrintQueue, clearPrinted, type PrintJob } from "@/lib/printer/print-queue";
import { toast } from "@/components/ui/toast";

/** Tombol global antrean cetak — tampil di sidebar (desktop & mobile). */
export function PrintQueueButton() {
  const [queue, setQueue] = useState<PrintJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQueue(getPrintQueue());
    const onStorage = () => setQueue(getPrintQueue());
    window.addEventListener("storage", onStorage);
    const t = setInterval(() => setQueue(getPrintQueue()), 3000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, []);

  const flush = async () => {
    setBusy(true);
    try {
      const r = await flushPrintQueue();
      if (r.printed > 0) toast.success(`${r.printed} job tercetak`);
      else if (r.failed > 0) toast.error(`${r.failed} job gagal — periksa printer`);
      else toast.error("Printer tidak terjangkau — job tetap di antrean");
      setQueue(getPrintQueue());
    } finally {
      setBusy(false);
    }
  };

  const count = queue.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Antrean cetak"
        className="relative flex size-11 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
      >
        <Printer className="size-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Antrean Cetak ({count})</h3>
            {count > 0 && (
              <button
                onClick={() => {
                  clearPrinted();
                  setQueue([]);
                }}
                className="text-xs font-semibold text-red-500"
              >
                Bersihkan
              </button>
            )}
          </div>
          {count === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">Antrean kosong</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {queue.map((j) => (
                <li key={j.id} className="flex items-center justify-between rounded-xl bg-stone-100 px-3 py-2 text-sm dark:bg-stone-800">
                  <span>
                    {j.label}
                    {j.attempts > 0 && <span className="ml-2 text-xs text-amber-500">({j.attempts}× gagal)</span>}
                  </span>
                  <span className="text-xs text-stone-400">{new Date(j.createdAt).toLocaleTimeString("id-ID")}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-btn border border-stone-300 py-2.5 text-sm font-bold dark:border-stone-700"
            >
              Tutup
            </button>
            <button
              onClick={flush}
              disabled={busy || count === 0}
              className="flex-1 rounded-btn bg-brand-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {busy ? "Mencetak…" : "Cetak Semua"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-white p-5 dark:bg-stone-900"
      >
        {children}
      </div>
    </div>
  );
}
