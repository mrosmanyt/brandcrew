import { spawn } from "node:child_process";
import { config } from "../config.js";

/** ffmpeg runner — timeout ke saath, clear errors. */
export function ffmpeg(args, { timeoutMs = 180_000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.ffmpegPath, ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let err = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`ffmpeg timeout (${timeoutMs / 1000}s)`));
    }, timeoutMs);
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", (e) => { clearTimeout(timer); reject(new Error(`ffmpeg chala nahi (${config.ffmpegPath}): ${e.message} — VPS par: apt install ffmpeg`)); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${err.slice(-400)}`));
    });
  });
}
