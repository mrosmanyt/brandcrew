/**
 * Writes src-tauri/icons/icon.png + icon.ico from app-icon.png
 * so a Windows NSIS build has icons before `npx tauri icon`.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pngPath = join(root, "app-icon.png");
if (!existsSync(pngPath)) {
  await import("./make-icon.mjs");
}
const png = readFileSync(pngPath);
const iconsDir = join(root, "src-tauri", "icons");
mkdirSync(iconsDir, { recursive: true });
copyFileSync(pngPath, join(iconsDir, "icon.png"));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0);
entry.writeUInt8(0, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);
writeFileSync(join(iconsDir, "icon.ico"), Buffer.concat([header, entry, png]));
console.log("✓ src-tauri/icons/icon.png + icon.ico");
