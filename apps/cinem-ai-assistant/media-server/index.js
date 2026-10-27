/**
 * Cinem AI Assistant — NOVA media sidecar (ffmpeg video editor).
 *
 * CapCut can't be scripted, so NOVA uses ffmpeg for a fully-automated,
 * preset-based editing pipeline. The desktop app calls this local server.
 *
 *   GET  /health                         → { ok, ffmpeg }
 *   POST /list   { folder }              → newest-first video files
 *   POST /edit   { folder, files?, style, count? } → { jobId }
 *   GET  /job?id=…                       → { state, percent, stage, output }
 *   POST /thumbs { video, count }        → extracted frame paths
 *   POST /capcut { files, capcutPath? }  → best-effort open CapCut
 *
 * Requires ffmpeg on PATH (https://ffmpeg.org). Run:
 *   cd media-server && node index.js
 */
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const PORT = 7880;
const VIDEO_EXT = new Set([".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"]);
const jobs = new Map();

const hasFfmpeg = () => {
  try { return spawnSync("ffmpeg", ["-version"]).status === 0; }
  catch { return false; }
};

/* ── Style presets → ffmpeg video filter + quality ─────────────────── */
const PRESETS = {
  high: {
    label: "High-End Cinematic",
    vf: "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black," +
        "eq=contrast=1.08:brightness=0.02:saturation=1.18,unsharp=5:5:0.6,fade=t=in:st=0:d=0.4",
    crf: "18", preset: "slow",
  },
  medium: {
    label: "Medium (YouTube)",
    vf: "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,eq=saturation=1.07",
    crf: "21", preset: "medium",
  },
  normal: {
    label: "Quick Reel",
    vf: "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black",
    crf: "26", preset: "veryfast",
  },
};

function listVideos(folder) {
  const items = fs.readdirSync(folder)
    .filter((f) => VIDEO_EXT.has(path.extname(f).toLowerCase()))
    .map((f) => {
      const p = path.join(folder, f);
      return { name: f, path: p, mtime: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return items;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-600)))));
    proc.on("error", reject);
  });
}

/* ── Edit job (sequential, preset re-encode → concat) ──────────────── */
async function runEditJob(id, folder, files, styleKey, outDirOverride) {
  const job = jobs.get(id);
  const preset = PRESETS[styleKey] ?? PRESETS.medium;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "cinem-ai-assistant-nova-"));
  const outDir = outDirOverride || path.join(folder, "CINEM-AI-ASSISTANT_Edited");
  fs.mkdirSync(outDir, { recursive: true });

  try {
    job.state = "running";
    job.stage = `Preparing ${files.length} clip(s) — ${preset.label}`;

    const temps = [];
    for (let i = 0; i < files.length; i++) {
      job.stage = `Editing clip ${i + 1}/${files.length} (${preset.label})`;
      job.percent = Math.round(((i) / files.length) * 80);
      const tmp = path.join(work, `clip_${i}.mp4`);
      await runFfmpeg([
        "-i", files[i],
        "-vf", preset.vf,
        "-r", "30", "-pix_fmt", "yuv420p",
        "-c:v", "libx264", "-crf", preset.crf, "-preset", preset.preset,
        "-c:a", "aac", "-ar", "48000", "-b:a", "192k",
        tmp,
      ]);
      temps.push(tmp);
    }

    job.stage = "Stitching final video…";
    job.percent = 88;
    const listFile = path.join(work, "concat.txt");
    fs.writeFileSync(listFile, temps.map((t) => `file '${t.replace(/'/g, "'\\''")}'`).join("\n"));

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const output = path.join(outDir, `CINEM-AI-ASSISTANT_${styleKey}_${stamp}.mp4`);
    await runFfmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", output]);

    job.percent = 100;
    job.state = "done";
    job.stage = "Export complete";
    job.output = output;
  } catch (e) {
    job.state = "error";
    job.error = e instanceof Error ? e.message : String(e);
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

const b64 = (p) => fs.readFileSync(p).toString("base64");

async function extractThumbs(video, count = 6) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cinem-ai-assistant-thumbs-"));
  // Evenly-spaced representative frames across the clip.
  await runFfmpeg([
    "-i", video,
    "-vf", `thumbnail,fps=1/2,scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720`,
    "-frames:v", String(count),
    path.join(dir, "frame_%02d.png"),
  ]);
  return fs.readdirSync(dir).map((f) => {
    const fp = path.join(dir, f);
    return { path: fp, b64: b64(fp) };
  });
}

