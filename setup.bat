@echo off
setlocal enabledelayedexpansion

echo.
echo ================================
echo Voice to Text - Windows Setup
echo ================================
echo.

REM Check if Node.js is installed
echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org/
    echo Then run this script again.
    pause
    exit /b 1
)
echo Node.js is installed: %NODE_VERSION%

REM Check if Python is installed
echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed!
    echo Please download and install Python 3.8+ from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo Then run this script again.
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo Python is installed: !PYTHON_VERSION!

REM Check if FFmpeg is installed
echo Checking FFmpeg installation...
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo.
    echo WARNING: FFmpeg is not installed!
    echo Installing FFmpeg using Chocolatey...
    choco --version >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Chocolatey is not installed.
        echo Please install Chocolatey first from: https://chocolatey.org/install
        echo Or install FFmpeg manually from: https://ffmpeg.org/download.html
        echo.
        pause
    ) else (
        echo Installing FFmpeg...
        choco install ffmpeg -y
        if errorlevel 1 (
            echo WARNING: FFmpeg installation may have failed. Please install manually.
            echo Visit: https://ffmpeg.org/download.html
        )
    )
) else (
    echo FFmpeg is already installed.
)

echo.
echo ================================
echo Installing Python Whisper...
echo ================================
echo.
pip install openai-whisper
if errorlevel 1 (
    echo ERROR: Failed to install Whisper!
    pause
    exit /b 1
)

echo.
echo ================================
echo Setting up Backend (Node.js)...
echo ================================
echo.
cd /d "%~dp0server"
echo Installing backend dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install backend dependencies!
    pause
    exit /b 1
)

echo.
echo ================================
echo Setting up Frontend (React)...
echo ================================
echo.
cd /d "%~dp0client"
echo Installing frontend dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install frontend dependencies!
    pause
    exit /b 1
)

echo.
echo ================================
echo Setup Complete!
echo ================================
echo.
echo To start the application:
echo.
echo 1. Open Command Prompt (cmd)
echo 2. Navigate to the project folder
echo 3. Run: npm run dev-all
echo.
echo Or run in separate terminals:
echo   Terminal 1: cd server && npm start
echo   Terminal 2: cd client && npm run dev
echo.
echo Open http://localhost:3000 in your browser
echo.
pause
