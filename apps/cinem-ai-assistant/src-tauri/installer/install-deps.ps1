# Cinem AI Assistant — post-install dependency bootstrap (best-effort, silent).
# Ensures Node is present and the Playwright sidecar has its deps + Chromium.
# Runs from the installed resources/bootstrap folder; failures are non-fatal
# (the app also self-heals on first launch via the Rust backend).

$ErrorActionPreference = "SilentlyContinue"

function Have($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

# Resolve the resource root (this script lives in <resources>\bootstrap\).
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

# 1) Node.js — install via winget if missing.
if (-not (Have node)) {
  if (Have winget) {
    winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
  }
}

# 2) ffmpeg — needed by the media (NOVA) sidecar for stitch/edit.
if (-not (Have ffmpeg)) {
  if (Have winget) {
    winget install -e --id Gyan.FFmpeg --silent --accept-package-agreements --accept-source-agreements | Out-Null
  }
}

# 3) Playwright sidecar deps + Chromium (only if missing).
$pw = Join-Path $root "playwright-server"
if ((Test-Path (Join-Path $pw "package.json")) -and -not (Test-Path (Join-Path $pw "node_modules"))) {
  if (Have npm) {
    Push-Location $pw
    npm install | Out-Null   # postinstall downloads Chromium
    Pop-Location
  }
}

exit 0
