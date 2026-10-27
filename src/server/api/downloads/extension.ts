import { jsonError } from "@/lib/http";
import {
  EXTENSION_ZIP_NAME,
  extensionZipContentType,
  packExtensionDirectory,
} from "@/lib/extension-zip";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function loadPackagedZip() {
  const packaged = join(process.cwd(), "public/downloads", EXTENSION_ZIP_NAME);
  if (existsSync(packaged)) return readFileSync(packaged);
  const extensionDir = join(process.cwd(), "extension");
  if (existsSync(join(extensionDir, "manifest.json"))) {
    return packExtensionDirectory(extensionDir);
  }
  return null;
}

export async function GET() {
  try {
    const zip = loadPackagedZip();
    if (!zip) {
      return jsonError(new Error("Chrome extension zip is not packaged yet."));
    }
    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": extensionZipContentType(),
        "Content-Disposition": `attachment; filename="${EXTENSION_ZIP_NAME}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
