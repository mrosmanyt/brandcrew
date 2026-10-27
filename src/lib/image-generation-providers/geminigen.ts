/**
 * GeminiGen image API — async job + poll (webhook cache optional).
 * Docs: https://docs.geminigen.ai · https://geminigen.ai/uapi/image/generate
 */
import {
  GEMINIGEN_DEFAULT_MODEL,
  GEMINIGEN_IMAGE_MODELS,
  type GeminiGenImageModel,
  isPlaceholderSecret,
  mimeFromUrl,
  normalizeImagePrompt,
} from "@/lib/image-generation-pure";
import { prisma } from "@/lib/db";

export type GeminiGenCredentials = {
  apiKey: string;
  baseUrl: string;
  source: "env" | "byok";
};

const POLL_MS = 2500;
const POLL_MAX_MS = 120_000;
const WEBHOOK_TTL_MS = 15 * 60 * 1000;

export function geminigenBaseUrl() {
  return (process.env.GEMINIGEN_BASE_URL?.trim() || "https://geminigen.ai").replace(/\/$/, "");
}

export function geminigenDefaultModel(): GeminiGenImageModel {
  const raw = process.env.GEMINIGEN_IMAGE_MODEL?.trim();
  if (raw && (GEMINIGEN_IMAGE_MODELS as readonly string[]).includes(raw)) {
    return raw as GeminiGenImageModel;
  }
  return GEMINIGEN_DEFAULT_MODEL;
}

export function geminigenConfigured(creds: { apiKey: string } | null): boolean {
  return Boolean(creds && !isPlaceholderSecret(creds.apiKey));
}

type GeminiGenJob = {
  uuid?: string;
  status?: number;
  status_percentage?: number;
  error_message?: string;
  error_code?: string;
  media_url?: string;
  generate_result?: string | { media_url?: string } | null;
  result?: GeminiGenJob;
};

function unwrapJob(raw: unknown): GeminiGenJob {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  if (obj.result && typeof obj.result === "object") {
    return { ...(obj.result as GeminiGenJob), ...(raw as GeminiGenJob) };
  }
  if (obj.data && typeof obj.data === "object") {
    return { ...(obj.data as GeminiGenJob), ...(raw as GeminiGenJob) };
  }
  return raw as GeminiGenJob;
}

function mediaUrlFromJob(job: GeminiGenJob): string {
  if (job.media_url) return job.media_url;
  const gr = job.generate_result;
  if (typeof gr === "string" && gr.startsWith("http")) return gr;
  if (gr && typeof gr === "object" && gr.media_url) return gr.media_url;
  return "";
}

