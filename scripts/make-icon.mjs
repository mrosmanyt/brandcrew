#!/usr/bin/env node
/**
 * Rasterize the official CINEM hex-bracket mark (same polygons as src/lib/cinem-mark.ts).
 * Writes public brand assets, App Router metadata images, electron icon, and favicon.ico.
 * Web tab icons use the SaaS tile in public/icon.svg (night #1a1915 + cream #f4f3ef).
 * Pass --web-only to regenerate favicons without touching Electron/installer art.
 * No extra deps — raw PNG via zlib.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webOnly = process.argv.includes("--web-only");

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

function encodePng(width, height, channels, paint) {
  const raw = Buffer.alloc((width * channels + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * channels + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const px = paint(x, y, width, height);
      const i = row + 1 + x * channels;
      raw[i] = px[0];
      raw[i + 1] = px[1];
      raw[i + 2] = px[2];
      if (channels === 4) raw[i + 3] = px[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function coverageAt(u, v) {
  const hits =
    (pointInPoly(u, v, LEFT) ? 1 : 0) + (pointInPoly(u, v, RIGHT) ? 1 : 0);
  return hits > 0 ? 1 : 0;
}

function coverageAA(u, v, du, samples = 4) {
  let sum = 0;
  const step = du / samples;
  const origin = step / 2;
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      sum += coverageAt(u + origin + sx * step, v + origin + sy * step);
    }
  }
  return sum / (samples * samples);
}

function markSample(px, py, box, samples = 4) {
  const du = 64 / box.s;
  const u = ((px + 0.5 - box.x) / box.s) * 64 - du / 2;
  const v = ((py + 0.5 - box.y) / box.s) * 64 - du / 2;
  return coverageAA(u, v, du, samples);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function blend(ink, paper, t) {
  return [
    lerp(paper[0], ink[0], t),
    lerp(paper[1], ink[1], t),
    lerp(paper[2], ink[2], t),
    paper.length > 3 || ink.length > 3
      ? lerp(paper[3] ?? 255, ink[3] ?? 255, t)
      : 255,
  ];
}

function writePng(filePath, buf) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, buf);
  console.log("Wrote", filePath, buf.length, "bytes");
}

function encodeIco(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const entries = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const bodies = [];
  pngs.forEach((png, i) => {
    const size = png.size;
    entries[i * 16] = size >= 256 ? 0 : size;
    entries[i * 16 + 1] = size >= 256 ? 0 : size;
    entries[i * 16 + 2] = 0;
    entries[i * 16 + 3] = 0;
    entries.writeUInt16LE(1, i * 16 + 4);
    entries.writeUInt16LE(32, i * 16 + 6);
    entries.writeUInt32LE(png.buf.length, i * 16 + 8);
    entries.writeUInt32LE(offset, i * 16 + 12);
    offset += png.buf.length;
    bodies.push(png.buf);
  });
  return Buffer.concat([header, entries, ...bodies]);
}

const night = [26, 25, 21];
const paper = [244, 243, 239];
const ink = [17, 17, 17];
const clear = [17, 17, 17, 0];
const inkA = [17, 17, 17, 255];
const paperA = [244, 243, 239, 255];
const nightA = [26, 25, 21, 255];
const cream = [244, 243, 239];

function paddedBox(size, padRatio = 0.12) {
  const pad = size * padRatio;
  return { x: pad, y: pad, s: size - pad * 2 };
}

const WEB_ICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="CINEM Pro">
  <rect width="64" height="64" rx="14" fill="#1a1915"/>
  <g transform="translate(7.68 7.68) scale(0.76)">
    <path fill="#f4f3ef" d="M4 32 L18 8 H30 L20 32 L30 56 H18 Z"/>
    <path fill="#f4f3ef" d="M60 32 L46 8 H34 L44 32 L34 56 H46 Z"/>
  </g>
</svg>
`;

function writeWebIconSvg() {
  const files = [
    path.join(root, "public", "icon.svg"),
    path.join(root, "src", "app", "icon.svg"),
  ];
  for (const filePath of files) {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, WEB_ICON_SVG);
    console.log("Wrote", filePath);
  }
}

function paintNightTile(x, y, w, padRatio, samples) {
  const t = markSample(x, y, paddedBox(w, padRatio), samples);
  return blend(cream, night, t);
}

function paintNightTileA(x, y, w, padRatio, samples) {
  const t = markSample(x, y, paddedBox(w, padRatio), samples);
  return blend(paperA, nightA, t);
}

const electronDir = path.join(root, "electron", "resources");
if (!webOnly) {
  mkdirSync(electronDir, { recursive: true });

  const icon256 = encodePng(256, 256, 3, (x, y, w) => {
    const t = markSample(x, y, paddedBox(w, 0.18), 3);
    return blend(cream, night, t);
  });
  writePng(path.join(electronDir, "icon.png"), icon256);
}

writeWebIconSvg();

const apple = encodePng(180, 180, 3, (x, y, w) => paintNightTile(x, y, w, 0.18, 3));
writePng(path.join(root, "public", "apple-touch-icon.png"), apple);
writePng(path.join(root, "src", "app", "apple-icon.png"), apple);

const appIcon = encodePng(192, 192, 3, (x, y, w) => paintNightTile(x, y, w, 0.14, 4));
writePng(path.join(root, "src", "app", "icon.png"), appIcon);
writePng(path.join(root, "public", "icon.png"), appIcon);

const fav = encodePng(32, 32, 3, (x, y, w) => paintNightTile(x, y, w, 0.12, 4));
writePng(path.join(root, "public", "icon-32.png"), fav);

if (!webOnly) {
  const logo = encodePng(1024, 1024, 4, (x, y, w) => {
    const t = markSample(x, y, paddedBox(w, 0.08), 5);
    return blend(inkA, clear, t);
  });
  writePng(path.join(root, "public", "brand", "cinem-logo.png"), logo);

  const og = encodePng(1200, 630, 3, (x, y, width, height) => {
    const s = 260;
    const box = { x: (width - s) / 2, y: (height - s) / 2, s };
    const t = markSample(x, y, box, 3);
    return blend(cream, night, t);
  });
  writePng(path.join(root, "public", "og.png"), og);
  writePng(path.join(root, "src", "app", "opengraph-image.png"), og);
  writePng(path.join(root, "src", "app", "twitter-image.png"), og);
}

const icoSizes = [16, 32, 48];
const icoPngs = icoSizes.map((size) => ({
  size,
  buf: encodePng(size, size, 4, (x, y, w) => {
    return paintNightTileA(x, y, w, size <= 16 ? 0.1 : 0.12, 4);
  }),
}));
const ico = encodeIco(icoPngs);
writeFileSync(path.join(root, "src", "app", "favicon.ico"), ico);
writeFileSync(path.join(root, "public", "favicon.ico"), ico);
console.log("Wrote favicon.ico", ico.length, "bytes");

if (!webOnly) {
  const appIcoSizes = [16, 24, 32, 48, 64, 128, 256];
  const appIcoPngs = appIcoSizes.map((size) => ({
    size,
    buf: encodePng(size, size, 4, (x, y, w) => {
      const t = markSample(x, y, paddedBox(w, 0.12), size >= 64 ? 4 : 3);
      return blend(paperA, nightA, t);
    }),
  }));
  const appIco = encodeIco(appIcoPngs);
  writeFileSync(path.join(electronDir, "icon.ico"), appIco);
  console.log("Wrote", path.join(electronDir, "icon.ico"), appIco.length, "bytes");

  await import("./make-installer-art.mjs");
}
