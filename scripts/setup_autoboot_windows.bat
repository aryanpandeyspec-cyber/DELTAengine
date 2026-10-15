@echo off
title DELTA Engine — Automated Windows Appliance Boot Configurator
color 0B

echo ===============================================================================
echo     ⚡ DELTA ENGINE — Appliance Auto-Boot Installer (Server Room Mode)
echo ===============================================================================
echo  This script configures DELTA Engine to automatically start when Windows boots,
echo  ensuring 24/7 uptime even after power outages without requiring user login.
echo ===============================================================================
echo.

set TASK_NAME=DeltaEngineAutoBoot
set SCRIPT_PATH=%~dp0..\start_delta.bat

echo [STEP 1] Verifying administrative privileges...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Please right-click this script and select "Run as Administrator"!
    pause
    exit /b 1
)

echo [STEP 2] Creating scheduled appliance boot task...
schtasks /create /tn "%TASK_NAME%" /tr "\"%SCRIPT_PATH%\"" /sc ONSTART /ru "SYSTEM" /rl HIGHEST /f

if %errorLevel% equ 0 (
    echo.
    echo ===============================================================================
    echo  ✅ SUCCESS: DELTA Engine is now registered as an auto-booting appliance!
    echo     - Task Name: %TASK_NAME%
    echo     - Trigger:   On System Startup (Before Login)
    echo     - Target:    %SCRIPT_PATH%
    echo ===============================================================================
) else (
    echo [ERROR] Failed to register scheduled task.
)

pause
