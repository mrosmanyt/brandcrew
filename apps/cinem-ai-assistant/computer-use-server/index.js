/**
 * Cinem AI Assistant — Windows desktop control sidecar (allowlist-first).
 *
 *   GET  /health           → { ok: true }
 *   POST /focus   { app }  → focus or launch allowlisted app
 *   POST /open-url { url } → open URL in default browser
 *   POST /powershell { script, confirmed } → run PS only when confirmed=true
 *
 * Port 7879 — separate from playwright-server (7878).
 */
import http from "node:http";
import { spawn } from "node:child_process";
import os from "node:os";

const PORT = 7879;
const IS_WIN = process.platform === "win32";

const ALLOWLIST = {
  explorer: { processes: ["explorer"], launch: "explorer.exe" },
  chrome: { processes: ["chrome"], launch: "chrome.exe" },
  edge: { processes: ["msedge"], launch: "msedge.exe" },
  firefox: { processes: ["firefox"], launch: "firefox.exe" },
  chatgpt: { processes: ["chatgpt"], launch: "chatgpt.exe" },
  premiere: { processes: ["adobepremierepro", "adobe premiere pro"], launch: "Adobe Premiere Pro.exe" },
  notepad: { processes: ["notepad"], launch: "notepad.exe" },
  whatsapp: { processes: ["whatsapp", "applicationframehost"], launch: "whatsapp:" },
};

const SNAP_PROCESS_HINTS = {
  whatsapp: ["whatsapp"],
  chrome: ["chrome"],
  edge: ["msedge"],
  firefox: ["firefox"],
  explorer: ["explorer"],
  notepad: ["notepad"],
  chatgpt: ["chatgpt"],
  premiere: ["adobepremierepro", "adobe premiere pro"],
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function runPowerShell(script) {
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (code) => {
      resolve({ code, out: out.trim(), err: err.trim() });
    });
  });
}

