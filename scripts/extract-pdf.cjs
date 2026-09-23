// Ekstrak tabel price list Sabana per halaman → TSV (NO/KODE/NAMA/SATUAN/ISI/HARGA).
const fs = require("fs");
const zlib = require("zlib");

const buf = fs.readFileSync(
  "C:/Users/Administrator/Documents/Ridho Nitip/Aplikasi nih/Price List Sabana Sharing Mitra.pdf",
);
const raw = buf.toString("latin1");

// 1. Stream deflate (± 1 per halaman)
const streams = [];
const re = /stream\r?\n?/g;
let m;
while ((m = re.exec(raw))) {
  const start = m.index + m[0].length;
  const end = raw.indexOf("endstream", start);
  if (end < 0) break;
  try {
    streams.push(zlib.inflateSync(buf.slice(start, end)).toString("latin1"));
  } catch {}
}

// 2. BT..ET → {x, y, text}
function parseCells(stream) {
  const cells = [];
  const blockRe = /BT([\s\S]*?)ET/g;
  let b;
  while ((b = blockRe.exec(stream))) {
    const tm = /1\s+0\s+0\s+1\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm/.exec(b[1]);
    if (!tm) continue;
    let text = "";
    const strRe = /\(((?:\\.|[^()\\])*)\)/g;
    let t;
    while ((t = strRe.exec(b[1]))) text += t[1];
    if (text.trim())
      cells.push({
        x: Math.round(parseFloat(tm[1])),
        y: Math.round(parseFloat(tm[2])),
        text: text.replace(/\\([()\\])/g, "$1"),
      });
  }
  return cells;
}

// 3. Per halaman: baris = kelompok Y, kolom = bucket berdasar X header
const allRows = [];
for (const s of streams) {
  const cells = parseCells(s);
  if (!cells.length) continue;
  const byY = new Map();
  for (const c of cells) {
    if (!byY.has(c.y)) byY.set(c.y, []);
    byY.get(c.y).push(c);
  }
  const rows = [...byY.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, list]) => list.sort((a, b) => a.x - b.x));

  // Cari baris header (berisi sel "NO") → ambil X awal tiap kolom
  const header = rows.find((r) => r.some((c) => c.text.trim() === "NO"));
  if (!header) continue;
  const starts = header.map((c) => c.x);

  for (const r of rows) {
    const texts = r.map((c) => c.text.trim());
    if (texts.includes("NO") || texts.some((t) => /SABANA/i.test(t))) continue;
    const buckets = starts.map(() => []);
    for (const c of r) {
      let idx = 0;
      for (let i = 0; i < starts.length; i++) if (c.x >= starts[i] - 2) idx = i;
      buckets[idx].push(c.text);
    }
    const cols = buckets.map((bk) =>
      bk
        .join(" ")
        .split(/ {2,}/)
        .map((w) => w.replace(/ /g, ""))
        .join(" ")
        .replace(/\t/g, " ")
        .trim(),
    );
    if (cols.some(Boolean)) allRows.push(cols);
  }
}

fs.writeFileSync("scripts/pdf-table.txt", allRows.map((r) => r.join("\t")).join("\n"));
console.log(`pages=${streams.length} rows=${allRows.length} → scripts/pdf-table.txt`);
