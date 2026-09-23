"use client";

// ============================================================
// ESC/POS builder + Web Bluetooth printer client
// Printer thermal 58mm (32 kolom) / 80mm (48 kolom)
// ============================================================

export const PRINTER_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
export const PRINTER_CHAR_UUID = "00002af1-0000-1000-8000-00805f9b34fb";

const ESC = 0x1b;
const GS = 0x1d;

export class EscPosBuilder {
  private bytes: number[] = [];

  raw(...bytes: number[]): this {
    this.bytes.push(...bytes);
    return this;
  }

  init(): this {
    return this.raw(ESC, 0x40);
  }

  align(mode: "left" | "center" | "right"): this {
    return this.raw(ESC, 0x61, mode === "left" ? 0 : mode === "center" ? 1 : 2);
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  size(w: 0 | 1, h: 0 | 1): this {
    return this.raw(GS, 0x21, (h << 4) | w);
  }

  text(s: string): this {
    // ESC/POS umum menerima UTF-8; printer ID umumnya ok untuk alfanumerik.
    // Untuk printer yang butuh codepage khusus, mapping dilakukan firmware printer.
    const encoded = new TextEncoder().encode(s);
    this.bytes.push(...encoded);
    return this.raw(0x0a); // newline
  }

  feed(lines = 1): this {
    return this.raw(ESC, 0x64, lines);
  }

  cut(): this {
    return this.raw(GS, 0x56, 0x42, 0x00);
  }

  // Cash drawer kick
  openDrawer(): this {
    return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa);
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

const WIDTH_58 = 32;
const WIDTH_80 = 48;

function padLine(left: string, right: string, width: number): string {
  const space = width - left.length - right.length;
  if (space < 1) return (left + " " + right).slice(0, width);
  return left + " ".repeat(space) + right;
}

export interface ReceiptPrintData {
  outletName: string;
  orderNumber: number;
  queueNumber: number | null;
  channelLabel: string;
  createdAt: string;
  tableLabel?: string | null;
  items: { qty: number; name: string; subtotal: number; options?: string[]; note?: string | null }[];
  subtotal: number;
  discounts: number;
  tax: number;
  serviceCharge: number;
  total: number;
  paid: number;
  change: number;
  footer: string;
  width?: 58 | 80;
}

export function buildReceiptBytes(d: ReceiptPrintData): Uint8Array {
  const width = d.width === 80 ? WIDTH_80 : WIDTH_58;
  const b = new EscPosBuilder().init();
  b.align("center").bold(true).size(0, 1).text(d.outletName).bold(false).size(0, 0);
  b.text(d.channelLabel + " #" + d.orderNumber + (d.queueNumber ? "  Q" + d.queueNumber : ""));
  b.align("left").text(d.createdAt);
  if (d.tableLabel) b.text("Meja: " + d.tableLabel);
  b.text("-".repeat(width));
  for (const it of d.items) {
    b.text(`${it.qty}x ${it.name}`);
    b.align("right").text(it.subtotal.toLocaleString("id-ID")).align("left");
    for (const o of it.options ?? []) b.text("  + " + o);
    if (it.note) b.text("  * " + it.note);
  }
  b.text("-".repeat(width));
  b.text(padLine("Subtotal", d.subtotal.toLocaleString("id-ID"), width));
  if (d.discounts > 0) b.text(padLine("Diskon", "-" + d.discounts.toLocaleString("id-ID"), width));
  if (d.serviceCharge > 0) b.text(padLine("Service", d.serviceCharge.toLocaleString("id-ID"), width));
  if (d.tax > 0) b.text(padLine("Pajak", d.tax.toLocaleString("id-ID"), width));
  b.bold(true).text(padLine("TOTAL", d.total.toLocaleString("id-ID"), width)).bold(false);
  b.text(padLine("Dibayar", d.paid.toLocaleString("id-ID"), width));
  if (d.change > 0) b.text(padLine("Kembali", d.change.toLocaleString("id-ID"), width));
  b.text("-".repeat(width));
  b.align("center").text(d.footer);
  b.feed(2).cut();
  return b.build();
}

export interface KitchenTicketData {
  orderNumber: number;
  queueNumber: number | null;
  channelLabel: string;
  tableLabel?: string | null;
  items: { qty: number; name: string; options?: string[]; note?: string | null }[];
  orderNote?: string | null;
  width?: 58 | 80;
}

export function buildKitchenTicketBytes(d: KitchenTicketData): Uint8Array {
  const width = d.width === 80 ? WIDTH_80 : WIDTH_58;
  const b = new EscPosBuilder().init();
  b.align("center").bold(true).size(0, 1).text("DAPUR").size(0, 0).bold(false);
  b.text("#" + d.orderNumber + (d.queueNumber ? " Q" + d.queueNumber : "") + " · " + d.channelLabel);
  if (d.tableLabel) b.text("Meja " + d.tableLabel);
  b.text("-".repeat(width));
  for (const it of d.items) {
    b.bold(true).text(`${it.qty}x ${it.name}`).bold(false);
    for (const o of it.options ?? []) b.text("  + " + o);
    if (it.note) b.text("  ** " + it.note);
  }
  if (d.orderNote) b.text("Catatan: " + d.orderNote);
  b.feed(3).cut();
  return b.build();
}

export interface ZReportPrintData {
  outletName: string;
  closedAt: string;
  openingCash: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  expected: number;
  counted: number;
  variance: number;
  nonCash: number;
  orderCount: number;
  footer: string;
  width?: 58 | 80;
}

export function buildZReportBytes(d: ZReportPrintData): Uint8Array {
  const width = d.width === 80 ? WIDTH_80 : WIDTH_58;
  const b = new EscPosBuilder().init();
  b.align("center").bold(true).size(0, 1).text("Z REPORT").size(0, 0).bold(false);
  b.text(d.outletName).text(d.closedAt);
  b.text("-".repeat(width));
  b.text(padLine("Modal awal", d.openingCash.toLocaleString("id-ID"), width));
  b.text(padLine("Penjualan tunai", d.cashSales.toLocaleString("id-ID"), width));
  b.text(padLine("Pay-in", d.cashIn.toLocaleString("id-ID"), width));
  b.text(padLine("Pay-out", d.cashOut.toLocaleString("id-ID"), width));
  b.bold(true).text(padLine("Expected", d.expected.toLocaleString("id-ID"), width)).bold(false);
  b.text(padLine("Hitung fisik", d.counted.toLocaleString("id-ID"), width));
  b.bold(true).text(padLine("Selisih", d.variance.toLocaleString("id-ID"), width)).bold(false);
  b.text("-".repeat(width));
  b.text(padLine("Non-tunai", d.nonCash.toLocaleString("id-ID"), width));
  b.text(padLine("Jumlah order", String(d.orderCount), width));
  b.align("center").text(d.footer).feed(2).cut();
  return b.build();
}

export function buildTestPageBytes(): Uint8Array {
  const b = new EscPosBuilder().init();
  b.align("center").bold(true).text("TEST PAGE").bold(false);
  b.text("ChickenPOS Bluetooth OK");
  b.text("1234567890 ABCDEFGHIJKLM");
  b.feed(2).cut();
  return b.build();
}

// ---------------- Web Bluetooth ----------------

export interface BluetoothCharacteristicLike {
  writeValue(value: BufferSource): Promise<void>;
}

export async function requestPrinter(): Promise<BluetoothCharacteristicLike> {
  if (!("bluetooth" in navigator)) {
    throw new Error("Browser tidak mendukung Web Bluetooth (iOS Safari belum didukung — gunakan Android/Chrome).");
  }
  const device = await (navigator as unknown as {
    bluetooth: {
      requestDevice: (opts: {
        filters: [{ services: [string] }];
        optionalServices?: string[];
      }) => Promise<{
        gatt?: {
          connect: () => Promise<{
            getPrimaryServices: () => Promise<{
              getCharacteristics: () => Promise<{
                properties?: { write?: boolean; writeWithoutResponse?: boolean };
                writeValue(v: BufferSource): Promise<void>;
              }[]>;
            }[]>;
          }>;
        };
      }>;
    };
  }).bluetooth.requestDevice({
    filters: [{ services: [PRINTER_SERVICE_UUID] }],
    optionalServices: [PRINTER_SERVICE_UUID],
  });

  const server = await device.gatt!.connect();
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const char of chars) {
      if (char.properties?.write || char.properties?.writeWithoutResponse) {
        return char;
      }
    }
  }
  throw new Error("Karakteristik printer tidak ditemukan");
}

/** Kirim bytes (chunked sesuai MTU umum 20-100 byte). */
export async function printBytes(char: BluetoothCharacteristicLike, data: Uint8Array): Promise<void> {
  const CHUNK = 180;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    await char.writeValue(chunk);
    await new Promise((r) => setTimeout(r, 20)); // beri printer waktu
  }
}
