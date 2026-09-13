#!/usr/bin/env node
/**
 * Rasterize official CINEM hex-bracket mark into NSIS installer bitmaps.
 * Geometry matches src/lib/cinem-mark.ts and scripts/make-icon.mjs
 * (2 viewBox units extra outward per bracket).
 * No extra deps — raw BMP / PNG / ICO via zlib.
 *
 *   node scripts/make-installer-art.mjs
 *
 * Writes electron/resources/installer/* (header 150×57, sidebar 164×314,
 * splash frames, icon.ico) plus PNG previews for docs / PRs.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "electron", "resources", "installer");

const LEFT = [
  [2, 32],
  [16, 8],
  [28, 8],
  [18, 32],
  [28, 56],
  [16, 56],
];
const RIGHT = [
  [62, 32],
  [48, 8],
  [36, 8],
  [46, 32],
  [36, 56],
  [48, 56],
];

/** 5×7 caps. Pixel-tech look on the 150px header / 164px sidebar. */
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00000", "00100"],
};

const VOID = [7, 8, 10];
const DEEP = [12, 16, 22];
const CREAM = [244, 243, 239];
const NEON = [62, 240, 223];
const NEON_HOT = [180, 255, 246];

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function coverageAt(u, v) {
  return (pointInPoly(u, v, LEFT) ? 1 : 0) + (pointInPoly(u, v, RIGHT) ? 1 : 0) > 0 ? 1 : 0;
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
  return a + (b - a) * t;
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function addRgb(px, rgb, a) {
  if (a <= 0) return;
  px[0] += (rgb[0] - px[0]) * a;
  px[1] += (rgb[1] - px[1]) * a;
  px[2] += (rgb[2] - px[2]) * a;
}

function blur1d(src, w, h, radius, horizontal) {
  const out = new Float32Array(w * h);
  const span = radius * 2 + 1;
  if (horizontal) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const x = Math.max(0, Math.min(w - 1, k));
        sum += src[y * w + x];
      }
      for (let x = 0; x < w; x++) {
        out[y * w + x] = sum / span;
        const leave = Math.max(0, Math.min(w - 1, x - radius));
        const enter = Math.max(0, Math.min(w - 1, x + radius + 1));
        sum += src[y * w + enter] - src[y * w + leave];
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const y = Math.max(0, Math.min(h - 1, k));
        sum += src[y * w + x];
      }
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / span;
        const leave = Math.max(0, Math.min(h - 1, y - radius));
        const enter = Math.max(0, Math.min(h - 1, y + radius + 1));
        sum += src[enter * w + x] - src[leave * w + x];
      }
    }
  }
  return out;
}

function glowMap(cover, w, h, radius) {
  return blur1d(blur1d(cover, w, h, radius, true), w, h, radius, false);
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

function encodePng(pixels, width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const px = pixels[y * width + x];
      const i = row + 1 + x * 3;
      raw[i] = clampByte(px[0]);
      raw[i + 1] = clampByte(px[1]);
      raw[i + 2] = clampByte(px[2]);
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
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function encodePngRgba(paint, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const px = paint(x, y);
      const i = row + 1 + x * 4;
      raw[i] = clampByte(px[0]);
      raw[i + 1] = clampByte(px[1]);
      raw[i + 2] = clampByte(px[2]);
      raw[i + 3] = clampByte(px[3]);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 24-bit bottom-up BI_RGB BMP — what MUI / AdvSplash expect. */
function encodeBmp(pixels, width, height) {
  const rowStride = (width * 3 + 3) & ~3;
  const pixelBytes = rowStride * height;
  const file = Buffer.alloc(14 + 40 + pixelBytes);
  file.write("BM", 0);
  file.writeUInt32LE(file.length, 2);
  file.writeUInt32LE(54, 10);
  file.writeUInt32LE(40, 14);
  file.writeInt32LE(width, 18);
  file.writeInt32LE(height, 22);
  file.writeUInt16LE(1, 26);
  file.writeUInt16LE(24, 28);
  file.writeUInt32LE(0, 30);
  file.writeUInt32LE(pixelBytes, 34);
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    const dest = 54 + y * rowStride;
    for (let x = 0; x < width; x++) {
      const px = pixels[srcY * width + x];
      const i = dest + x * 3;
      file[i] = clampByte(px[2]);
      file[i + 1] = clampByte(px[1]);
      file[i + 2] = clampByte(px[0]);
    }
  }
  return file;
}

function encodeIco(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const entries = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const bodies = [];
  pngs.forEach((png, i) => {
    entries[i * 16] = png.size >= 256 ? 0 : png.size;
    entries[i * 16 + 1] = png.size >= 256 ? 0 : png.size;
    entries.writeUInt16LE(1, i * 16 + 4);
    entries.writeUInt16LE(32, i * 16 + 6);
    entries.writeUInt32LE(png.buf.length, i * 16 + 8);
    entries.writeUInt32LE(offset, i * 16 + 12);
    offset += png.buf.length;
    bodies.push(png.buf);
  });
  return Buffer.concat([header, entries, ...bodies]);
}

function glyphWidth(scale) {
  return 5 * scale + scale;
}

function textWidth(text, scale) {
  return text.length * glyphWidth(scale) - scale;
}

function drawText(pixels, width, height, text, ox, oy, scale, rgb, alpha = 1) {
  let x = Math.round(ox);
  const y0 = Math.round(oy);
  for (const ch of text) {
    const g = FONT[ch] || FONT[" "];
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (g[gy][gx] !== "1") continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = x + gx * scale + sx;
            const py = y0 + gy * scale + sy;
            if (px < 0 || py < 0 || px >= width || py >= height) continue;
            addRgb(pixels[py * width + px], rgb, alpha);
          }
        }
      }
    }
    x += glyphWidth(scale);
  }
}

