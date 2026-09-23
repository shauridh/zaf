"use client";

import {
  buildKitchenTicketBytes,
  buildReceiptBytes,
  buildTestPageBytes,
  buildZReportBytes,
  printBytes,
  requestPrinter,
  type BluetoothCharacteristicLike,
  type KitchenTicketData,
  type ReceiptPrintData,
  type ZReportPrintData,
} from "./escpos";

/**
 * Antrean cetak sisi klien (M8-T2):
 * - Job disimpan di localStorage agar tak hilang saat refresh.
 * - Gagal (printer mati/jauh) → job tetap di antrean, bisa di-flush ulang.
 * - Karakteristik Bluetooth di-cache selama sesi; fallback minta ulang per flush.
 */

const QUEUE_KEY = "cp_print_queue_v1";
const MAX_ATTEMPTS = 3;

export type PrintJobKind = "receipt" | "kitchen" | "zreport" | "test";

export interface PrintJob {
  id: string;
  kind: PrintJobKind;
  label: string;
  createdAt: number;
  attempts: number;
  payload: unknown; // ReceiptPrintData | KitchenTicketData | ZReportPrintData | null
}

function loadQueue(): PrintJob[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as PrintJob[];
  } catch {
    return [];
  }
}

function saveQueue(q: PrintJob[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function getPrintQueue(): PrintJob[] {
  return loadQueue();
}

export function queueCount(): number {
  return loadQueue().length;
}

export function clearPrinted(): void {
  saveQueue([]);
}

function enqueue(kind: PrintJobKind, label: string, payload: unknown): void {
  const q = loadQueue();
  q.push({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    label,
    createdAt: Date.now(),
    attempts: 0,
    payload,
  });
  saveQueue(q);
}

let charCache: BluetoothCharacteristicLike | null = null;

async function getChar(): Promise<BluetoothCharacteristicLike> {
  if (charCache) return charCache;
  charCache = await requestPrinter();
  return charCache;
}

function buildBytes(job: PrintJob): Uint8Array {
  switch (job.kind) {
    case "receipt":
      return buildReceiptBytes(job.payload as ReceiptPrintData);
    case "kitchen":
      return buildKitchenTicketBytes(job.payload as KitchenTicketData);
    case "zreport":
      return buildZReportBytes(job.payload as ZReportPrintData);
    case "test":
      return buildTestPageBytes();
  }
}

/** Enqueue + langsung coba cetak. Gagal diam-diam (job tetap di antrean). */
export async function submitPrint(
  kind: PrintJobKind,
  label: string,
  payload: unknown,
): Promise<{ printed: boolean; queued: number }> {
  enqueue(kind, label, payload);
  const r = await flushPrintQueue();
  return { printed: r.printed > 0, queued: r.remaining };
}

/**
 * Cetak semua job di antrean secara berurutan.
 * Job gagal di-retry hingga MAX_ATTEMPTS, lalu dibuang (tercatat sebagai failed).
 */
export async function flushPrintQueue(): Promise<{ printed: number; remaining: number; failed: number }> {
  const queue = loadQueue();
  if (queue.length === 0) return { printed: 0, remaining: 0, failed: 0 };

  let printed = 0;
  let failed = 0;
  const remaining: PrintJob[] = [];

  let char: BluetoothCharacteristicLike | null = null;
  try {
    char = await getChar();
  } catch {
    char = null;
  }

  for (const job of queue) {
    let done = false;
    if (char) {
      try {
        await printBytes(char, buildBytes(job));
        done = true;
      } catch {
        charCache = null; // koneksi putih — sambung ulang di percobaan berikut
        char = null;
      }
    }
    if (!done) {
      try {
        char = await getChar();
        await printBytes(char, buildBytes(job));
        done = true;
      } catch {
        char = null;
      }
    }

    if (done) {
      printed++;
    } else if (job.attempts + 1 < MAX_ATTEMPTS) {
      remaining.push({ ...job, attempts: job.attempts + 1 });
    } else {
      failed++; // melebihi batas retry — buang dari antrean
    }
  }

  saveQueue(remaining);
  return { printed, remaining: remaining.length, failed };
}

/** Helper siap pakai — semua UI memanggil ini agar otomatis masuk antrean. */
export async function printReceipt(d: ReceiptPrintData): Promise<{ printed: boolean; queued: number }> {
  return submitPrint("receipt", `Struk #${d.orderNumber}`, d);
}

export async function printKitchenTicket(d: KitchenTicketData): Promise<{ printed: boolean; queued: number }> {
  return submitPrint("kitchen", `Dapur #${d.orderNumber}`, d);
}

export async function printZReport(d: ZReportPrintData): Promise<{ printed: boolean; queued: number }> {
  return submitPrint("zreport", `Z Report ${d.closedAt}`, d);
}
