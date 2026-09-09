#!/usr/bin/env node
/**
 * CINEM Pro native messaging host + optional local HTTP agent.
 *
 * Chrome talks over stdin/stdout (length-prefixed JSON).
 * `node native-host/host.mjs --http` also listens on 127.0.0.1:43181
 * for Electron / long jobs / scheduling hooks.
 *
 * File writes never run unless the desk already paused for approval
 * (the cloud runner gates native_file_write). This host still refuses
 * path traversal outside the user home + workspace folders.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

const HTTP_PORT = Number(process.env.CINEM_NATIVE_PORT || 43181);
const HOME = os.homedir();
const CONFIG_DIR = path.join(HOME, ".cinem-pro");
const CONFIG_FILE = path.join(CONFIG_DIR, "device.json");

function sendNative(message) {
  const json = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(header);
  process.stdout.write(json);
}

function safePath(raw) {
  const resolved = path.resolve(String(raw || ""));
  const allowedRoots = [HOME, path.join(HOME, ".cinem-pro"), process.cwd()];
  if (!allowedRoots.some((root) => resolved === root || resolved.startsWith(root + path.sep))) {
    throw new Error("Refused: path is outside home / .cinem-pro / project.");
  }
  return resolved;
}

function handleCall(tool, args = {}) {
  if (tool === "native_file_read") {
    const file = safePath(args.path);
    const text = fs.readFileSync(file, "utf8").slice(0, 12_000);
    return { ok: true, fileText: text, excerpt: text.slice(0, 280), engine: "native" };
  }
  if (tool === "native_file_write") {
    const file = safePath(args.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(args.text ?? args.content ?? ""), "utf8");
    return { ok: true, excerpt: `Wrote ${file}`, engine: "native" };
  }
  if (tool === "native_long_job") {
    return {
      ok: true,
      excerpt: "Scheduling hook acknowledged. Cron still lives in the cloud desk.",
      engine: "native",
    };
  }
  if (tool === "ping") {
    return { ok: true, excerpt: "native host", engine: "native" };
  }
  return { ok: false, error: `Unknown native tool ${tool}`, engine: "native" };
}

function readDeviceConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function pollCloud() {
  const cfg = readDeviceConfig();
  if (!cfg?.token || !cfg?.origin) return;
  try {
    await fetch(`${cfg.origin}/api/device/heartbeat`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.token}`,
        "x-cinem-native-host": "1",
      },
    });
    // Browser/CDP commands are claimed by the MV3 extension poller.
    // This process only heartbeats and serves native_file_* over stdio / HTTP /call
    // so the two pollers cannot mark the same command running twice.
    const res = await fetch(`${cfg.origin}/api/device/commands?native=1`, {
      headers: { authorization: `Bearer ${cfg.token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    for (const command of data.commands || []) {
      if (!String(command.tool || "").startsWith("native_")) continue;
      const result = handleCall(command.tool, command.args || {});
      await fetch(`${cfg.origin}/api/device/commands/${command.id}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${cfg.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(result),
      });
    }
  } catch {
    // desk offline
  }
}

function startStdio() {
  const stdin = process.stdin;
  stdin.on("readable", () => {
    const header = stdin.read(4);
    if (!header) return;
    const len = header.readUInt32LE(0);
    let body = Buffer.alloc(0);
    while (body.length < len) {
      const chunk = stdin.read(len - body.length);
      if (!chunk) break;
      body = Buffer.concat([body, chunk]);
    }
    try {
      const msg = JSON.parse(body.toString("utf8"));
      if (msg?.type === "hello") {
        sendNative({ type: "hello", ok: true });
        return;
      }
      if (msg?.type === "call") {
        const result = handleCall(msg.tool, msg.args);
        sendNative({ type: "result", replyTo: msg.id, result });
      }
      if (msg?.type === "config" && msg.origin && msg.token) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(msg, null, 2));
      }
    } catch (error) {
      sendNative({ type: "error", error: error instanceof Error ? error.message : String(error) });
    }
  });
}

function startHttp() {
  const server = http.createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/health") {
      res.end(JSON.stringify({ ok: true, product: "CINEM Pro local agent" }));
      return;
    }
    if (req.method === "POST" && req.url === "/call") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        res.end(JSON.stringify(handleCall(body.tool, body.args)));
      } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found." }));
  });
  server.listen(HTTP_PORT, "127.0.0.1");
}

const httpMode = process.argv.includes("--http");
if (httpMode) startHttp();
if (!process.stdout.isTTY || !httpMode) startStdio();
if (httpMode) {
  setInterval(() => void pollCloud(), 3000);
  void pollCloud();
}

if (httpMode) {
  process.stderr.write(`CINEM Pro local agent http://127.0.0.1:${HTTP_PORT}/health\n`);
}

// Keep the process open for native messaging even if no HTTP.
if (!httpMode) {
  createInterface({ input: process.stdin });
}
