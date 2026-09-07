# CINEM Pro desktop — clone (or update) and open the Electron window.
# Usage (PowerShell):
#   irm https://raw.githubusercontent.com/mrosmanyt/brandcrew/main/scripts/install-desktop.ps1 | iex
# Or from a checkout:  powershell -File scripts/install-desktop.ps1

$ErrorActionPreference = "Stop"
$Repo = if ($env:BRANDCREW_REPO) { $env:BRANDCREW_REPO } else { "https://github.com/mrosmanyt/brandcrew.git" }
$Dir = if ($env:BRANDCREW_DIR) { $env:BRANDCREW_DIR } else { Join-Path $HOME "brandcrew" }
$Ref = if ($env:BRANDCREW_REF) { $env:BRANDCREW_REF } else { "main" }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "git is required." }
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

Write-Host "Opening CINEM Pro desktop..."
Write-Host "Dev keys live in $Dir\.env — packaged app uses %APPDATA%\CINEM Pro\.env"
npm run desktop:dev
