@echo off
setlocal enabledelayedexpansion
title DELTA ENGINE v3.6 — 1-Click Operational Launcher
color 0A

echo ===============================================================================
echo      ⚡ DELTA ENGINE v3.6 — Autonomous Spatial & Crowd Operating System
echo ===============================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH! Please install Node.js 18+.
    pause
    exit /b 1
)

:: 2. Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH! Please install Python 3.10+.
    pause
    exit /b 1
)

:: 3. Launch Backend Server in background window if not already listening
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [OK] DELTA Backend Server is already running on port 3000.
) else (
    echo [STARTING] Launching DELTA Central Server on port 3000 (0.0.0.0)...
    start "DELTA Server (Port 3000)" cmd /k "node backend/server.js"
    timeout /t 2 /nobreak >nul
)

:: 4. Open Local Browser Dashboard
echo [LAUNCH] Opening DELTA Engine Dashboard in default browser...
start http://localhost:3000/app.html

echo.
echo ===============================================================================
echo                              OPERATIONAL MENU
echo ===============================================================================
echo  [1] Connect to Live College CCTV / NVR (Enter RTSP URL)
echo  [2] Run 3-Second Server Room Pre-Flight Safety Test (--test)
echo  [3] Connect USB Webcam / OBS Virtual Camera (Webcam Mode)
echo  [4] Run Continuous Telemetry Simulation Mode (Background Pax Stream)
echo  [5] Open Mobile Volunteer Terminal (/volunteer.html)
echo  [6] Open Digital Hallway Signage (/signage.html)
echo  [7] Exit Launcher (Server continues running in background)
echo ===============================================================================
echo.

set /p choice="Select an option [1-7]: "

if "%choice%"=="1" (
    echo.
    set /p rtsp_url="Enter College NVR RTSP URL (e.g. rtsp://admin:pass@192.168.1.100:554/ch1/main): "
    if "!rtsp_url!"=="" (
        echo [ERROR] No RTSP URL provided. Returning...
        pause
        goto :eof
    )
    echo [STARTING] Launching Live RTSP Edge Vision Daemon...
    python hardware/edge_cctv_daemon.py --rtsp "!rtsp_url!" --hall hall-1 --preview
)

if "%choice%"=="2" (
    echo.
    set /p rtsp_url="Enter College NVR RTSP URL to Test: "
    if "!rtsp_url!"=="" (
        echo [ERROR] No RTSP URL provided. Returning...
        pause
        goto :eof
    )
    python hardware/edge_cctv_daemon.py --rtsp "!rtsp_url!" --test
    pause
)

if "%choice%"=="3" (
    echo.
    echo [STARTING] Launching USB / Virtual Camera (Index 0)...
    python hardware/edge_cctv_daemon.py --rtsp 0 --hall hall-1 --preview
)

if "%choice%"=="4" (
    echo.
    echo [STARTING] Launching Automated Edge Telemetry Stream (2s interval)...
    python hardware/edge_cctv_daemon.py --hall hall-1 --rate 2.0
)

if "%choice%"=="5" (
    start http://localhost:3000/volunteer.html
)

if "%choice%"=="6" (
    start http://localhost:3000/signage.html
)

if "%choice%"=="7" (
    echo [EXIT] DELTA Launcher finished.
    exit /b 0
)

pause