function canvas(width, height, fill = VOID) {
  return Array.from({ length: width * height }, () => [fill[0], fill[1], fill[2]]);
}

function paintBackdrop(pixels, width, height, { pulse = 0.72, streaks = 0.12, phase = 0 } = {}) {
  const cover = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const yn = y / Math.max(1, height - 1);
      const xn = x / Math.max(1, width - 1);
      const px = pixels[y * width + x];
      px[0] = lerp(VOID[0], DEEP[0], yn * 0.85 + 0.08 * Math.sin(xn * Math.PI));
      px[1] = lerp(VOID[1], DEEP[1], yn * 0.85);
      px[2] = lerp(VOID[2], DEEP[2] + 8, yn);
      const vignette = Math.pow(Math.hypot((xn - 0.5) * 1.15, (yn - 0.42) * 1.05), 2);
      px[0] *= 1 - vignette * 0.45;
      px[1] *= 1 - vignette * 0.4;
      px[2] *= 1 - vignette * 0.28;
      const scan = y % 2 === 0 ? 1 : 0.97;
      px[0] *= scan;
      px[1] *= scan;
      px[2] *= scan;
      const streak = (x * 0.35 + y * 1.15 + phase * 18) % 36;
      if (streak < 1.4) {
        addRgb(px, NEON, streaks * (1 - streak / 1.4));
      }
    }
  }
  return { cover, pulse };
}

function stampMark(pixels, width, height, box, pulse, glowRadius, samples = 3) {
  const cover = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cover[y * width + x] = markSample(x, y, box, samples);
    }
  }
  const glow = glowMap(cover, width, height, glowRadius);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const px = pixels[i];
      const g = Math.min(1, glow[i] * (2.8 * pulse));
      addRgb(px, NEON, g * 0.55);
      addRgb(px, NEON_HOT, Math.pow(g, 2.2) * 0.28);
      addRgb(px, CREAM, cover[i]);
    }
  }
}

function paintSidebar(pulse, phase) {
  const w = 164;
  const h = 314;
  const pixels = canvas(w, h);
  paintBackdrop(pixels, w, h, { pulse, streaks: 0.16, phase });
  const s = 108;
  stampMark(pixels, w, h, { x: (w - s) / 2, y: 28, s }, pulse, 14, 3);
  const title = "CINEM";
  const tw = textWidth(title, 2);
  drawText(pixels, w, h, title, (w - tw) / 2, 148, 2, CREAM, 0.96);
  const pro = "PRO";
  const pw = textWidth(pro, 2);
  drawText(pixels, w, h, pro, (w - pw) / 2, 168, 2, NEON, 0.92);
  for (let x = 36; x < w - 36; x++) {
    addRgb(pixels[190 * w + x], NEON, 0.55 * pulse);
    addRgb(pixels[191 * w + x], NEON, 0.22 * pulse);
  }
  const l1 = "DESK + AI";
  const l2 = "ASSISTANT";
  drawText(pixels, w, h, l1, (w - textWidth(l1, 1)) / 2, 208, 1, CREAM, 0.72);
  drawText(pixels, w, h, l2, (w - textWidth(l2, 1)) / 2, 222, 1, CREAM, 0.72);
  const foot = "SETUP";
  drawText(pixels, w, h, foot, (w - textWidth(foot, 1)) / 2, 286, 1, NEON, 0.45 * pulse);
  return pixels;
}

