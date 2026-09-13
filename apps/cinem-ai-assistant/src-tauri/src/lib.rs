//! Cinem AI Assistant core — Tauri 2.0 backend.
//! Phase 2: settings persistence (store), HTTP (ElevenLabs/Gemini/Ollama),
//! autostart, and the local voice bridge (Faster-Whisper STT / Piper TTS).

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::process::{Command, Stdio};

/// Builds a Command that never flashes a console window on Windows.
fn cmd(program: &str) -> Command {
    #[allow(unused_mut)]
    let mut c = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        c.creation_flags(CREATE_NO_WINDOW);
    }
    c
}

/// Python launcher — `python` on Windows, `python3` (preferred) on macOS/Linux.
fn python_cmd() -> Command {
    if cfg!(windows) {
        return cmd("python");
    }
    if Command::new("python3").arg("--version").output().is_ok() {
        cmd("python3")
    } else {
        cmd("python")
    }
}

#[derive(Serialize)]
struct CoreStatus {
    name: &'static str,
    version: &'static str,
    online: bool,
    agents_registered: u8,
}

/// Simple liveness probe used by the frontend on boot.
#[tauri::command]
fn ping() -> &'static str {
    "Cinem AI Assistant core online"
}

/// Returns core status shown in the UI top bar / hub.
#[tauri::command]
fn core_status() -> CoreStatus {
    CoreStatus {
        name: "Cinem AI Assistant",
        version: env!("CARGO_PKG_VERSION"),
        online: true,
        agents_registered: 15,
    }
}

/// Locates `scripts/whisper_stt.py` whether we run from `src-tauri` (dev)
/// or from the project root.
fn whisper_script() -> Option<std::path::PathBuf> {
    ["../scripts/whisper_stt.py", "scripts/whisper_stt.py"]
        .iter()
        .map(std::path::PathBuf::from)
        .find(|p| p.exists())
}

