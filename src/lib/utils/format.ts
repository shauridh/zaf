export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format ringkas: 125000 -> "125rb", 1200000 -> "1,2jt" */
export function formatRupiahShort(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}M`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })}rb`;
  }
  return amount.toString();
}

export function formatDateID(date: string | Date, withTime = false): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** Business date (Asia/Jakarta) sebagai string YYYY-MM-DD. */
export function businessDateWIB(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