function paintHeader() {
  const w = 150;
  const h = 57;
  const pixels = canvas(w, h);
  paintBackdrop(pixels, w, h, { pulse: 0.8, streaks: 0.08, phase: 0.2 });
  stampMark(pixels, w, h, { x: 8, y: 8, s: 40 }, 0.85, 7, 4);
  drawText(pixels, w, h, "CINEM", 54, 14, 2, CREAM, 0.96);
  drawText(pixels, w, h, "PRO", 54, 34, 1, NEON, 0.9);
  for (let x = 54; x < 142; x++) addRgb(pixels[48 * w + x], NEON, 0.4);
  return pixels;
}

function paintSplash(pulse, phase) {
  const w = 480;
  const h = 320;
  const pixels = canvas(w, h);
  paintBackdrop(pixels, w, h, { pulse, streaks: 0.2, phase });
  const s = 148;
  stampMark(pixels, w, h, { x: (w - s) / 2, y: 36, s }, pulse, 18, 3);
  const title = "CINEM PRO";
  drawText(pixels, w, h, title, (w - textWidth(title, 3)) / 2, 198, 3, CREAM, 0.96);
  const sub = "DESK + AI ASSISTANT";
  drawText(pixels, w, h, sub, (w - textWidth(sub, 1)) / 2, 236, 1, NEON, 0.8 * pulse);
  for (let x = 150; x < w - 150; x++) {
    addRgb(pixels[258 * w + x], NEON, 0.35 * pulse);
  }
  return pixels;
}

function paintWelcomePreview(sidebar) {
  const w = 499;
  const h = 360;
  const pixels = canvas(w, h, [14, 15, 17]);
  for (let y = 0; y < 314; y++) {
    for (let x = 0; x < 164; x++) {
      const src = sidebar[y * 164 + x];
      pixels[y * w + x] = [src[0], src[1], src[2]];
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 164; x < w; x++) {
      const px = pixels[y * w + x];
      const yn = y / h;
      px[0] = lerp(12, 18, yn);
      px[1] = lerp(13, 18, yn);
      px[2] = lerp(16, 22, yn);
    }
  }
  drawText(pixels, w, h, "CINEM PRO", 188, 48, 2, CREAM, 0.96);
  drawText(pixels, w, h, "DESK + AI ASSISTANT", 188, 78, 1, NEON, 0.85);
  const lines = [
    "THIS SETUP INSTALLS THE CLOUD",
    "DESK AND THE ON-DEVICE",
    "ASSISTANT TOGETHER.",
    "",
    "AFTER SETUP OPEN DESK. AI",
    "ASSISTANT. OR BOTH.",
  ];
  lines.forEach((line, i) => {
    if (!line) return;
    drawText(pixels, w, h, line, 188, 118 + i * 16, 1, CREAM, 0.7);
  });
  for (let y = 318; y < h; y++) {
    for (let x = 0; x < w; x++) {
      pixels[y * w + x] = [16, 17, 20];
    }
  }
  const nextX = 360;
  for (let y = 326; y < 348; y++) {
    for (let x = nextX; x < nextX + 64; x++) addRgb(pixels[y * w + x], NEON, 0.22);
  }
  drawText(pixels, w, h, "NEXT", nextX + 14, 331, 1, CREAM, 0.95);
  drawText(pixels, w, h, "CANCEL", 268, 331, 1, CREAM, 0.45);
  return pixels;
}

