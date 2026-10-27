# CINEM Pro desktop — Windows install (cloud desk).
# Default: download CINEM-Pro-Setup.exe and launch it. No git, Node, or Postgres.
# Usage:
#   irm https://raw.githubusercontent.com/mrosmanyt/brandcrew/main/scripts/install-desktop.ps1 | iex
# Dev checkout (local Next): $env:CINEM_INSTALL_DEV = "1"

$ErrorActionPreference = "Stop"

function Install-FromCheckout {
  $Repo = if ($env:BRANDCREW_REPO) { $env:BRANDCREW_REPO } else { "https://github.com/mrosmanyt/brandcrew.git" }
  $Dir = if ($env:BRANDCREW_DIR) { $env:BRANDCREW_DIR } else { Join-Path $HOME "brandcrew" }
  $Ref = if ($env:BRANDCREW_REF) { $env:BRANDCREW_REF } else { "main" }

  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "git is required for CINEM_INSTALL_DEV=1." }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 20+ is required. Install from https://nodejs.org" }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is required." }

  if (Test-Path (Join-Path $Dir ".git")) {
    Write-Host "Updating $Dir ..."
    git -C $Dir fetch origin $Ref
    git -C $Dir checkout $Ref
    git -C $Dir pull --ff-only origin $Ref
  } else {
    Write-Host "Cloning $Repo -> $Dir ..."
    git clone --branch $Ref --depth 1 $Repo $Dir
  }

  Set-Location $Dir
  Write-Host "Installing dependencies..."
  npm install

  if ($env:CINEM_DESK_MODE -eq "local") {
    Write-Host "Opening local Next desk (needs Postgres)..."
    npm run desktop:dev
  } else {
    Write-Host "Opening cloud desk https://app.cinem.tech (no local database)..."
    $env:CINEM_DESK_MODE = "cloud"
    npm run desktop:cloud
  }
}

if ($env:CINEM_INSTALL_DEV -eq "1") {
  Install-FromCheckout
  return
}

$Url = if ($env:CINEM_SETUP_URL) {
  $env:CINEM_SETUP_URL
} else {
  "https://github.com/mrosmanyt/cinem-pro-releases/releases/latest/download/CINEM-Pro-Setup.exe"
}
$Out = Join-Path $env:TEMP "CINEM-Pro-Setup.exe"
Write-Host "Downloading CINEM Pro Setup..."
Write-Host $Url
Write-Host "Unsigned builds: SmartScreen → More info → Run anyway."
Invoke-WebRequest -Uri $Url -OutFile $Out
Start-Process -FilePath $Out
