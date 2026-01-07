@echo off
setlocal

echo.
echo Starting Voice to Text Application...
echo.
echo Backend will run on: http://localhost:5000
echo Frontend will run on: http://localhost:3000
echo.
echo Ctrl+C to stop either terminal
echo.

REM Open two new windows - one for backend, one for frontend
start "Voice to Text - Backend (http://localhost:5000)" cmd /k "cd /d "%~dp0server" && npm start"
timeout /t 2
start "Voice to Text - Frontend (http://localhost:3000)" cmd /k "cd /d "%~dp0client" && npm run dev"

echo.
echo Opening http://localhost:3000 in your browser...
timeout /t 3
start http://localhost:3000

echo.
echo Both servers are starting. Close these windows to stop them.