/** Focus existing window or start allowlisted app (Windows). */
async function focusApp(appId) {
  const entry = ALLOWLIST[appId];
  if (!entry) return { ok: false, error: `App not allowlisted: ${appId}` };
  if (!IS_WIN) {
    return { ok: false, error: "Desktop focus is Windows-only in this MVP" };
  }
  const procs = entry.processes.map((p) => `'${p.replace(/'/g, "''")}'`).join(",");
  const script = `
$names = @(${procs})
$found = Get-Process -ErrorAction SilentlyContinue | Where-Object { $n = $_.ProcessName.ToLower(); $names | Where-Object { $n -like "*$_*" } }
if ($found) {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
  $hwnd = $found[0].MainWindowHandle
  if ($hwnd -ne [IntPtr]::Zero) {
    [Win32]::ShowWindow($hwnd, 9)
    [Win32]::SetForegroundWindow($hwnd) | Out-Null
    "focused:$($found[0].ProcessName)"
  } else { "no-window:$($found[0].ProcessName)" }
} else {
  Start-Process "${entry.launch.replace(/"/g, '`"')}"
  "launched:${entry.launch}"
}
`.trim();
  const result = await runPowerShell(script);
  if (result.code !== 0 && !result.out) {
    return { ok: false, error: result.err || `exit ${result.code}` };
  }
  return { ok: true, detail: result.out || result.err || "ok" };
}

function snapRect(slot, screen) {
  const { x, y, width, height } = screen;
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  switch (slot) {
    case "left":
      return { x, y, w: halfW, h: height };
    case "right":
      return { x: x + halfW, y, w: width - halfW, h: height };
    case "top":
      return { x, y, w: width, h: halfH };
    case "bottom":
      return { x, y: y + halfH, w: width, h: height - halfH };
    case "maximize":
    default:
      return { x, y, w: width, h: height };
  }
}

/** Snap allowlisted app windows to screen regions (Windows). */
async function snapLayout(assignments) {
  if (!IS_WIN) return { ok: false, error: "snap-layout is Windows-only" };
  const list = Array.isArray(assignments) ? assignments : [];
  if (!list.length) return { ok: false, error: "empty assignments" };
  const details = [];
  for (const item of list) {
    const appId = String(item.app || "").toLowerCase();
    const slot = String(item.slot || "left").toLowerCase();
    const hints = SNAP_PROCESS_HINTS[appId] || ALLOWLIST[appId]?.processes || [appId];
    if (!hints.length) {
      details.push(`skip:${appId}`);
      continue;
    }
    const procs = hints.map((p) => `'${p.replace(/'/g, "''")}'`).join(",");
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Snap {
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$rect = @{ left = @{x=$screen.X;y=$screen.Y;w=[math]::Floor($screen.Width/2);h=$screen.Height}; right = @{x=$screen.X+[math]::Floor($screen.Width/2);y=$screen.Y;w=$screen.Width-[math]::Floor($screen.Width/2);h=$screen.Height}; top = @{x=$screen.X;y=$screen.Y;w=$screen.Width;h=[math]::Floor($screen.Height/2)}; bottom = @{x=$screen.X;y=$screen.Y+[math]::Floor($screen.Height/2);w=$screen.Width;h=$screen.Height-[math]::Floor($screen.Height/2)}; maximize = @{x=$screen.X;y=$screen.Y;w=$screen.Width;h=$screen.Height} }
$slotKey = "${slot}"
if (-not $rect.ContainsKey($slotKey)) { $slotKey = "left" }
$r = $rect[$slotKey]
$names = @(${procs})
$found = Get-Process -ErrorAction SilentlyContinue | Where-Object { $n = $_.ProcessName.ToLower(); $names | Where-Object { $n -like "*$_*" } } | Select-Object -First 1
if (-not $found) {
  $launch = "${ALLOWLIST[appId]?.launch || ""}"
  if ($launch) { Start-Process $launch }
  "launched:${appId}"
} else {
  $hwnd = $found.MainWindowHandle
  if ($hwnd -ne [IntPtr]::Zero) {
    [Win32Snap]::ShowWindow($hwnd, 9)
    [Win32Snap]::MoveWindow($hwnd, $r.x, $r.y, $r.w, $r.h, $true) | Out-Null
    [Win32Snap]::SetForegroundWindow($hwnd) | Out-Null
    "snapped:$($found.ProcessName):$slotKey"
  } else { "no-window:$($found.ProcessName)" }
}
`.trim();
    const result = await runPowerShell(script);
    details.push(result.out || result.err || appId);
  }
  return { ok: true, detail: details.join("; ") };
}

async function openUrl(url) {
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: "Only http(s) URLs allowed" };
  if (!IS_WIN) {
    return { ok: false, error: "open-url is Windows-only in this MVP" };
  }
  const result = await runPowerShell(`Start-Process "${url.replace(/"/g, '`"')}"`);
  return result.code === 0 || result.out
    ? { ok: true, detail: "opened in default browser" }
    : { ok: false, error: result.err || "failed" };
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  res.setHeader("content-type", "application/json");
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, platform: os.platform() }));
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end(JSON.stringify({ error: "method not allowed" }));
    return;
  }
  let body;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "invalid json" }));
    return;
  }
  if (url.pathname === "/focus") {
    const r = await focusApp(String(body.app || ""));
    res.writeHead(r.ok ? 200 : 400);
    res.end(JSON.stringify(r));
    return;
  }
  if (url.pathname === "/open-url") {
    const r = await openUrl(String(body.url || ""));
    res.writeHead(r.ok ? 200 : 400);
    res.end(JSON.stringify(r));
    return;
  }
  if (url.pathname === "/snap-layout") {
    const r = await snapLayout(body.assignments);
    res.writeHead(r.ok ? 200 : 400);
    res.end(JSON.stringify(r));
    return;
  }
  if (url.pathname === "/powershell") {
    if (!body.confirmed) {
      res.writeHead(403);
      res.end(JSON.stringify({ ok: false, error: "PowerShell requires confirmed:true from UI" }));
      return;
    }
    const script = String(body.script || "").trim();
    if (!script) {
      res.writeHead(400);
      res.end(JSON.stringify({ ok: false, error: "empty script" }));
      return;
    }
    const result = await runPowerShell(script);
    res.writeHead(result.code === 0 ? 200 : 500);
    res.end(JSON.stringify({
      ok: result.code === 0,
      detail: result.out || result.err,
      code: result.code,
    }));
    return;
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((e) => {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[computer-use-server] listening on http://127.0.0.1:${PORT} (${process.platform})`);
});
