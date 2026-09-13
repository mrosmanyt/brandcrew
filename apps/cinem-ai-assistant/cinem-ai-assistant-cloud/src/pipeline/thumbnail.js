import { ffmpeg } from "../lib/ffmpeg.js";
import { filePath } from "../lib/storage.js";

/**
 * Step 4 — thumbnail: video ke 1s frame se JPG (YouTube limit 2MB).
 * (Desktop app ka fancy thumbnail generator baad me yahan port hoga —
 * v1 me frame-grab reliable + zero extra dependencies hai.)
 */
export async function makeThumbnail({ userId, jobId, videoPath }) {
  const out = filePath(userId, jobId, "thumb.jpg");
  await ffmpeg(["-ss", "1", "-i", videoPath, "-frames:v", "1", "-q:v", "3", "-vf", "scale=1280:720", out]);
  return out;
}
