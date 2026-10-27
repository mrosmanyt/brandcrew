@echo off
cd /d "%~dp0"
echo === MARK LVI launcher ===
where py >nul 2>nul && (set PY=py) || (set PY=python)
%PY% --version
if errorlevel 1 (
  echo.
  echo Python nahi mila. Python 3.11-3.13 install karein: https://www.python.org/downloads/
  echo Install karte waqt "Add python.exe to PATH" zaroor tick karein.
  pause
  exit /b 1
)
if not exist ".setup_done" (
  echo.
  echo Pehli dafa setup chal raha hai - dependencies install ho rahi hain, kuch minute lagenge...
  %PY% setup.py
  if errorlevel 1 (
    echo.
    echo Setup fail hua. Upar wala error dekhein.
    pause
    exit /b 1
  )
  echo done> .setup_done
)
echo.
echo Starting MARK LVI...
%PY% main.py
echo.
echo MARK LVI band ho gaya (exit code %errorlevel%).
pause
