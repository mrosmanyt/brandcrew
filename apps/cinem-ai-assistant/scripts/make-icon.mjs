/**
 * Generates app-icon.png (1024×1024) — a glowing cyan orb on near-black —
 * using only Node built-ins (zlib). Run `npm run icon` afterwards to let
 * the Tauri CLI produce every platform icon in src-tauri/icons/.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const SIZE = 1024;

/* ── CRC32 (required by PNG chunks) ── */
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/* ── Paint the orb ── */
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1)); // +1 filter byte per row
const cx = SIZE / 2;
const cy = SIZE / 2;

for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 4 + 1);
  raw[row] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const d = Math.hypot(x - cx, y - cy) / (SIZE / 2); // 0 center → 1 edge
    // Background
    let r = 4, g = 8, b = 11;
    // Soft outer glow
    const glow = Math.max(0, 1 - d * 1.35);
    r += 30 * glow; g += 130 * glow; b += 128 * glow;
    // Bright core
    const core = Math.max(0, 1 - d * 3.2);
    r += 190 * core ** 1.6; g += 240 * core ** 1.6; b += 235 * core ** 1.6;
    // Thin neon ring at d ≈ 0.62
    const ring = Math.exp(-(((d - 0.62) / 0.015) ** 2));
    r += 60 * ring; g += 220 * ring; b += 214 * ring;
    const o = row + 1 + x * 4;
    raw[o] = Math.min(255, r);
    raw[o + 1] = Math.min(255, g);
    raw[o + 2] = Math.min(255, b);
    raw[o + 3] = 255;
  }
}

/* ── Assemble PNG ── */
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(new URL("../app-icon.png", import.meta.url), png);
console.log("✓ app-icon.png (1024×1024) generated");
