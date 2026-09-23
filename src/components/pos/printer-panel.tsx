"use client";

import { useState } from "react";
import { Bluetooth, Printer, Archive } from "lucide-react";
import {
  requestPrinter,
  printBytes,
  buildTestPageBytes,
  buildReceiptBytes,
  EscPosBuilder,
} from "@/lib/printer/escpos";
import { fetchReceiptPrintData } from "@/lib/printer/receipt-print-data";

async function openDrawerTo(): Promise<void> {
  const char = await requestPrinter();
  await printBytes(char, new EscPosBuilder().init().openDrawer().build());
}

export function PrinterPanel({ lastOrderId }: { lastOrderId?: string }) {
  const [status, setStatus] = useState<string>("Belum terhubung");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      await requestPrinter();
      setConnected(true);
      setStatus("Terhubung ✓");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Gagal terhubung");
    } finally {
      setBusy(false);
    }
  };

  const printTest = async () => {
    setBusy(true);
    try {
      const char = await requestPrinter();
      await printBytes(char, buildTestPageBytes());
      setConnected(true);
      setStatus("Test page tercetak ✓");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Gagal cetak");
    } finally {
      setBusy(false);
    }
  };

  const printReceipt = async () => {
    if (!lastOrderId) return;
    setBusy(true);
    try {
      const data = await fetchReceiptPrintData(lastOrderId);
      const bytes = buildReceiptBytes(data);
      const char = await requestPrinter();
      await printBytes(char, bytes);
      setConnected(true);
      setStatus("Struk tercetak ✓");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Gagal cetak struk");
    } finally {
      setBusy(false);
    }
  };

  const kickDrawer = async () => {
    setBusy(true);
    try {
      await openDrawerTo();
      setStatus("Laci dibuka ✓");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Gagal buka laci");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Printer /> Printer Bluetooth (ESC/POS)
      </h2>
      <p className="text-sm text-stone-500">
        Thermal 58/80mm via Web Bluetooth. {status}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={connect} disabled={busy} className="touch-target flex items-center justify-center gap-2 rounded-btn border border-stone-300 py-3 text-sm font-bold dark:border-stone-700">
          <Bluetooth className={connected ? "fill-blue-500" : ""} /> {connected ? "Tersambung" : "Sambungkan"}
        </button>
        <button onClick={printTest} disabled={busy} className="touch-target rounded-btn border border-stone-300 py-3 text-sm font-bold dark:border-stone-700">
          Test Page
        </button>
        <button onClick={printReceipt} disabled={busy || !lastOrderId} className="touch-target rounded-btn bg-brand-600 py-3 text-sm font-bold text-white disabled:opacity-40">
          Cetak Struk Terakhir
        </button>
        <button onClick={kickDrawer} disabled={busy} className="touch-target flex items-center justify-center gap-2 rounded-btn border border-stone-300 py-3 text-sm font-bold dark:border-stone-700">
          <Archive className="size-4" /> Buka Laci
        </button>
      </div>
    </div>
  );
}
