@echo off
title Cinem AI Assistant - Local Dev Sandbox
color 0B
cd /d "%~dp0"

echo ===============================================
echo            Cinem AI Assistant  -  Local Dev Sandbox
echo ===============================================
echo.

REM --- 1. Node check ---
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js nahi mila. Install karein: https://nodejs.org  (LTS)
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo [OK] Node %%v

REM --- 2. Install deps if needed ---
if not exist "node_modules" (
  echo [..] Pehli baar - npm install chal raha hai (thoda time lagega)...
  call npm install
  if errorlevel 1 ( echo [X] npm install fail. & pause & exit /b 1 )
)

REM --- 3. Typecheck ---
echo.
echo [..] Code verify ho raha hai...
call npm run verify
echo.

REM --- 4. Start sidecars in a new window ---
echo [OK] Sidecars start kar raha hoon (db + browser + media)...
start "Cinem AI Assistant Sidecars" cmd /k "npm run sidecars"

REM --- 5. Start the app (dev) ---
timeout /t 3 >nul
echo [OK] Cinem AI Assistant app start ho raha hai...
echo.
echo  - App:      http://localhost:1420
echo  - Media:    http://127.0.0.1:7880/health
echo  - Browser:  http://127.0.0.1:7878/health
echo  - DB:       http://127.0.0.1:1430/health
echo.
echo  (Tauri desktop ke liye alag terminal mein: npm run tauri dev)
echo.
call npm run dev

pause
