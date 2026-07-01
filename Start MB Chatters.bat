@echo off
setlocal
title MB Chatters
cd /d "%~dp0"

echo ============================================
echo   MB Chatters - Twitch + Kick chat client
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
  if errorlevel 1 ( echo [!] npm install failed. & pause & exit /b 1 )
  echo.
)

if not exist ".env" (
  echo [!] No .env file found. Copy .env.example to .env and set ADMIN_EMAIL / ADMIN_PASSWORD.
  echo.
  pause
  exit /b 1
)

echo Building the app...
call npm run build
if errorlevel 1 ( echo [!] Build failed. See messages above. & pause & exit /b 1 )
echo.

echo Starting MB Chatters server ^(http://localhost:8787^)...
start "MB Chatters Server" cmd /k npm run server

echo Waiting for the server to be ready...
set /a tries=0
:waitloop
set /a tries+=1
if %tries% gtr 60 ( echo [!] Server did not start within 60 seconds. Check the "MB Chatters Server" window. & pause & exit /b 1 )
timeout /t 1 >nul
curl -s -o nul http://localhost:8787/api/health
if errorlevel 1 goto waitloop

echo Ready! Opening http://localhost:8787
start "" http://localhost:8787
echo.
echo MB Chatters is running in the "MB Chatters Server" window. Close it to stop.
echo You can close THIS window.
timeout /t 6 >nul
exit /b 0
