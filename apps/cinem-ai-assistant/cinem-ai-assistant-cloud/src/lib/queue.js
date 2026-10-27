import { config } from "../config.js";
import { log } from "./log.js";

/**
 * Job queue — do modes, ek interface:
 *  - REDIS_URL set  → BullMQ (retries, scale, multiple workers)
 *  - REDIS_URL khali → in-process queue (chhote VPS par ek hi process
 *    me API + worker; 100 clients tak ye kaafi hai — Blueprint: pehle
 *    revenue, phir infra kharch)
 */
const QUEUE_NAME = "cinem-ai-assistant-videos";
let bull = null;
let localChain = Promise.resolve();
let localHandler = null;
let pendingBeforeHandler = [];

export async function enqueueJob(jobId) {
  if (config.redisUrl) {
    const { Queue } = await import("bullmq");
    bull ||= new Queue(QUEUE_NAME, { connection: { url: config.redisUrl } });
    await bull.add("video", { jobId }, { attempts: 2, backoff: { type: "exponential", delay: 15_000 }, removeOnComplete: 200, removeOnFail: 500 });
  } else {
    if (!localHandler) { pendingBeforeHandler.push(jobId); return; }
    runLocal(jobId);
  }
}

function runLocal(jobId) {
  localChain = localChain
    .then(() => localHandler(jobId))
    .catch((e) => log.error(`Job ${jobId} crashed:`, e.message));
}

/** Worker start — handler(jobId) pura pipeline chalata hai. */
export async function startWorker(handler) {
  if (config.redisUrl) {
    const { Worker } = await import("bullmq");
    new Worker(QUEUE_NAME, async (job) => handler(job.data.jobId), {
      connection: { url: config.redisUrl },
      concurrency: 2,
    });
    log.info(`Worker ready (BullMQ @ ${config.redisUrl})`);
  } else {
    localHandler = handler;
    const backlog = pendingBeforeHandler; pendingBeforeHandler = [];
    backlog.forEach(runLocal);
    log.info("Worker ready (in-process queue — REDIS_URL set karke BullMQ par shift ho sakta hai)");
  }
}
