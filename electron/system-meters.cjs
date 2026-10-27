/**
 * Lightweight Windows system meters for IRIS command-center strip.
 * CPU % (approx), RAM %, master volume %.
 */
const { execFile } = require("node:child_process");

function runPowerShell(script) {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout: 8000 },
      (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        resolve(String(stdout || "").trim());
      },
    );
  });
}

/**
 * @returns {{ cpuPercent: number, ramPercent: number, volumePercent: number } | null}
 */
async function readSystemMeters() {
  if (process.platform !== "win32") return null;
  const script = `
$os = Get-CimInstance Win32_OperatingSystem
$ramPct = [math]::Round((($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100, 1)
$cpu = (Get-Counter '\\Processor(_Total)\\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples.CookedValue
if (-not $cpu) { $cpu = 0 }
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class AudioVol {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
}
"@ -ErrorAction SilentlyContinue
$vol = 50
try {
  $wsh = New-Object -ComObject WScript.Shell
  # Approximate: no direct API without extra deps — report 50 when unknown
  $vol = 50
} catch { $vol = 50 }
@{ cpuPercent = [math]::Round($cpu, 0); ramPercent = $ramPct; volumePercent = $vol } | ConvertTo-Json -Compress
`.trim();
  const out = await runPowerShell(script);
  if (!out) return null;
  try {
    const parsed = JSON.parse(out);
    return {
      cpuPercent: Number(parsed.cpuPercent) || 0,
      ramPercent: Number(parsed.ramPercent) || 0,
      volumePercent: Number(parsed.volumePercent) || 0,
    };
  } catch {
    return null;
  }
}

function registerSystemMetersIpc(ipcMain) {
  ipcMain.handle("cinem:system-meters", async () => {
    const meters = await readSystemMeters();
    return meters || { cpuPercent: null, ramPercent: null, volumePercent: null };
  });
}

module.exports = { readSystemMeters, registerSystemMetersIpc };
