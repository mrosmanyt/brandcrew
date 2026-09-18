import { NextResponse } from "next/server";
import {
  CINEM_AI_ASSISTANT_DOCS,
  CINEM_AI_ASSISTANT_DOWNLOAD_API,
  CINEM_AI_ASSISTANT_SETUP_FILENAME,
  CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME,
  cinemAiAssistantAdvancedReleaseUrl,
  cinemAiAssistantDownloadHref,
} from "@/lib/cinem-ai-assistant";
import { jsonOk } from "@/lib/http";

export function resolveCinemAiAssistantDownload(advanced = false) {
  const href = advanced ? cinemAiAssistantAdvancedReleaseUrl() : cinemAiAssistantDownloadHref();
  const filename = advanced
    ? CINEM_AI_ASSISTANT_SETUP_FILENAME
    : CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME;
  return { href, filename };
}

export async function GET(request: Request) {
  const accept = request.headers.get("accept") || "";
  const advanced = new URL(request.url).searchParams.get("advanced") === "1";
  const resolved = resolveCinemAiAssistantDownload(advanced);

  if (accept.includes("application/json")) {
    return jsonOk({
      filename: resolved.filename,
      href: resolved.href,
      direct: true,
      api: CINEM_AI_ASSISTANT_DOWNLOAD_API,
      unified: !advanced,
      present: true,
      docs: CINEM_AI_ASSISTANT_DOCS,
      note: advanced
        ? `Optional Tauri-only installer. The primary download is ${CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME}.`
        : `Unified Windows installer (${CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME}) includes Desk and AI Assistant.`,
    });
  }

  return NextResponse.redirect(resolved.href, 307);
}
