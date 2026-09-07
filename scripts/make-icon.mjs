#!/usr/bin/env node
/** Tiny Brandcrew mark: dark field + white rounded square. No extra deps. */
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "electron", "resources");
mkdirSync(outDir, { recursive: true });

const size = 256;
const raw = Buffer.alloc((size * 3 + 1) * size);
for (let y = 0; y < size; y++) {
  const row = y * (size * 3 + 1);
  raw[row] = 0;
  for (let x = 0; x < size; x++) {
    const inset = 48;
    const inside = x >= inset && x < size - inset && y >= inset && y < size - inset;
    const r = inside ? 250 : 9;
    const g = inside ? 250 : 9;
    const b = inside ? 250 : 11;
    const i = row + 1 + x * 3;
    raw[i] = r;
    raw[i + 1] = g;
    raw[i + 2] = b;
  }
}

function crc(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(outDir, "icon.png");
createWriteStream(out).end(png);
console.log("Wrote", out);