function paintInstallPreview(header) {
  const w = 499;
  const h = 360;
  const pixels = canvas(w, h, [244, 243, 239]);
  for (let y = 0; y < 57; y++) {
    for (let x = 0; x < 150; x++) {
      const src = header[y * 150 + x];
      pixels[y * w + (w - 150 + x)] = [src[0], src[1], src[2]];
    }
    for (let x = 0; x < w - 150; x++) {
      pixels[y * w + x] = [12, 13, 16];
    }
  }
  drawText(pixels, w, h, "CINEM PRO", 16, 12, 2, CREAM, 0.95);
  drawText(pixels, w, h, "DESK + AI ASSISTANT", 16, 34, 1, NEON, 0.75);
  for (let y = 57; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const yn = (y - 57) / (h - 57);
      pixels[y * w + x] = [lerp(12, 18, yn), lerp(13, 18, yn), lerp(16, 22, yn)];
    }
  }
  drawText(pixels, w, h, "INSTALLING CINEM PRO", 36, 120, 1, CREAM, 0.85);
  for (let x = 36; x < 463; x++) {
    addRgb(pixels[168 * w + x], [30, 36, 40], 1);
    addRgb(pixels[169 * w + x], [30, 36, 40], 1);
    addRgb(pixels[170 * w + x], [30, 36, 40], 1);
    addRgb(pixels[171 * w + x], [30, 36, 40], 1);
    if (x < 280) {
      addRgb(pixels[168 * w + x], NEON, 0.85);
      addRgb(pixels[169 * w + x], NEON, 0.85);
      addRgb(pixels[170 * w + x], NEON, 0.7);
      addRgb(pixels[171 * w + x], NEON, 0.55);
    }
  }
  drawText(pixels, w, h, "COPYING DESK + AI ASSISTANT", 36, 188, 1, CREAM, 0.55);
  return pixels;
}

function writeBmp(stem, pixels, width, height) {
  const bmp = encodeBmp(pixels, width, height);
  writeFileSync(path.join(outDir, `${stem}.bmp`), bmp);
  console.log("Wrote", `electron/resources/installer/${stem}.bmp`, bmp.length, "bytes");
}

function writePng(stem, pixels, width, height) {
  const png = encodePng(pixels, width, height);
  writeFileSync(path.join(outDir, `${stem}.png`), png);
  console.log("Wrote", `electron/resources/installer/${stem}.png`, png.length, "bytes");
}

function writeBoth(stem, pixels, width, height) {
  writeBmp(stem, pixels, width, height);
  writePng(stem, pixels, width, height);
}

function writeIcon() {
  const sizes = [16, 32, 48, 256];
  const pngs = sizes.map((size) => {
    const pad = size <= 32 ? 0.08 : 0.16;
    const box = { x: size * pad, y: size * pad, s: size * (1 - pad * 2) };
    const buf = encodePngRgba((x, y) => {
      const t = markSample(x, y, box, size >= 48 ? 4 : 3);
      const r = lerp(VOID[0], CREAM[0], t);
      const g = lerp(VOID[1], CREAM[1], t);
      const b = lerp(VOID[2], CREAM[2], t);
      return [r, g, b, 255];
    }, size, size);
    return { size, buf };
  });
  const ico = encodeIco(pngs);
  writeFileSync(path.join(outDir, "icon.ico"), ico);
  writeFileSync(path.join(outDir, "icon-256.png"), pngs[pngs.length - 1].buf);
  console.log("Wrote", "electron/resources/installer/icon.ico", ico.length, "bytes");
}

export function parseBmpSize(buf) {
  if (buf.length < 54 || buf[0] !== 0x42 || buf[1] !== 0x4d) {
    return null;
  }
  return {
    width: buf.readInt32LE(18),
    height: Math.abs(buf.readInt32LE(22)),
    bits: buf.readUInt16LE(28),
  };
}

mkdirSync(outDir, { recursive: true });

const header = paintHeader();
writeBoth("header", header, 150, 57);

const sidebar = paintSidebar(0.82, 0.15);
writeBoth("sidebar", sidebar, 164, 314);

const splash = paintSplash(0.88, 0.4);
writeBoth("splash", splash, 480, 320);
writePng("splash-0", paintSplash(0.55, 0.05), 480, 320);
writePng("splash-1", paintSplash(0.88, 0.35), 480, 320);
writePng("splash-2", paintSplash(1.15, 0.7), 480, 320);

writePng("preview-welcome", paintWelcomePreview(sidebar), 499, 360);
writePng("preview-install", paintInstallPreview(header), 499, 360);

writeIcon();

console.log("CINEM Pro installer art ready in electron/resources/installer/");
