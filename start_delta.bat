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
echo  [1] Run Multi-Camera Commodity Edge Daemon (using config/cameras.json)
echo  [2] Connect Single Live College CCTV / NVR (Enter RTSP URL)
echo  [3] Run 3-Second Server Room Pre-Flight Safety Test (--test)
echo  [4] Connect USB Webcam / OBS Virtual Camera (Webcam Mode)
echo  [5] Run Continuous Telemetry Simulation Mode (Background Pax Stream)
echo  [6] Connect Physical ESP32 Door Counter (USB Serial Bridge)
echo  [7] Run ESP32 Multi-Gate Mesh Simulation (Gates A, B, C)
echo  [8] Run Comprehensive System & Compliance Audit (tests/runAllTests.js)
echo  [9] Open Mobile Field Terminal (/volunteer.html) & Signage (/signage.html)
echo  [0] Exit Launcher (Server continues running in background)
echo ===============================================================================
echo.

set /p choice="Select an option [0-9]: "

if "%choice%"=="1" (
    echo.
    echo [STARTING] Launching Multi-Camera Commodity Daemon (3 FPS Sampling)...
    python hardware/edge_cctv_daemon.py --config config/cameras.json
)

if "%choice%"=="2" (
    echo.
    set /p rtsp_url="Enter College NVR RTSP URL (e.g. rtsp://admin:pass@192.168.1.100:554/cam/realmonitor?channel=1&subtype=1): "
    if "!rtsp_url!"=="" (
        echo [ERROR] No RTSP URL provided. Returning...
        pause
        goto :eof
    )
    echo [STARTING] Launching Live RTSP Edge Vision Daemon...
    python hardware/edge_cctv_daemon.py --rtsp "!rtsp_url!" --hall hall-1 --preview
)

if "%choice%"=="3" (
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

if "%choice%"=="4" (
    echo.
    echo [STARTING] Launching USB / Virtual Camera (Index 0)...
    python hardware/edge_cctv_daemon.py --rtsp 0 --hall hall-1 --preview
)

if "%choice%"=="5" (
    echo.
    echo [STARTING] Launching Automated Edge Telemetry Stream (2s interval)...
    python hardware/edge_cctv_daemon.py --hall hall-1 --rate 2.0
)

if "%choice%"=="6" (
    echo.
    echo [STARTING] Launching Physical ESP32 Door Counter Serial Bridge...
    python hardware/door_serial_bridge.py --hall hall-1
)

if "%choice%"=="7" (
    echo.
    echo [STARTING] Launching Multi-Gate Mesh Simulation (Gates A, B, C)...
    python hardware/door_serial_bridge.py --mesh-sim --hall hall-1
)

if "%choice%"=="8" (
    echo.
    echo [AUDIT] Running DELTA Engine 84-point comprehensive test suite...
    node tests/runAllTests.js
    pause
)

if "%choice%"=="9" (
    start http://localhost:3000/volunteer.html
    start http://localhost:3000/signage.html
)

if "%choice%"=="0" (
    echo [EXIT] DELTA Launcher finished.
    exit /b 0
)

pause

