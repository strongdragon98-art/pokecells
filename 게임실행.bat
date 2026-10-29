@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo [1/2] Installing packages...
  call npm install
)
if not exist public\assets\manifest.json (
  echo [2/2] Downloading sprites...
  call npm run fetch-assets
)
echo Starting Poke Cells... close this window to stop the game server.
call npm run dev -- --open
