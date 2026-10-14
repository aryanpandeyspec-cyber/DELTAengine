#!/usr/bin/env bash
# DELTA Engine v3.6 — 1-Click Operational Launcher (Linux/Mac/WSL)

set -e

echo "==============================================================================="
echo "     ⚡ DELTA ENGINE v3.6 — Autonomous Spatial & Crowd Operating System"
echo "==============================================================================="
echo ""

# 1. Verify Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed! Please install Node.js 18+."
    exit 1
fi

# 2. Verify Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "[ERROR] Python is not installed! Please install Python 3.10+."
    exit 1
fi
PYTHON_BIN=$(command -v python3 || command -v python)

# 3. Check if server already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "[OK] DELTA Backend Server is already running on port 3000."
else
    echo "[STARTING] Launching DELTA Central Server on port 3000 (0.0.0.0)..."
    nohup node backend/server.js > delta_server.log 2>&1 &
    sleep 2
fi

# 4. Open dashboard in default browser
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:3000/app.html" &> /dev/null || true
elif command -v open &> /dev/null; then
    open "http://localhost:3000/app.html" || true
fi

echo ""
echo "==============================================================================="
echo "                             OPERATIONAL MENU"
echo "==============================================================================="
echo " [1] Connect to Live College CCTV / NVR (Enter RTSP URL)"
echo " [2] Run 3-Second Server Room Pre-Flight Safety Test (--test)"
echo " [3] Connect USB Webcam / Virtual Camera"
echo " [4] Run Continuous Telemetry Simulation Mode (Background Pax Stream)"
echo " [5] Exit Launcher (Server continues running in background)"
echo "==============================================================================="
echo ""

read -p "Select an option [1-5]: " choice

case "$choice" in
    1)
        read -p "Enter College NVR RTSP URL: " rtsp_url
        $PYTHON_BIN hardware/edge_cctv_daemon.py --rtsp "$rtsp_url" --hall hall-1 --preview
        ;;
    2)
        read -p "Enter College NVR RTSP URL to Test: " rtsp_url
        $PYTHON_BIN hardware/edge_cctv_daemon.py --rtsp "$rtsp_url" --test
        ;;
    3)
        $PYTHON_BIN hardware/edge_cctv_daemon.py --rtsp 0 --hall hall-1 --preview
        ;;
    4)
        $PYTHON_BIN hardware/edge_cctv_daemon.py --hall hall-1 --rate 2.0
        ;;
    5)
        echo "Exiting."
        exit 0
        ;;
    *)
        echo "Invalid selection."
        ;;
esac
