import fs from "node:fs";
import { config, validateConfig } from "./config.js";
import { startWorker } from "./lib/queue.js";
import { runJob } from "./pipeline/index.js";
import { log } from "./lib/log.js";

const missing = validateConfig();
if (missing.length) {
  log.error("Worker start nahi ho sakta — .env missing:", missing.join(", "));
  process.exit(1);
}
if (!config.redisUrl) {
  log.error("REDIS_URL set nahi — bina Redis ke worker server process ke andar hi chalta hai (npm start kaafi hai).");
  process.exit(1);
}

fs.mkdirSync(config.storageDir, { recursive: true });
await startWorker(runJob);
log.info("Cinem AI Assistant worker chal raha hai (BullMQ)");
