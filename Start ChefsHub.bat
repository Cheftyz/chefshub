@echo off
title ChefsHub
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
  echo Installing dependencies ^(first run only^)...
  call npm install
  echo.
)

echo Starting the web app ^(http://localhost:5173^) and Kick proxy ^(http://localhost:8787^)...
echo Keep this window open while you use ChefsHub. Close it to stop.
echo.

start "" cmd /c "timeout /t 5 >nul && start http://localhost:5173"
call npm run start

pause
