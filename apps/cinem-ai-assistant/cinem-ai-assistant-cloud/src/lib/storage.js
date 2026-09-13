import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

/**
 * v1: local disk (VPS ke liye kaafi, sasta). Aage chal kar yahan Cloudflare R2
 * driver add hoga — sirf is file me change karna padega, baaki code same.
 * Har user ki files uske apne folder me: storage/<userId>/<jobId>/
 */
export function jobDir(userId, jobId) {
  const dir = path.join(config.storageDir, sanitize(userId), sanitize(jobId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function filePath(userId, jobId, name) {
  return path.join(jobDir(userId, jobId), name);
}

export function exists(p) {
  try { return !!p && fs.existsSync(p); } catch { return false; }
}

// Path traversal guard — user/job ids kabhi ".." ya slash na le aayen.
function sanitize(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "_");
}