/// STT — writes the recorded audio to a temp file and transcribes it with
/// Faster-Whisper (Python). Returns the recognized text.
#[tauri::command]
async fn transcribe_audio(audio_b64: String, model: String) -> Result<String, String> {
    let bytes = B64
        .decode(audio_b64)
        .map_err(|e| format!("audio decode failed: {e}"))?;

    let path = std::env::temp_dir().join("cinem-ai-assistant_voice_input.webm");
    std::fs::write(&path, bytes).map_err(|e| format!("temp write failed: {e}"))?;

    let script = whisper_script()
        .ok_or("whisper_stt.py not found — expected in the app's scripts folder")?;

    let out = python_cmd()
        .arg(&script)
        .arg(&path)
        .args(["--model", &model])
        .output()
        .map_err(|e| format!("could not launch python: {e}. Install Python + `pip install faster-whisper`."))?;

    if !out.status.success() {
        return Err(format!(
            "whisper failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }

    // The script prints {"text": "..."} as its last stdout line.
    let stdout = String::from_utf8_lossy(&out.stdout);
    let line = stdout.lines().last().unwrap_or_default();
    let parsed: serde_json::Value =
        serde_json::from_str(line).map_err(|e| format!("bad STT output: {e}"))?;
    Ok(parsed["text"].as_str().unwrap_or_default().to_string())
}

/// TTS fallback — pipes text into the local Piper CLI and returns the
/// generated WAV as base64 for playback in the frontend.
#[tauri::command]
async fn piper_speak(text: String, voice_model: String) -> Result<String, String> {
    let out_path = std::env::temp_dir().join("cinem-ai-assistant_tts.wav");

    let mut child = cmd("piper")
        .args(["--model", &voice_model])
        .args(["--output_file", out_path.to_str().unwrap()])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("piper not found: {e}. Install Piper or switch TTS to ElevenLabs."))?;

    child
        .stdin
        .take()
        .ok_or("piper stdin unavailable")?
        .write_all(text.as_bytes())
        .map_err(|e| e.to_string())?;

    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("piper synthesis failed".into());
    }

    let wav = std::fs::read(&out_path).map_err(|e| e.to_string())?;
    Ok(B64.encode(wav))
}

/* ── App Integrity Guard (anti-theft) ───────────────────────────────
   The frontend bundle refuses to run outside the genuine Cinem AI Assistant shell:
   JS sends a random nonce → `guard_sign` returns a keyed digest that is
   computed ONLY here (secret + algorithm live in this compiled binary,
   never in JS) → JS hands both back to `guard_verify`, which re-computes
   and confirms. Stolen web assets dropped into a browser or a foreign
   shell have no such commands — the UI locks itself immediately. */

const GUARD_SECRET: &[u8] = b"CINEM-AI-ASSISTANT-CORE-GUARD-7f3e9a1c-58d2-4b6e-b1aa-93c4e8f0d521";

/// Keyed multi-round FNV-1a digest (std-only; secret stays in the binary).
fn guard_digest(nonce: &str) -> String {
    let mut out = String::with_capacity(64);
    for round in 0u8..4 {
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for b in GUARD_SECRET
            .iter()
            .copied()
            .chain(nonce.bytes())
            .chain(std::iter::once(round))
            .chain(GUARD_SECRET.iter().rev().copied())
        {
            h ^= u64::from(b);
            h = h.wrapping_mul(0x0000_0100_0000_01b3);
        }
        out.push_str(&format!("{h:016x}"));
    }
    out
}

/// Integrity handshake step 1 — sign the frontend's nonce.
#[tauri::command]
fn guard_sign(nonce: String) -> String {
    guard_digest(&nonce)
}

/// Integrity handshake step 2 — confirm the signature came from THIS core.
#[tauri::command]
fn guard_verify(nonce: String, sig: String) -> bool {
    guard_digest(&nonce) == sig
}

/// Stable per-device hardware id used for license binding.
/// Windows: the registry MachineGuid · macOS: IOPlatformUUID.
/// Fallback: hostname + OS, hashed.
#[tauri::command]
fn hardware_id() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = cmd("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Some(line) = text.lines().find(|l| l.contains("IOPlatformUUID")) {
                // line shape: "IOPlatformUUID" = "XXXXXXXX-XXXX-…"
                if let Some(uuid) = line.split('"').nth(3) {
                    return format!("HWID-{uuid}");
                }
            }
        }
    }

    #[cfg(windows)]
    {
        if let Ok(out) = cmd("reg")
            .args([
                "query",
                r"HKLM\SOFTWARE\Microsoft\Cryptography",
                "/v",
                "MachineGuid",
            ])
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Some(line) = text.lines().find(|l| l.contains("MachineGuid")) {
                if let Some(guid) = line.split_whitespace().last() {
                    return format!("HWID-{guid}");
                }
            }
        }
    }

    // Fallback: derive a stable id from host info (FNV-1a hash).
    use sysinfo::System;
    let seed = format!(
        "{}|{}|{}",
        System::host_name().unwrap_or_default(),
        System::name().unwrap_or_default(),
        std::env::var("USERNAME").or_else(|_| std::env::var("USER")).unwrap_or_default(),
    );
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in seed.bytes() {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("HWID-{hash:016x}")
}

/* ── MAX · Local Agent — safe file operations ──────────────────────
   Safety contract: user files are MOVED, never deleted (only %TEMP% is
   cleaned). Every move returns a reversed op list for one-click undo. */

#[derive(Serialize)]
struct FsFile {
    name: String,
    ext: String,
    size_mb: f64,
    modified_ms: u64,
    path: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct MoveOp {
    from: String,
    to: String,
}

#[derive(Serialize)]
struct MoveResult {
    moved: u32,
    errors: Vec<String>,
    /// Reversed ops — feed back into fs_undo to restore everything.
    undo: Vec<MoveOp>,
}

fn home_dir() -> Result<std::path::PathBuf, String> {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(std::path::PathBuf::from)
        .map_err(|_| "could not resolve the user profile directory".to_string())
}

fn downloads_dir() -> Result<std::path::PathBuf, String> {
    Ok(home_dir()?.join("Downloads"))
}

fn file_entry(p: &std::path::Path) -> Option<FsFile> {
    let meta = std::fs::metadata(p).ok()?;
    if !meta.is_file() {
        return None;
    }
    let name = p.file_name()?.to_string_lossy().into_owned();
    if name.starts_with('.') {
        return None;
    }
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Some(FsFile {
        ext: p
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default(),
        name,
        size_mb: (meta.len() as f64 / 1_048_576.0 * 100.0).round() / 100.0,
        modified_ms,
        path: p.to_string_lossy().into_owned(),
    })
}

/// Top-level files in the user's Downloads folder.
#[tauri::command]
fn fs_scan_downloads() -> Result<Vec<FsFile>, String> {
    let dir = downloads_dir()?;
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| format!("{}: {e}", dir.display()))? {
        if let Ok(entry) = entry {
            if let Some(f) = file_entry(&entry.path()) {
                out.push(f);
            }
        }
    }
    out.sort_by(|a, b| b.size_mb.partial_cmp(&a.size_mb).unwrap_or(std::cmp::Ordering::Equal));
    Ok(out)
}

