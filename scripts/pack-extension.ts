import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { packExtensionDirectory, EXTENSION_ZIP_NAME } from "../src/lib/extension-zip";

const extensionDir = join(process.cwd(), "extension");
const manifest = JSON.parse(readFileSync(join(extensionDir, "manifest.json"), "utf8")) as {
  host_permissions?: string[];
};
const blockedHosts = (manifest.host_permissions ?? []).filter((h) =>
  /localhost|127\.0\.0\.1/i.test(h),
);
if (blockedHosts.length > 0) {
  throw new Error(
    `Chrome Web Store rejects localhost host_permissions: ${blockedHosts.join(", ")}`,
  );
}

const zip = packExtensionDirectory(extensionDir);
const out = join(process.cwd(), "public/downloads", EXTENSION_ZIP_NAME);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, zip);
console.log(`wrote ${out} (${zip.length} bytes)`);
