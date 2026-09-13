import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import {
  CINEM_AI_ASSISTANT_DOCS,
  CINEM_AI_ASSISTANT_DOWNLOAD_API,
  CINEM_AI_ASSISTANT_PUBLIC_PATH,
  CINEM_AI_ASSISTANT_SETUP_FILENAME,
  cinemAiAssistantReleaseUrl,
  cinemAiAssistantSetupEnvUrl,
} from "@/lib/cinem-ai-assistant";
import { jsonOk } from "@/lib/http";

function localSetupPath() {
  return join(process.cwd(), "public/downloads", CINEM_AI_ASSISTANT_SETUP_FILENAME);
}

export function resolveCinemAiAssistantDownload() {
  const local = localSetupPath();
  if (existsSync(local)) {
    return { kind: "file" as const, path: local, href: CINEM_AI_ASSISTANT_PUBLIC_PATH };
  }
  const envUrl = cinemAiAssistantSetupEnvUrl();
  if (envUrl) {
    return { kind: "redirect" as const, href: envUrl };
  }
  return { kind: "redirect" as const, href: cinemAiAssistantReleaseUrl() };
}

export async function GET(request: Request) {
  const accept = request.headers.get("accept") || "";
  const resolved = resolveCinemAiAssistantDownload();

  if (resolved.kind === "file") {
    const bytes = readFileSync(resolved.path);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${CINEM_AI_ASSISTANT_SETUP_FILENAME}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (accept.includes("application/json")) {
    const localMissing = !existsSync(localSetupPath());
    return jsonOk({
      filename: CINEM_AI_ASSISTANT_SETUP_FILENAME,
      href: resolved.href,
      publicPath: CINEM_AI_ASSISTANT_PUBLIC_PATH,
      api: CINEM_AI_ASSISTANT_DOWNLOAD_API,
      present: !localMissing || Boolean(cinemAiAssistantSetupEnvUrl()),
      docs: CINEM_AI_ASSISTANT_DOCS,
      note:
        localMissing && !cinemAiAssistantSetupEnvUrl()
          ? `Drop ${CINEM_AI_ASSISTANT_SETUP_FILENAME} in public/downloads or set CINEM_AI_ASSISTANT_SETUP_URL.`
          : undefined,
    });
  }

  return NextResponse.redirect(resolved.href, 302);
}
