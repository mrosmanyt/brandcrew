import { config } from "../config.js";
import { db } from "../lib/db.js";
import { clientFor, uploadVideo, setThumbnail } from "../lib/youtube.js";
import { log } from "../lib/log.js";

/**
 * Step 5 — YouTube par OFFICIAL API se upload.
 * Account connected nahi → upload skip, video phir bhi download ke liye
 * ready rehti hai (job fail nahi hoti).
 */
export async function publish({ userId, videoPath, thumbPath, seo, privacy = "public" }) {
  if (config.mock) {
    return { uploaded: true, videoId: `mock-${Math.random().toString(36).slice(2, 8)}`, url: "https://youtu.be/MOCK", note: "mock upload" };
  }

  const account = await db.getAccount(userId, "youtube");
  if (!account) {
    return { uploaded: false, note: "YouTube connect nahi hai — video download ke liye ready hai. Dashboard se Connect karein." };
  }

  const auth = clientFor(account);
  const videoId = await uploadVideo(auth, {
    filePath: videoPath,
    title: seo.title,
    description: seo.description,
    tags: seo.tags,
    privacyStatus: privacy,
  });
  try {
    if (thumbPath) await setThumbnail(auth, videoId, thumbPath);
  } catch (e) {
    // Thumbnail set hone me fail (naya channel: phone verification chahiye) —
    // upload phir bhi kaamyaab hai, isliye job fail nahi karte.
    log.warn(`Thumbnail set nahi hua (${videoId}):`, e.message);
  }
  return { uploaded: true, videoId, url: `https://youtu.be/${videoId}` };
}
