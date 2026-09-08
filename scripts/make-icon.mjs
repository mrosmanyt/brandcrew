#!/usr/bin/env node
/**
 * Rasterize the CINEM hex-bracket mark (same polygons as src/lib/cinem-mark.ts).
 * No extra deps — raw PNG via zlib.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LEFT = [
  [4, 32],
  [18, 8],
  [30, 8],
  [20, 32],
  [30, 56],
  [18, 56],
];
const RIGHT = [
  [60, 32],
  [46, 8],
  [34, 8],
  [44, 32],
  [34, 56],
  [46, 56],
];

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
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

function encodePng(size, paint) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = paint(x, y, size);
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function encodePngRect(width, height, paint) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y, width, height);
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function markAt(px, py, box, ink, paper) {
  const u = ((px - box.x) / box.s) * 64;
  const v = ((py - box.y) / box.s) * 64;
  if (u < 0 || v < 0 || u > 64 || v > 64) return paper;
  if (pointInPoly(u, v, LEFT) || pointInPoly(u, v, RIGHT)) return ink;
  return paper;
}

function writePng(filePath, buf) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, buf);
  console.log("Wrote", filePath);
}

const night = [26, 25, 21];
const paper = [244, 243, 239];
const ink = [17, 17, 17];

const electronDir = path.join(root, "electron", "resources");
mkdirSync(electronDir, { recursive: true });

const icon256 = encodePng(256, (x, y, size) => {
  const pad = size * 0.18;
  const s = size - pad * 2;
  return markAt(x, y, { x: pad, y: pad, s }, paper, night);
});
writePng(path.join(electronDir, "icon.png"), icon256);

const apple = encodePng(180, (x, y, size) => {
  const pad = size * 0.18;
  const s = size - pad * 2;
  return markAt(x, y, { x: pad, y: pad, s }, paper, night);
});
writePng(path.join(root, "public", "apple-touch-icon.png"), apple);

const fav = encodePng(32, (x, y, size) => {
  const pad = 1;
  const s = size - pad * 2;
  return markAt(x, y, { x: pad, y: pad, s }, ink, paper);
});
writePng(path.join(root, "public", "icon-32.png"), fav);

const og = encodePngRect(1200, 630, (x, y, width, height) => {
  const s = 220;
  const box = { x: (width - s) / 2, y: (height - s) / 2 - 24, s };
  return markAt(x, y, box, paper, night);
});
writePng(path.join(root, "public", "og.png"), og);
