<#
  FINISH-REBRAND-RENAME.ps1
  ---------------------------------------------------------------
  Completes the CinemAIAssistant -> Cinem AI Assistant rebrand.

  Everything INSIDE the files has already been rebranded (product
  name, UI text, package.json names, Tauri identifier, etc). What
  is left is a handful of actual file/folder NAMES on disk that an
  automated tool could not rename remotely, plus the small number
  of text references that were deliberately left pointing at those
  old names so the app would keep building until you ran this.

  This script:
    1. Renames the remaining cinem-ai-assistant-* files/folders to their
       cinem-ai-assistant-* equivalents.
    2. Fixes every text reference that pointed at those old names
       so they point at the new ones instead.
    3. Renames the project root folder itself last
       (D:\CinemAIAssistant -> D:\Cinem AI Assistant).

  HOW TO RUN
    1. Close VS Code / any terminal with this folder open, and stop
       any running dev servers (npm run tauri dev, npm run sidecars, etc).
    2. Open PowerShell.
    3. cd D:\CinemAIAssistant
    4. .\FINISH-REBRAND-RENAME.ps1
       (if PowerShell blocks the script: powershell -ExecutionPolicy Bypass -File .\FINISH-REBRAND-RENAME.ps1)
    5. The project will now live at D:\Cinem AI Assistant. cd there and continue
       as normal: npm install (if node_modules needs a refresh), npm run tauri dev.

  Safe to re-run: every step checks whether it already happened
  before doing anything.

  NOTE: scripts\CinemAIAssistant_Users_Credentials.csv and .pdf are real
  customer data and are intentionally left completely untouched by
  this script (name and contents).
#>

$ErrorActionPreference = "Stop"
$root = Get-Location

function Rename-IfExists($path, $newName) {
    if (Test-Path -LiteralPath $path) {
        $item = Get-Item -LiteralPath $path
        if ($item.Name -ne $newName) {
            Rename-Item -LiteralPath $path -NewName $newName
            Write-Host "[renamed] $path -> $newName"
        }
    } else {
        Write-Host "[skip] $path not found (already renamed?)"
    }
}

Write-Host "=== Step 1: renaming files/folders ==="

# Next.js route folder (rename before renaming its parent cinem-ai-assistant-website)
Rename-IfExists (Join-Path $root "cinem-ai-assistant-website\app\downloadcinem-ai-assistant") "downloadcinem-ai-assistant"

# Top-level project folders
Rename-IfExists (Join-Path $root "cinem-ai-assistant-website") "cinem-ai-assistant-website"
Rename-IfExists (Join-Path $root "cinem-ai-assistant-cloud") "cinem-ai-assistant-cloud"

# Individual files
Rename-IfExists (Join-Path $root "src\components\center\Cinem AI AssistantPlayer.tsx") "CinemAiAssistantPlayer.tsx"
Rename-IfExists (Join-Path $root "START-CinemAIAssistant.bat") "START-CINEM-AI-ASSISTANT.bat"
Rename-IfExists (Join-Path $root "CinemAIAssistant-Plan.md") "CINEM-AI-ASSISTANT-Plan.md"
Rename-IfExists (Join-Path $root "CinemAIAssistant-Implementation-Blueprint.md") "CINEM-AI-ASSISTANT-Implementation-Blueprint.md"

Write-Host "`n=== Step 2: fixing text references to the old names ==="

# Only text-ish files; skip node_modules, .git, target (Rust build), dist, and
# the two protected credentials files.
$textExtensions = @(".ts",".tsx",".js",".mjs",".json",".md",".toml",".rs",".css",".txt",".html",".bat",".ps1",".nsh",".env",".example",".local",".gitignore",".gitattributes")
$excludeDirs = @("node_modules", ".git", "target", "dist", "gen")

$replacements = @(
    @{ old = "downloadcinem-ai-assistant";  new = "downloadcinem-ai-assistant" },
    @{ old = "cinem-ai-assistant-website";  new = "cinem-ai-assistant-website" },
    @{ old = "cinem-ai-assistant-cloud";    new = "cinem-ai-assistant-cloud" },
    @{ old = "Cinem AI AssistantPlayer";    new = "CinemAiAssistantPlayer" },
    @{ old = "START-CinemAIAssistant.bat"; new = "START-CINEM-AI-ASSISTANT.bat" },
    @{ old = "CinemAIAssistant-Plan.md";  new = "CINEM-AI-ASSISTANT-Plan.md" },
    @{ old = "CinemAIAssistant-Implementation-Blueprint.md"; new = "CINEM-AI-ASSISTANT-Implementation-Blueprint.md" }
)

$files = Get-ChildItem -Path $root -Recurse -File -Force | Where-Object {
    $f = $_
    if ($textExtensions -notcontains $f.Extension.ToLower()) { return $false }
    if ($f.Name -eq "CinemAIAssistant_Users_Credentials.csv" -or $f.Name -eq "CinemAIAssistant_Users_Credentials.pdf") { return $false }
    foreach ($d in $excludeDirs) {
        if ($f.FullName -like "*\$d\*") { return $false }
    }
    return $true
}

$changedCount = 0
foreach ($f in $files) {
    try {
        $content = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction Stop
    } catch {
        continue
    }
    if ($null -eq $content) { continue }
    $original = $content
    foreach ($r in $replacements) {
        $content = $content -replace [regex]::Escape($r.old), $r.new
    }
    if ($content -ne $original) {
        Set-Content -LiteralPath $f.FullName -Value $content -NoNewline
        $changedCount++
        Write-Host "[fixed refs] $($f.FullName.Substring($root.Path.Length + 1))"
    }
}
Write-Host "Fixed references in $changedCount file(s)."

Write-Host "`n=== Step 3: renaming the project root folder ==="
$rootName = Split-Path $root -Leaf
if ($rootName -eq "CinemAIAssistant") {
    $parent = Split-Path $root -Parent
    Set-Location $parent
    Rename-Item -LiteralPath $root -NewName "Cinem AI Assistant"
    Write-Host "[renamed] $root -> $(Join-Path $parent 'Cinem AI Assistant')"
    Write-Host "`nDone. The project now lives at: $(Join-Path $parent 'Cinem AI Assistant')"
    Write-Host "cd `"$(Join-Path $parent 'Cinem AI Assistant')`" and continue as normal."
} else {
    Write-Host "[skip] root folder is already named '$rootName', not 'CinemAIAssistant' - leaving as is."
}

Write-Host "`n=== Rebrand rename complete ==="
