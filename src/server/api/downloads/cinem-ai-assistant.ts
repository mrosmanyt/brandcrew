import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import {
  CINEM_AI_ASSISTANT_ADVANCED_PUBLIC_PATH,
  CINEM_AI_ASSISTANT_DOCS,
  CINEM_AI_ASSISTANT_DOWNLOAD_API,
  CINEM_AI_ASSISTANT_PUBLIC_PATH,
  CINEM_AI_ASSISTANT_SETUP_FILENAME,
  CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME,
  cinemAiAssistantAdvancedReleaseUrl,
  cinemAiAssistantReleaseUrl,
  cinemAiAssistantSetupEnvUrl,
} from "@/lib/cinem-ai-assistant";
import { jsonOk } from "@/lib/http";

function localPath(filename: string) {
  return join(process.cwd(), "public/downloads", filename);
}

export function resolveCinemAiAssistantDownload(advanced = false) {
  const envUrl = cinemAiAssistantSetupEnvUrl();
  if (!advanced && envUrl) {
    return { kind: "redirect" as const, href: envUrl, filename: CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME };
  }

  const unifiedLocal = localPath(CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME);
  if (!advanced && existsSync(unifiedLocal)) {
    return {
      kind: "file" as const,
      path: unifiedLocal,
      href: CINEM_AI_ASSISTANT_PUBLIC_PATH,
      filename: CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME,
    };
  }

  if (!advanced) {
    return {
      kind: "redirect" as const,
      href: cinemAiAssistantReleaseUrl(),
      filename: CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME,
    };
  }

  const advancedLocal = localPath(CINEM_AI_ASSISTANT_SETUP_FILENAME);
  if (existsSync(advancedLocal)) {
    return {
      kind: "file" as const,
      path: advancedLocal,
      href: CINEM_AI_ASSISTANT_ADVANCED_PUBLIC_PATH,
      filename: CINEM_AI_ASSISTANT_SETUP_FILENAME,
    };
  }
  if (envUrl) {
    return { kind: "redirect" as const, href: envUrl, filename: CINEM_AI_ASSISTANT_SETUP_FILENAME };
  }
  return {
    kind: "redirect" as const,
    href: cinemAiAssistantAdvancedReleaseUrl(),
    filename: CINEM_AI_ASSISTANT_SETUP_FILENAME,
  };
}

export async function GET(request: Request) {
  const accept = request.headers.get("accept") || "";
  const advanced = new URL(request.url).searchParams.get("advanced") === "1";
  const resolved = resolveCinemAiAssistantDownload(advanced);

  if (resolved.kind === "file") {
    const bytes = readFileSync(resolved.path);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${resolved.filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (accept.includes("application/json")) {
    return jsonOk({
      filename: resolved.filename,
      href: resolved.href,
      publicPath: advanced ? CINEM_AI_ASSISTANT_ADVANCED_PUBLIC_PATH : CINEM_AI_ASSISTANT_PUBLIC_PATH,
      api: CINEM_AI_ASSISTANT_DOWNLOAD_API,
      unified: !advanced,
      present: true,
      docs: CINEM_AI_ASSISTANT_DOCS,
      note: advanced
        ? `Optional Tauri-only installer. The primary download is ${CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME}.`
        : `Unified Windows installer (${CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME}) includes Desk and AI Assistant.`,
    });
  }

  return NextResponse.redirect(resolved.href, 302);
}
