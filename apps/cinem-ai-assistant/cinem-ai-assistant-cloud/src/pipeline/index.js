import fs from "node:fs";
import { db } from "../lib/db.js";
import { log } from "../lib/log.js";
import { sendTelegram } from "../lib/notify.js";
import { filePath } from "../lib/storage.js";
import { writeScript } from "./script.js";
import { writeSeo } from "./seo.js";
import { renderVideo } from "./video.js";
import { makeThumbnail } from "./thumbnail.js";
import { publish } from "./upload.js";

/**
 * Pura pipeline: script → SEO → video → thumbnail → upload.
 * - Har step DB me record hota hai (dashboard "thought process" ke liye)
 * - Fail hone par credits REFUND (client ka paisa kabhi hawa me nahi jata)
 * - Job done/fail par Telegram notification (agar linked hai)
 */
export async function runJob(jobId) {
  const job = await db.getJob(jobId);
  if (!job) return log.warn(`Job ${jobId} DB me nahi mili`);
  if (job.status === "done") return; // BullMQ retry par double-run guard

  const { user_id: userId, topic, model_tier: tier } = job;
  const step = async (name, note = "") => {
    const steps = [...(job.steps || []), { step: name, at: new Date().toISOString(), ...(note ? { note } : {}) }];
    job.steps = steps;
    await db.updateJob(jobId, { status: name, steps });
    log.info(`[${jobId.slice(0, 8)}] → ${name}${note ? ` (${note})` : ""}`);
  };

  try {
    // 1. Script
    await step("script");
    const script = await writeScript(tier, topic);
    fs.writeFileSync(filePath(userId, jobId, "script.md"), script);

    // 2. SEO
    await step("seo");
    const seo = await writeSeo(tier, topic, script);

    // 3. Video
    await step("video");
    const videoPath = await renderVideo({ userId, jobId, topic, script });

    // 4. Thumbnail
    await step("thumbnail");
    let thumbPath = null;
    try {
      thumbPath = await makeThumbnail({ userId, jobId, videoPath });
    } catch (e) {
      log.warn(`[${jobId.slice(0, 8)}] thumbnail fail (video theek hai):`, e.message);
    }

    // 5. Upload (agar auto_upload on hai)
    let result = { uploaded: false, note: "auto-upload off tha" };
    if (job.auto_upload) {
      await step("upload");
      result = await publish({ userId, videoPath, thumbPath, seo, privacy: job.privacy || "public" });
    }

    await db.updateJob(jobId, {
      status: "done",
      script,
      seo,
      video_path: videoPath,
      thumb_path: thumbPath,
      youtube_video_id: result.videoId || null,
      youtube_url: result.url || null,
      uploaded: !!result.uploaded,
      note: result.note || null,
      steps: [...job.steps, { step: "done", at: new Date().toISOString() }],
    });
    await db.addUsage(userId, { kind: "video_done", credits: 0, job_id: jobId, meta: { tier, uploaded: !!result.uploaded } });

    const profile = await db.getProfile(userId).catch(() => null);
    await sendTelegram(profile?.telegram_chat_id,
      `✅ <b>Cinem AI Assistant</b>: video tayar!\n📝 ${seo.title}\n${result.url ? `▶ ${result.url}` : "⬇ Dashboard se download karein"}`);
  } catch (e) {
    log.error(`[${jobId.slice(0, 8)}] FAILED:`, e.message);
    // Refund — fail hui job ke credits wapas
    let refunded = 0;
    try {
      refunded = job.credits_cost || 0;
      if (refunded > 0) {
        await db.refundCredits(userId, refunded);
        await db.addUsage(userId, { kind: "refund", credits: refunded, job_id: jobId, meta: { reason: e.message.slice(0, 200) } });
      }
    } catch (re) {
      log.error("Refund fail:", re.message);
    }
    await db.updateJob(jobId, {
      status: "failed",
      error: e.message.slice(0, 500),
      steps: [...(job.steps || []), { step: "failed", at: new Date().toISOString(), note: e.message.slice(0, 200) }],
    });
    const profile = await db.getProfile(userId).catch(() => null);
    await sendTelegram(profile?.telegram_chat_id,
      `❌ <b>Cinem AI Assistant</b>: video fail ho gayi.\n${e.message.slice(0, 200)}\n${refunded ? `💳 ${refunded} credits refund ho gaye.` : ""}`);
  }
}
