import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { packExtensionDirectory, EXTENSION_ZIP_NAME } from "../src/lib/extension-zip";

const zip = packExtensionDirectory(join(process.cwd(), "extension"));
const out = join(process.cwd(), "public/downloads", EXTENSION_ZIP_NAME);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, zip);
console.log(`wrote ${out} (${zip.length} bytes)`);