/// If `to` exists, appends " (1)", " (2)"… before the extension.
fn collision_free(to: &std::path::Path) -> std::path::PathBuf {
    if !to.exists() {
        return to.to_path_buf();
    }
    let stem = to.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let ext = to.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let parent = to.parent().map(std::path::Path::to_path_buf).unwrap_or_default();
    for i in 1..1000 {
        let candidate = parent.join(format!("{stem} ({i}){ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    to.to_path_buf()
}

fn do_moves(ops: Vec<MoveOp>) -> MoveResult {
    let mut moved = 0u32;
    let mut errors = Vec::new();
    let mut undo = Vec::new();
    for op in ops {
        let from = std::path::PathBuf::from(&op.from);
        let to = collision_free(std::path::Path::new(&op.to));
        if let Some(parent) = to.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        match std::fs::rename(&from, &to) {
            Ok(()) => {
                moved += 1;
                undo.push(MoveOp {
                    from: to.to_string_lossy().into_owned(),
                    to: op.from.clone(),
                });
            }
            Err(e) => errors.push(format!("{}: {e}", from.display())),
        }
    }
    MoveResult { moved, errors, undo }
}

/// Executes a move plan (organize). MOVE-only — nothing is ever deleted.
#[tauri::command]
fn fs_organize(ops: Vec<MoveOp>) -> MoveResult {
    do_moves(ops)
}

/// Reverses a previous organize using its undo log.
#[tauri::command]
fn fs_undo(ops: Vec<MoveOp>) -> MoveResult {
    do_moves(ops)
}

fn walk_find(
    dir: &std::path::Path,
    depth: u8,
    name_contains: &str,
    ext: &str,
    min_mb: f64,
    out: &mut Vec<FsFile>,
) {
    if depth == 0 || out.len() >= 200 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        if out.len() >= 200 {
            return;
        }
        let p = entry.path();
        let fname = entry.file_name().to_string_lossy().to_lowercase();
        if fname.starts_with('.') || fname == "appdata" || fname == "node_modules" || fname == "windows" {
            continue;
        }
        if p.is_dir() {
            walk_find(&p, depth - 1, name_contains, ext, min_mb, out);
        } else if let Some(f) = file_entry(&p) {
            let name_ok = name_contains.is_empty() || f.name.to_lowercase().contains(name_contains);
            let ext_ok = ext.is_empty() || f.ext == ext;
            let size_ok = f.size_mb >= min_mb;
            if name_ok && ext_ok && size_ok {
                out.push(f);
            }
        }
    }
}

/// Recursive search (depth 4, max 200 hits). root: "" = Downloads, "home" =
/// the user profile, otherwise an explicit path.
#[tauri::command]
fn fs_find(root: String, name_contains: String, ext: String, min_mb: f64) -> Result<Vec<FsFile>, String> {
    let base = match root.as_str() {
        "" => downloads_dir()?,
        "home" => home_dir()?,
        p => std::path::PathBuf::from(p),
    };
    let mut out = Vec::new();
    walk_find(
        &base,
        4,
        &name_contains.to_lowercase(),
        &ext.to_lowercase().trim_start_matches('.').to_string(),
        min_mb,
        &mut out,
    );
    out.sort_by(|a, b| b.size_mb.partial_cmp(&a.size_mb).unwrap_or(std::cmp::Ordering::Equal));
    Ok(out)
}

#[derive(Serialize)]
struct TempReport {
    files: u64,
    size_mb: f64,
    freed_mb: f64,
}

fn temp_size(dir: &std::path::Path, files: &mut u64, bytes: &mut u64, depth: u8) {
    if depth == 0 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            temp_size(&p, files, bytes, depth - 1);
        } else if let Ok(m) = std::fs::metadata(&p) {
            *files += 1;
            *bytes += m.len();
        }
    }
}

