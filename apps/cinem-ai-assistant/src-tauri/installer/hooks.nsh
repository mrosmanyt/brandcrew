; ──────────────────────────────────────────────────────────────────────
; Cinem AI Assistant — custom NSIS installer hooks (wired via tauri.conf.json →
; bundle.windows.nsis.installerHooks).
;
; Tauri's NSIS template already provides the professional shell:
;   • modern UI with progress bar and install log
;   • Start-Menu entry + Desktop shortcut named "Cinem AI Assistant"
;   • "Run Cinem AI Assistant" checkbox on the finish page (auto-launch)
;   • clean uninstaller
;
; These hooks add the CINEM-AI-ASSISTANT-specific steps: after the app files are
; copied, a bootstrap script installs the runtime dependencies
; (Node.js, Python, Playwright Chromium, Faster-Whisper) with live
; status output, so normal users need exactly ONE file: CINEM-AI-ASSISTANT-Setup.exe
; ──────────────────────────────────────────────────────────────────────

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Preparing Cinem AI Assistant installation…"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Installing Cinem AI Assistant runtime dependencies…"
  DetailPrint "(Node.js • Python • Playwright Chromium • Faster-Whisper)"
  DetailPrint "A console window will show live progress — please wait."
  ; Visible PowerShell window = progress feedback for long downloads.
  ; The script is defensive: every step is optional and it always exits 0,
  ; so a flaky network can never break the app installation itself.
  ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\bootstrap\install-deps.ps1" -InstallDir "$INSTDIR"' $0
  DetailPrint "Dependency bootstrap finished (exit code: $0)"
  DetailPrint "Creating shortcuts…"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping Cinem AI Assistant components…"
  ; Best-effort: stop a running Playwright sidecar before removing files.
  ExecWait 'powershell.exe -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like \"*Cinem AI Assistant*\" } | Stop-Process -Force -ErrorAction SilentlyContinue"'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "Cinem AI Assistant removed."
!macroend
