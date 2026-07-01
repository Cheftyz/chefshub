@echo off
setlocal
title ChefsHub Launcher
cd /d "%~dp0"

echo ============================================
echo   ChefsHub - Twitch + Kick chat client
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js is not installed.
  echo     Install it from https://nodejs.org/ then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies ^(first run only, may take a minute^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] npm install failed. See the messages above.
    pause
    exit /b 1
  )
  echo.
)

REM Start the two servers in their OWN windows so one failing never stops the other.
echo Starting the Kick proxy ^(http://localhost:8787^)...
start "ChefsHub Kick proxy" cmd /k node server\kick-proxy.mjs

echo Starting the web app ^(http://localhost:5173^)...
start "ChefsHub Web" cmd /k npm run dev

echo.
echo Waiting for the app to be ready...
set /a tries=0
:waitloop
set /a tries+=1
if %tries% gtr 60 (
  echo.
  echo [!] The web app did not start within 60 seconds.
  echo     Check the "ChefsHub Web" window for errors.
  pause
  exit /b 1
)
timeout /t 1 >nul
curl -s -o nul http://localhost:5173/
if errorlevel 1 goto waitloop

echo Ready! Opening http://localhost:5173
start "" http://localhost:5173

echo.
echo ChefsHub is running. Two server windows are open:
echo   - "ChefsHub Web"        (the app - keep open while using it)
echo   - "ChefsHub Kick proxy" (needed for sending Kick messages)
echo Close those windows to stop ChefsHub. You can close THIS window.
echo.
timeout /t 6 >nul
exit /b 0