/// %TEMP% report; `execute = true` also clears it (best-effort — files held
/// by running apps are skipped). This is the ONLY place MAX deletes anything.
#[tauri::command]
fn fs_cleanup_temp(execute: bool) -> TempReport {
    let dir = std::env::temp_dir();
    let (mut files, mut bytes) = (0u64, 0u64);
    temp_size(&dir, &mut files, &mut bytes, 6);
    let size_mb = (bytes as f64 / 1_048_576.0 * 10.0).round() / 10.0;

    let mut freed = 0u64;
    if execute {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                let before = if p.is_dir() {
                    let (mut f, mut b) = (0u64, 0u64);
                    temp_size(&p, &mut f, &mut b, 6);
                    b
                } else {
                    std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0)
                };
                let ok = if p.is_dir() {
                    std::fs::remove_dir_all(&p).is_ok()
                } else {
                    std::fs::remove_file(&p).is_ok()
                };
                if ok {
                    freed += before;
                }
            }
        }
    }
    TempReport {
        files,
        size_mb,
        freed_mb: (freed as f64 / 1_048_576.0 * 10.0).round() / 10.0,
    }
}

/* ── OAuth loopback listener (Gmail / Google sign-in) ─────────────── */

/// Minimal percent-decoder (auth codes contain %2F etc.).
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Binds 127.0.0.1:`port`, waits for ONE browser redirect from Google's
/// OAuth consent screen and returns the `code` query parameter. The browser
/// gets a styled "you can close this window" page. Desktop OAuth clients
/// allow loopback redirects without pre-registering the port.
#[tauri::command]
async fn oauth_listen(port: u16) -> Result<String, String> {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let listener =
            TcpListener::bind(("127.0.0.1", port)).map_err(|e| format!("port {port}: {e}"))?;
        for stream in listener.incoming() {
            let mut stream = stream.map_err(|e| e.to_string())?;
            let mut buf = [0u8; 8192];
            let n = stream.read(&mut buf).unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]).to_string();
            let first_line = req.lines().next().unwrap_or("").to_string();

            let body = "<html><body style=\"background:#04090c;color:#59f0ea;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh\"><div style=\"text-align:center\"><h2 style=\"letter-spacing:.3em\">Cinem AI Assistant CONNECTED</h2><p style=\"color:#2ea8a3\">You can close this window and return to Cinem AI Assistant.</p></div></body></html>";
            let resp = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = stream.write_all(resp.as_bytes());

            // "GET /?code=...&scope=... HTTP/1.1"
            if let Some(path) = first_line.split_whitespace().nth(1) {
                if let Some(code) = path
                    .split(&['?', '&'][..])
                    .find_map(|p| p.strip_prefix("code="))
                {
                    return Ok(percent_decode(code));
                }
                if path.contains("error=") {
                    return Err("authorization was denied".into());
                }
                // favicon or stray request — keep listening
            }
        }
        Err("listener closed unexpectedly".into())
    })
    .await
    .map_err(|e| e.to_string())?
}

/* ── Security Agent tools (defensive system monitoring) ──────────── */

#[derive(Serialize)]
struct ProcInfo {
    name: String,
    pid: u32,
    mem_mb: u64,
    cpu: f32,
}

/// Snapshot of the local system: host info, memory pressure, top processes.
#[tauri::command]
async fn security_scan() -> Result<serde_json::Value, String> {
    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_all();

    let mut procs: Vec<ProcInfo> = sys
        .processes()
        .iter()
        .map(|(pid, p)| ProcInfo {
            name: p.name().to_string_lossy().into_owned(),
            pid: pid.as_u32(),
            mem_mb: p.memory() / 1_048_576,
            cpu: p.cpu_usage(),
        })
        .collect();
    procs.sort_by(|a, b| b.mem_mb.cmp(&a.mem_mb));
    procs.truncate(15);

    Ok(serde_json::json!({
        "hostname": System::host_name().unwrap_or_default(),
        "os": format!(
            "{} {}",
            System::name().unwrap_or_default(),
            System::os_version().unwrap_or_default()
        ),
        "uptime_hours": System::uptime() / 3600,
        "mem_total_mb": sys.total_memory() / 1_048_576,
        "mem_used_mb": sys.used_memory() / 1_048_576,
        "process_count": sys.processes().len(),
        "top_processes_by_memory": procs,
    }))
}

