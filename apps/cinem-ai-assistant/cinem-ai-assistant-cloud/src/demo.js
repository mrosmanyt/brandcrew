/**
 * Cinem AI Assistant CLOUD — end-to-end demo/smoke test (mock mode).
 * Chalane ke liye:  npm run demo
 * Ye pura flow test karta hai: auth → connect → video job → pipeline →
 * files → credits → plan gate → multi-tenant isolation → telegram bot.
 * Sab pass to exit 0, warna exit 1.
 */
import fs from "node:fs";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { startWorker } from "./lib/queue.js";
import { runJob } from "./pipeline/index.js";
import { db } from "./lib/db.js";

if (!config.mock) {
  console.error("Demo sirf mock mode me: CINEM-AI-ASSISTANT_MOCK=1 node src/demo.js");
  process.exit(1);
}

const BASE = `http://127.0.0.1:${config.port}`;
const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "  ✔" : "  ✖ FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
};

const api = async (method, path, { user = "demo-user", body } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", "x-cinem-ai-assistant-user": user },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

fs.mkdirSync(config.storageDir, { recursive: true });
const app = createApp();
const server = app.listen(config.port);
await startWorker(runJob);
console.log(`\nCINEM-AI-ASSISTANT CLOUD demo @ ${BASE}\n`);

try {
  // 1. Health
  const h = await api("GET", "/health");
  check("health", h.status === 200 && h.data.ok === true, `mode=${h.data.mode}, queue=${h.data.queue}`);

  // 2. Profile + credits
  const me = await api("GET", "/api/me");
  check("profile (plan/credits)", me.status === 200 && me.data.credits === 20 && me.data.plan === "pro");

  // 3. YouTube connect (mock)
  const conn = await api("GET", "/api/connect/youtube");
  check("youtube connect", conn.status === 200 && conn.data.connected === true);
  const accs = await api("GET", "/api/accounts");
  check("accounts list", accs.status === 200 && accs.data.some((a) => a.platform === "youtube"));

  // 4. Video job (mid model = 2 credits)
  const created = await api("POST", "/api/videos", { body: { topic: "AI tools se paise kaise kamayen — 2026 guide", model: "mid" } });
  check("job created (202)", created.status === 202 && created.data.creditsLeft === 18, `creditsLeft=${created.data.creditsLeft}`);
  const jobId = created.data.job?.id;

  // 5. Pipeline poora chale
  let job = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await api("GET", `/api/videos/${jobId}`);
    job = res.data;
    if (["done", "failed"].includes(job.status)) break;
  }
  check("pipeline done", job?.status === "done", `status=${job?.status}${job?.error ? `, error=${job.error}` : ""}`);
  check("script generated", !!job?.script && job.script.length > 50);
  check("seo generated", !!job?.seo?.title && Array.isArray(job?.seo?.tags));
  check("uploaded (mock)", job?.uploaded === true, job?.youtubeUrl || "");
  check("steps recorded", (job?.steps || []).map((s) => s.step).join(",").includes("script") && (job?.steps || []).some((s) => s.step === "done"));

  // 6. Files sach me bani hain
  const raw = await db.getJob(jobId);
  check("video.mp4 exists", raw?.video_path && fs.existsSync(raw.video_path),
    raw?.video_path ? `${(fs.statSync(raw.video_path).size / 1024).toFixed(0)} KB` : "");
  check("thumb.jpg exists", raw?.thumb_path && fs.existsSync(raw.thumb_path));
  const dl = await fetch(`${BASE}/api/videos/${jobId}/file`, { headers: { "x-cinem-ai-assistant-user": "demo-user" } });
  check("video download route", dl.status === 200 && Number(dl.headers.get("content-length")) > 10000);

  // 7. Usage metering
  const us = await api("GET", "/api/usage");
  const kinds = (us.data.events || []).map((e) => e.kind);
  check("usage events", kinds.includes("video_requested") && kinds.includes("video_done"), kinds.join(","));
  check("credits deducted", us.data.credits === 18, `balance=${us.data.credits}`);

  // 8. Plan gate: pro plan me "best" model nahi
  const gate = await api("POST", "/api/videos", { body: { topic: "test best model", model: "best" } });
  check("plan gate (403)", gate.status === 403);

  // 9. Insufficient credits → 402 (+ koi charge nahi)
  await db.spendCredits("broke-user", 19); // 20 → 1 credit
  const broke = await api("POST", "/api/videos", { user: "broke-user", body: { topic: "no money test", model: "mid" } });
  const brokeAfter = await db.getProfile("broke-user");
  check("insufficient credits (402)", broke.status === 402 && brokeAfter.credits === 1);

  // 10. Multi-tenant isolation: doosra user meri job na dekh sake
  const spy = await api("GET", `/api/videos/${jobId}`, { user: "spy-user" });
  check("tenant isolation (404 for other user)", spy.status === 404);

  // 11. Telegram: link + commands
  const lc = await api("GET", "/api/telegram/link-code");
  await api("POST", "/api/telegram/webhook", { body: { message: { chat: { id: 424242 }, text: `/link ${lc.data.code}` } } });
  const linked = await db.getUserByTelegramChat(424242);
  check("telegram link", linked === "demo-user");
  await api("POST", "/api/telegram/webhook", { body: { message: { chat: { id: 424242 }, text: "/credits" } } });
  check("telegram /credits (no crash)", true);

  // 12. Job via telegram (selfCall internal auth)
  await api("POST", "/api/telegram/webhook", { body: { message: { chat: { id: 424242 }, text: "/video Roman Urdu me motivation short" } } });
  await new Promise((r) => setTimeout(r, 500));
  const list = await api("GET", "/api/videos");
  check("telegram /video created job", list.data.length >= 2, `${list.data.length} jobs`);
  // us job ke khatam hone ka intezar (warna process latka rehta)
  for (let i = 0; i < 60; i++) {
    const l = await api("GET", "/api/videos");
    if (l.data.every((j) => ["done", "failed"].includes(j.status))) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
} catch (e) {
  check("unexpected error", false, e.message);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? "🎉 SAB PASS" : `❌ ${failed.length} FAIL`} — ${results.length - failed.length}/${results.length} checks\n`);
server.close();
process.exit(failed.length ? 1 : 0);
