/** Parser & generator CSV sederhana (RFC 4180 ringkas: tanda kutip, escape ""). */

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export function toCSV(rows: (string | number | boolean)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

/**
 * Parse angka fleksibel untuk impor:
 * "32.000"/"32000" → 32000 (ribuan), "0,5"/"0.5" → 0,5 (desimal).
 */
export function parseNum(v: string): number {
  const t = (v ?? "").trim();
  if (!t) return NaN;
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) return parseFloat(t.replace(/\./g, ""));
  return parseFloat(t.replace(",", "."));
}

/** "ya"/"true"/"1"/"yes" → true. */
export function parseBool(v: string): boolean {
  return /^(ya|y|true|1|yes)$/i.test((v ?? "").trim());
}