/// Network audit — summarizes netstat output: connection states and the most
/// frequent remote endpoints (helps spot unusual outbound traffic).
/// Windows: `netstat -ano` (state col 4, remote `host:port`).
/// macOS/Linux: `netstat -an` (state last col, remote `host.port` on macOS).
#[tauri::command]
async fn network_scan() -> Result<serde_json::Value, String> {
    let out = cmd("netstat")
        .arg(if cfg!(windows) { "-ano" } else { "-an" })
        .output()
        .map_err(|e| format!("netstat failed: {e}"))?;
    let text = String::from_utf8_lossy(&out.stdout);

    let (mut established, mut listening, mut other) = (0u32, 0u32, 0u32);
    let mut remotes: HashMap<String, u32> = HashMap::new();

    for line in text.lines() {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 4 {
            continue;
        }
        let proto = cols[0].to_ascii_lowercase();
        if !proto.starts_with("tcp") && !proto.starts_with("udp") {
            continue;
        }
        let state = if cfg!(windows) {
            cols.get(3).copied().unwrap_or("")
        } else {
            cols.last().copied().unwrap_or("")
        };
        match state {
            "ESTABLISHED" => {
                established += 1;
                // remote addr without port → aggregate per host
                let remote = if cfg!(windows) { cols.get(2) } else { cols.get(4) };
                let host = remote.and_then(|r| {
                    if cfg!(windows) {
                        r.rsplit_once(':').map(|(h, _)| h.to_string())
                    } else {
                        r.rsplit_once('.').map(|(h, _)| h.to_string())
                    }
                });
                if let Some(h) = host {
                    if h != "127.0.0.1" && h != "[::1]" && h != "0.0.0.0" && h != "*" && !h.is_empty() {
                        *remotes.entry(h).or_insert(0) += 1;
                    }
                }
            }
            "LISTENING" | "LISTEN" => listening += 1,
            _ => other += 1,
        }
    }

    let mut top: Vec<(String, u32)> = remotes.into_iter().collect();
    top.sort_by(|a, b| b.1.cmp(&a.1));
    top.truncate(8);

    Ok(serde_json::json!({
        "established": established,
        "listening_ports": listening,
        "other_states": other,
        "top_remote_hosts": top.iter().map(|(h, c)| format!("{h} ({c} conn)")).collect::<Vec<_>>(),
    }))
}

/// Firewall state — Windows: `netsh advfirewall` · macOS: socketfilterfw.
#[tauri::command]
async fn firewall_status() -> Result<String, String> {
    if cfg!(windows) {
        let out = cmd("netsh")
            .args(["advfirewall", "show", "allprofiles", "state"])
            .output()
            .map_err(|e| format!("netsh failed: {e}"))?;
        return Ok(String::from_utf8_lossy(&out.stdout).trim().to_string());
    }
    if cfg!(target_os = "macos") {
        let out = cmd("/usr/libexec/ApplicationFirewall/socketfilterfw")
            .arg("--getglobalstate")
            .output()
            .map_err(|e| format!("socketfilterfw failed: {e}"))?;
        return Ok(String::from_utf8_lossy(&out.stdout).trim().to_string());
    }
    Ok("Firewall check is not implemented on this OS.".into())
}

/// Resolves a Node sidecar's `index.js` in BOTH installed and dev builds:
///   1. installed → <resources>/<folder>/index.js (NSIS bundles it)
///   2. dev       → <cwd>/../<folder>/index.js  (cwd is src-tauri)
///                  or <cwd>/<folder>/index.js  (cwd is project root)
fn sidecar_script(app: &tauri::AppHandle, folder: &str) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join(folder).join("index.js");
        if p.exists() {
            return Some(p);
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        for cand in [
            cwd.join("..").join(folder).join("index.js"),
            cwd.join(folder).join("index.js"),
        ] {
            if cand.exists() {
                return Some(cand);
            }
        }
    }
    None
}

/// Spawns a Node sidecar (best-effort). Each sidecar exits by itself if its
/// port is already taken, so calling this repeatedly is harmless.
fn spawn_node_sidecar(app: &tauri::AppHandle, folder: &str) {
    if let Some(script) = sidecar_script(app, folder) {
        if let Some(dir) = script.parent().map(std::path::Path::to_path_buf) {
            let _ = cmd("node").arg(&script).current_dir(dir).spawn();
        }
    }
}

