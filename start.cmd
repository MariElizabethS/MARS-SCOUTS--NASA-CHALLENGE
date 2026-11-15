@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or later is required. Install it, then run this file again.
  pause
  exit /b 1
)
echo Keep this window open while using Mars Scouts.
echo Open the local address printed below in your browser.
node server.mjs
if errorlevel 1 pause