/** Finds a usable bold TrueType font for drawtext overlays. */
function findFont() {
  const fonts = [
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "C:\\Windows\\Fonts\\ARIALBD.TTF",
    "C:\\Windows\\Fonts\\segoeuib.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  ];
  return fonts.find((f) => fs.existsSync(f)) || null;
}

/** Per-style color treatment + text placement for thumbnails. */
const THUMB_STYLE = {
  cinematic:    { vf: "eq=contrast=1.22:saturation=0.9:brightness=-0.02,vignette=PI/4", color: "white",  size: 74, border: "black@0.85", bw: 3 },
  clickbait:    { vf: "eq=contrast=1.28:saturation=1.55:brightness=0.04",               color: "#FFE600", size: 96, border: "black",      bw: 7 },
  minimal:      { vf: "eq=contrast=1.06:saturation=0.55",                               color: "white",  size: 64, border: "black@0.4",  bw: 1 },
  viral:        { vf: "eq=contrast=1.2:saturation=1.65:brightness=0.05",                color: "white",  size: 90, border: "#FF2D7E",    bw: 6 },
  professional: { vf: "eq=contrast=1.05:saturation=1.02",                               color: "white",  size: 60, border: "black@0.6",  bw: 2 },
  dark:         { vf: "eq=brightness=-0.07:contrast=1.18:saturation=0.85,colorbalance=bs=0.18", color: "#59F0EA", size: 78, border: "black", bw: 4 },
};

/** Composites one styled thumbnail (frame + color grade + bold text). */
async function composeThumbnail(frame, text, styleKey) {
  const st = THUMB_STYLE[styleKey] ?? THUMB_STYLE.professional;
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cinem-ai-assistant-thumb-")), `${styleKey}.png`);
  const safe = String(text || "").replace(/[:%'\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 32);

  let draw = "";
  const font = findFont();
  if (safe && font) {
    const fontEsc = font.replace(/\\/g, "/").replace(/:/g, "\\:");
    draw = `,drawtext=fontfile='${fontEsc}':text='${safe}':fontcolor=${st.color}:fontsize=${st.size}` +
           `:borderw=${st.bw}:bordercolor=${st.border}:x=(w-text_w)/2:y=h-th-56`;
  }

  await runFfmpeg([
    "-i", frame,
    "-vf", `scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,${st.vf}${draw}`,
    "-frames:v", "1", out,
  ]);
  return { path: out, b64: b64(out) };
}

/* ── HTTP ──────────────────────────────────────────────────────────── */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};
const send = (res, status, body) => { res.writeHead(status, CORS); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve) => {
  let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
});

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, { ok: true });
  const url = new URL(req.url, "http://x");

  try {
    if (url.pathname === "/health") return send(res, 200, { ok: true, ffmpeg: hasFfmpeg() });

    if (url.pathname === "/job") {
      const j = jobs.get(url.searchParams.get("id"));
      return j ? send(res, 200, { ok: true, ...j }) : send(res, 404, { ok: false, error: "no such job" });
    }

    const body = await readBody(req);

    if (url.pathname === "/list") {
      if (!body.folder || !fs.existsSync(body.folder)) return send(res, 400, { ok: false, error: "folder not found" });
      return send(res, 200, { ok: true, videos: listVideos(body.folder) });
    }

    if (url.pathname === "/edit") {
      if (!hasFfmpeg()) return send(res, 500, { ok: false, error: "ffmpeg not installed (add it to PATH)" });
      if (!body.folder || !fs.existsSync(body.folder)) return send(res, 400, { ok: false, error: "folder not found" });
      let files = Array.isArray(body.files) && body.files.length
        ? body.files
        : listVideos(body.folder).slice(0, body.count || 10).map((v) => v.path);
      // chronological for the final cut
      files = files.slice().reverse();
      if (!files.length) return send(res, 400, { ok: false, error: "no videos found in folder" });

      const id = Math.random().toString(36).slice(2, 10);
      jobs.set(id, { state: "queued", percent: 0, stage: "Queued", output: "", error: "", count: files.length, style: body.style });
      void runEditJob(id, body.folder, files, body.style || "medium");
      return send(res, 200, { ok: true, jobId: id, count: files.length });
    }

    if (url.pathname === "/assemble") {
      // Stitch scene clips in NAME order (scene_01, scene_02, …) → final video.
      if (!hasFfmpeg()) return send(res, 500, { ok: false, error: "ffmpeg not installed" });
      if (!body.folder || !fs.existsSync(body.folder)) return send(res, 400, { ok: false, error: "scenes folder not found" });
      const files = listVideos(body.folder).map((v) => v.path).sort(); // ascending by name
      if (!files.length) return send(res, 400, { ok: false, error: "no scene clips in folder" });

      const id = Math.random().toString(36).slice(2, 10);
      jobs.set(id, { state: "queued", percent: 0, stage: "Queued", output: "", error: "", count: files.length, style: body.style });
      const outDir = body.outDir || path.join(body.folder, "CINEM-AI-ASSISTANT_Edited");
      void runEditJob(id, body.folder, files, body.style || "medium", outDir);
      return send(res, 200, { ok: true, jobId: id, count: files.length });
    }

    if (url.pathname === "/thumbs") {
      if (!hasFfmpeg()) return send(res, 500, { ok: false, error: "ffmpeg not installed" });
      if (!body.video || !fs.existsSync(body.video)) return send(res, 400, { ok: false, error: "video not found" });
      const frames = await extractThumbs(body.video, body.count || 6);
      return send(res, 200, { ok: true, frames }); // [{path, b64}]
    }

    if (url.pathname === "/thumbnail") {
      if (!hasFfmpeg()) return send(res, 500, { ok: false, error: "ffmpeg not installed" });
      if (!body.frame || !fs.existsSync(body.frame)) return send(res, 400, { ok: false, error: "frame not found" });
      const t = await composeThumbnail(body.frame, body.text || "", body.style || "professional");
      return send(res, 200, { ok: true, ...t });
    }

    if (url.pathname === "/capcut") {
      // Best-effort: launch CapCut (it can't import via CLI args reliably),
      // then open the export folder so the user can drag clips in.
      const exe = body.capcutPath;
      if (exe && fs.existsSync(exe)) spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
      if (body.folder) spawn("explorer", [body.folder], { detached: true, stdio: "ignore" }).unref();
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { ok: false, error: "not found" });
  } catch (e) {
    console.error("[media-server]", e);
    return send(res, 500, { ok: false, error: String(e?.message ?? e) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Cinem AI Assistant NOVA media sidecar on http://127.0.0.1:${PORT}`);
  console.log(hasFfmpeg() ? "ffmpeg: OK" : "ffmpeg: NOT FOUND — install it and add to PATH");
});