/// Frontend-triggered auto-start: (re)launch the media + Playwright sidecars
/// on demand when the UI detects one is offline. Returns which were attempted.
#[tauri::command]
fn start_sidecars(app: tauri::AppHandle) -> String {
    spawn_node_sidecar(&app, "playwright-server");
    spawn_node_sidecar(&app, "media-server");
    spawn_node_sidecar(&app, "db-server");
    "sidecars started".into()
}

/* ── Sandbox / runtime diagnostics & self-heal ─────────────────────── */

/// True if `program --version` (or `-version` for ffmpeg) runs successfully.
fn tool_ok(program: &str, version_flag: &str) -> bool {
    cmd(program)
        .arg(version_flag)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// A sidecar folder needs `npm install` if its package.json declares
/// dependencies but no node_modules directory exists yet.
fn dir_needs_install(app: &tauri::AppHandle, folder: &str) -> bool {
    if let Some(script) = sidecar_script(app, folder) {
        if let Some(dir) = script.parent() {
            let pkg = dir.join("package.json");
            let has_deps = std::fs::read_to_string(&pkg)
                .map(|s| s.contains("\"dependencies\""))
                .unwrap_or(false);
            let installed = dir.join("node_modules").exists();
            return has_deps && !installed;
        }
    }
    false
}

/// Read-only health report the UI uses to show actionable setup messages
/// instead of a generic "engine offline". Returns a JSON string.
#[tauri::command]
fn sandbox_diagnostics(app: tauri::AppHandle) -> String {
    let node = tool_ok("node", "-v");
    let npm = tool_ok("npm", "-v");
    let ffmpeg = tool_ok("ffmpeg", "-version");
    let pw_script = sidecar_script(&app, "playwright-server").is_some();
    let media_script = sidecar_script(&app, "media-server").is_some();
    let db_script = sidecar_script(&app, "db-server").is_some();
    let pw_needs_install = dir_needs_install(&app, "playwright-server");
    format!(
        "{{\"node\":{},\"npm\":{},\"ffmpeg\":{},\"playwrightScript\":{},\"mediaScript\":{},\"dbScript\":{},\"playwrightNeedsInstall\":{}}}",
        node, npm, ffmpeg, pw_script, media_script, db_script, pw_needs_install
    )
}

/// First-run self-heal: if the Playwright sidecar's deps are missing, kick off
/// `npm install` (which also downloads Chromium via postinstall) in the
/// background. Best-effort; returns whether an install was started.
#[tauri::command]
fn prepare_sidecars(app: tauri::AppHandle) -> String {
    if !tool_ok("npm", "-v") {
        return "{\"ok\":false,\"reason\":\"npm-missing\"}".into();
    }
    let mut started = false;
    if dir_needs_install(&app, "playwright-server") {
        if let Some(script) = sidecar_script(&app, "playwright-server") {
            if let Some(dir) = script.parent().map(std::path::Path::to_path_buf) {
                let _ = cmd("npm")
                    .arg("install")
                    .arg("--omit=dev")
                    .current_dir(dir)
                    .spawn();
                started = true;
            }
        }
    }
    format!("{{\"ok\":true,\"installStarted\":{}}}", started)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // db + media are zero-dep → start immediately so NOVA/assemble and
            // the local DB are up right away.
            spawn_node_sidecar(app.handle(), "db-server");
            spawn_node_sidecar(app.handle(), "media-server");
            // Playwright needs deps + Chromium. On first run, install (blocking,
            // on a background thread) BEFORE spawning so it doesn't crash-loop.
            let h = app.handle().clone();
            std::thread::spawn(move || {
                if dir_needs_install(&h, "playwright-server") {
                    if let Some(script) = sidecar_script(&h, "playwright-server") {
                        if let Some(dir) = script.parent() {
                            let _ = cmd("npm")
                                .arg("install")
                                .current_dir(dir)
                                .status(); // blocks this thread until done
                        }
                    }
                }
                spawn_node_sidecar(&h, "playwright-server");
            });
            Ok(())
        })
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            ping,
            core_status,
            guard_sign,
            guard_verify,
            transcribe_audio,
            piper_speak,
            hardware_id,
            start_sidecars,
            sandbox_diagnostics,
            prepare_sidecars,
            oauth_listen,
            fs_scan_downloads,
            fs_organize,
            fs_undo,
            fs_find,
            fs_cleanup_temp,
            security_scan,
            network_scan,
            firewall_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running Cinem AI Assistant");
}
