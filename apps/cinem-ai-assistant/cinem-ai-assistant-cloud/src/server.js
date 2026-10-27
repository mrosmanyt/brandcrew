import fs from "node:fs";
import { config, validateConfig } from "./config.js";
import { createApp } from "./app.js";
import { startWorker } from "./lib/queue.js";
import { runJob } from "./pipeline/index.js";
import { log } from "./lib/log.js";

const missing = validateConfig();
if (missing.length) {
  log.error("Cinem AI Assistant CLOUD start nahi ho sakta — .env me ye missing hai:");
  missing.forEach((m) => log.error("  •", m));
  log.error("Hint: cp .env.example .env  → values bharo. Test ke liye: CINEM-AI-ASSISTANT_MOCK=1");
  process.exit(1);
}

fs.mkdirSync(config.storageDir, { recursive: true });

const app = createApp();
app.listen(config.port, () => {
  log.info(`Cinem AI Assistant CLOUD (Brain) ready → ${config.publicUrl}  [${config.mock ? "MOCK" : "LIVE"} mode]`);
});

// Single-VPS mode: REDIS_URL nahi to worker isi process me chalta hai.
// Redis ke saath: alag process me `npm run worker` chalao (scale).
if (!config.redisUrl) {
  await startWorker(runJob);
} else {
  log.info("Redis mode: worker alag process me chalao → npm run worker");
}
