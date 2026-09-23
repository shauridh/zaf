// Generate ikon PWA sederhana tanpa dependensi eksternal.
// Menghasilkan public/icon-192.png, icon-512.png, icon-maskable-512.png
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = parseInt(process.argv[2] || "512", 10);
const OUT = process.argv[3];
const MASKABLE = process.argv[4] === "maskable";

// SVG chicken drumstick sederhana → tidak diparse; gambar digenerate langsung ke pixel buffer.
// Desain: lingkaran krem + teks "C" amber (simpel & bersih di semua ukuran).
function renderIcon(size, maskable) {
  const { createCanvas } = (() => {
    return {}; // placeholder — canvas asli digambar manual di bawah
  })();
  void createCanvas;

  const buf = Buffer.alloc(size * size * 3, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = maskable ? size * 0.4 : size * 0.42; // aman utk safe zone maskable
  const bg = [28, 25, 23]; // stone-900
  const fg = [245, 158, 11]; // brand-500

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let px;
      if (dist <= r) {
        // ring luar
        if (dist > r * 0.82) {
          px = fg;
        } else if (dist > r * 0.7) {
          px = bg;
        } else {
          px = fg;
        }
      } else {
        px = bg;
      }
      const idx = (y * size + x) * 3;
      buf[idx] = px[0];
      buf[idx + 1] = px[1];
      buf[idx + 2] = px[2];
    }
  }
  return buf;
}

function writePng(filePath, size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter none
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunks = [];
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, "ascii");
    const crcInput = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput) >>> 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  function crc32(buf) {
    let table = crc32.table;
    if (!table) {
      table = crc32.table = new Int32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
      }
    }
    let crc = -1;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return ~crc;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  chunks.push(signature);
  chunks.push(chunk("IHDR", ihdr));
  chunks.push(chunk("IDAT", idat));
  chunks.push(chunk("IEND", Buffer.alloc(0)));

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.concat(chunks));
  console.log(`✓ ${filePath} (${size}x${size})`);
}

const rgb = renderIcon(SIZE, MASKABLE);
writePng(OUT, SIZE, rgb);