function geminigenError(job: GeminiGenJob, fallback: string) {
  if (job.error_message) return job.error_message;
  if (job.error_code) return job.error_code;
  return fallback;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readGeminiGenWebhookCache(uuid: string) {
  const row = await prisma.imageGenAsyncResult.findUnique({ where: { uuid } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.imageGenAsyncResult.delete({ where: { uuid } }).catch(() => undefined);
    return null;
  }
  return row;
}

export async function writeGeminiGenWebhookCache(input: {
  uuid: string;
  mediaUrl: string;
  status: number;
  errorMessage?: string;
}) {
  const expiresAt = new Date(Date.now() + WEBHOOK_TTL_MS);
  await prisma.imageGenAsyncResult.upsert({
    where: { uuid: input.uuid },
    create: {
      uuid: input.uuid,
      mediaUrl: input.mediaUrl,
      status: input.status,
      errorMessage: input.errorMessage || "",
      expiresAt,
    },
    update: {
      mediaUrl: input.mediaUrl,
      status: input.status,
      errorMessage: input.errorMessage || "",
      expiresAt,
    },
  });
}

async function submitGeminiGenJob(
  creds: GeminiGenCredentials,
  prompt: string,
  model: GeminiGenImageModel,
): Promise<string> {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("model", model);

  const multipartRes = await fetch(`${creds.baseUrl}/uapi/image/generate`, {
    method: "POST",
    headers: { "x-api-key": creds.apiKey },
    body: form,
  });

  let job = unwrapJob(await multipartRes.json().catch(() => ({})));
  if (multipartRes.ok && job.uuid) return job.uuid;

  const jsonRes = await fetch(`${creds.baseUrl}/uapi/v1/generate`, {
    method: "POST",
    headers: {
      "x-api-key": creds.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "image", prompt, model }),
  });
  job = unwrapJob(await jsonRes.json().catch(() => ({})));

  if (!jsonRes.ok) {
    throw new Error(
      geminigenError(job, `GeminiGen returned HTTP ${jsonRes.status || multipartRes.status}.`),
    );
  }
  if (!job.uuid) {
    throw new Error(geminigenError(job, "GeminiGen did not return a job id."));
  }
  return job.uuid;
}

async function pollGeminiGenJob(
  creds: GeminiGenCredentials,
  uuid: string,
): Promise<GeminiGenJob> {
  const cached = await readGeminiGenWebhookCache(uuid);
  if (cached?.mediaUrl && cached.status === 2) {
    return { uuid, status: 2, media_url: cached.mediaUrl };
  }
  if (cached?.errorMessage && cached.status >= 3) {
    throw new Error(cached.errorMessage);
  }

  const paths = [
    `/uapi/image/history/${uuid}`,
    `/uapi/v1/history/${uuid}`,
    `/uapi/history/${uuid}`,
  ];
  const deadline = Date.now() + POLL_MAX_MS;

  while (Date.now() < deadline) {
    for (const path of paths) {
      const res = await fetch(`${creds.baseUrl}${path}`, {
        headers: { "x-api-key": creds.apiKey },
      });
      if (!res.ok) continue;
      const job = unwrapJob(await res.json().catch(() => ({})));
      const mediaUrl = mediaUrlFromJob(job);
      const status = job.status ?? 0;

      if (status === 2 && mediaUrl) return { ...job, uuid, media_url: mediaUrl, status: 2 };
      if (status >= 3 || job.error_message) {
        throw new Error(geminigenError(job, "GeminiGen image generation failed."));
      }
      if (mediaUrl && (job.status_percentage ?? 0) >= 100) {
        return { ...job, uuid, media_url: mediaUrl, status: 2 };
      }
    }

    const webhookHit = await readGeminiGenWebhookCache(uuid);
    if (webhookHit?.mediaUrl && webhookHit.status === 2) {
      return { uuid, status: 2, media_url: webhookHit.mediaUrl };
    }

    await sleep(POLL_MS);
  }

  throw new Error("GeminiGen image generation timed out. Configure a webhook or retry.");
}

async function downloadGeminiGenMedia(mediaUrl: string) {
  const res = await fetch(mediaUrl);
  if (!res.ok) {
    throw new Error(`Could not download GeminiGen image (HTTP ${res.status}).`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 128) {
    throw new Error("GeminiGen returned an empty image.");
  }
  const contentType = res.headers.get("content-type") || mimeFromUrl(mediaUrl);
  const mimeType = contentType.split(";")[0].trim() || mimeFromUrl(mediaUrl);
  return {
    imageBase64: bytes.toString("base64"),
    mimeType,
    mediaUrl,
  };
}

export async function generateGeminiGenImage(
  creds: GeminiGenCredentials,
  rawPrompt: string,
  model?: string,
) {
  const prompt = normalizeImagePrompt(rawPrompt);
  const modelName =
    model && (GEMINIGEN_IMAGE_MODELS as readonly string[]).includes(model)
      ? (model as GeminiGenImageModel)
      : geminigenDefaultModel();

  const uuid = await submitGeminiGenJob(creds, prompt, modelName);
  const job = await pollGeminiGenJob(creds, uuid);
  const mediaUrl = mediaUrlFromJob(job);
  if (!mediaUrl) {
    throw new Error("GeminiGen completed without a media URL.");
  }

  const downloaded = await downloadGeminiGenMedia(mediaUrl);
  return {
    imageBase64: downloaded.imageBase64,
    mimeType: downloaded.mimeType,
    mediaUrl: downloaded.mediaUrl,
    prompt,
    provider: "geminigen" as const,
    model: modelName,
    source: creds.source,
    jobId: uuid,
  };
}
