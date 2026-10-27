/**
 * Cinem AI Assistant — Local Database Server (the single source of truth).
 *
 * Fixes the signup-sync bug for good: previously the Tauri app saved users
 * via tauri-plugin-store (app-data file) while the Admin Panel in a browser
 * tab used localStorage — TWO different storages, so signups never appeared
 * in the panel. Now BOTH processes talk to this one tiny server, which owns
 * a single JSON file on disk.
 *
 * Architecture (100% local, no internet):
 *   ┌────────────────────┐   HTTP :1430   ┌──────────────────────┐
 *   │ Cinem AI Assistant Desktop App │ ─────────────► │  db-server (this)    │
 *   │  (Tauri, :1420 dev)│                │  ~/.cinem-ai-assistant/          │
 *   └────────────────────┘                │  cinem-ai-assistant-localdb.json │
 *   ┌────────────────────┐                └──────────────────────┘
 *   │ Admin Panel        │ ─────────────►        ▲ same file
 *   │ http://localhost:1430/admin (served here)  │
 *   └────────────────────┘────────────────────────┘
 *
 * Endpoints:
 *   GET  /health   → { ok: true }
 *   GET  /api/db   → entire DB (users, activity, admin creds, …)
 *   PUT  /api/db   → replace DB (atomic write: tmp + rename)
 *   GET  /*        → serves the built Cinem AI Assistant frontend (dist/), with SPA
 *                    fallback — so http://localhost:1430/admin opens the
 *                    full Admin Panel in any browser.
 *
 * Run manually in dev:  node db-server/index.js   (or `npm run db`)
 * In installed builds the Tauri backend auto-spawns it from resources.
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 1430;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ── Storage (atomic JSON file) ───────────────────────────────────── */

const DATA_DIR = path.join(os.homedir(), ".cinem-ai-assistant");
const DB_FILE = path.join(DATA_DIR, "cinem-ai-assistant-localdb.json");

const DEFAULT_DB = {
  users: [],
  deviceUserId: null,
  adminUser: "admin",
  adminPass: "cinem-ai-assistant123",
  activity: [],
};

function loadDb() {
  try {
    return { ...DEFAULT_DB, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
  } catch {
    return { ...DEFAULT_DB };
  }
}

function saveDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE); // atomic — readers never see a half-written file
}

/* ── Static frontend (Admin Panel at /admin) ──────────────────────── */

/** dist/ lives next to this folder in the repo, or as a sibling resource
 *  in installed builds. */
const DIST_CANDIDATES = [
  path.join(__dirname, "..", "dist"),
  path.join(__dirname, "dist"),
];
const DIST = DIST_CANDIDATES.find((p) => fs.existsSync(path.join(p, "index.html")));

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".webp": "image/webp",
};

function serveStatic(req, res) {
  if (!DIST) {
    res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("Cinem AI Assistant frontend not built yet — run `npm run build` first.");
    return;
  }
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.normalize(path.join(DIST, urlPath));
  if (!file.startsWith(DIST)) file = path.join(DIST, "index.html"); // traversal guard
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, "index.html"); // SPA fallback → /admin route works
  }
  const isHtml = file.endsWith(".html");
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
    // index.html must never be cached — otherwise the browser keeps serving a
    // STALE build of the Admin Panel (old backend, old features) after a
    // rebuild. Hashed assets are safe to cache.
    "Cache-Control": isHtml ? "no-store, must-revalidate" : "public, max-age=86400",
  });
  fs.createReadStream(file).pipe(res);
}

/** Loud warning when the served Admin Panel build is older than .env —
 *  the #1 cause of "signups don't appear": the panel runs an old build that
 *  points at a different backend than the freshly-configured app. */
function warnIfStaleDist() {
  try {
    if (!DIST) return;
    const distTime = fs.statSync(path.join(DIST, "index.html")).mtimeMs;
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath) && fs.statSync(envPath).mtimeMs > distTime) {
      console.warn("┌──────────────────────────────────────────────────────────────┐");
      console.warn("│ ⚠  STALE BUILD: .env changed AFTER the last `npm run build`. │");
      console.warn("│    The Admin Panel at :1430 may use the WRONG backend.       │");
      console.warn("│    Fix:  npm run build   (then refresh the browser)          │");
      console.warn("└──────────────────────────────────────────────────────────────┘");
    }
  } catch { /* best-effort */ }
}

/* ── HTTP server ──────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*", // local-only server (binds 127.0.0.1)
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
};

function json(res, status, body) {
  res.writeHead(status, { ...CORS, "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data)); } catch { resolve(null); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 200, { ok: true });

  try {
    if (req.url === "/health") return json(res, 200, { ok: true, file: DB_FILE });

    if (req.url === "/api/db") {
      if (req.method === "GET") return json(res, 200, loadDb());
      if (req.method === "PUT") {
        const body = await readBody(req);
        if (!body || !Array.isArray(body.users)) {
          return json(res, 400, { ok: false, error: "invalid db payload" });
        }
        saveDb({ ...DEFAULT_DB, ...body });
        const pending = body.users.filter((u) => u.status === "pending").length;
        console.log(
          `[db-server] DB saved — users: ${body.users.length} (pending: ${pending}) @ ${new Date().toLocaleTimeString()}`,
        );
        return json(res, 200, { ok: true });
      }
    }

    if (req.method === "GET") return serveStatic(req, res);
    return json(res, 404, { ok: false, error: "not found" });
  } catch (e) {
    console.error("[db-server] error:", e);
    return json(res, 500, { ok: false, error: String(e?.message ?? e) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Cinem AI Assistant db-server   →  http://127.0.0.1:${PORT}`);
  console.log(`Admin Panel        →  http://localhost:${PORT}/admin`);
  console.log(`Database file      →  ${DB_FILE}`);
  console.log(DIST ? `Serving frontend  →  ${DIST}` : "(frontend dist/ not found — API only)");
  warnIfStaleDist();
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log(`db-server already running on :${PORT} — exiting (this is fine).`);
    process.exit(0);
  }
  throw e;
});
