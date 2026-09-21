"""
DELTA ENGINE - IoT Edge Room Perception Bridge
Listens to ESP32 on COM7 over USB Serial and forwards door passage events
directly into the DELTA Engine server (http://localhost:3000/api/sensors/door).
"""

import sys
import json
import time
import requests
import serial
import serial.tools.list_ports

PORT = "COM7"
BAUD_RATE = 115200
API_URL = "http://localhost:3000/api/sensors/door"

def find_esp32_port():
    ports = serial.tools.list_ports.comports()
    for p in ports:
        if "CP210" in p.description or "UART" in p.description or "COM7" in p.device:
            return p.device
    return PORT

def run_bridge():
    port_name = find_esp32_port()
    print(f"\n=======================================================")
    print(f"⚡ DELTA ENGINE - IoT Door Passage Serial Bridge")
    print(f"📡 Connecting to ESP32 on: {port_name} at {BAUD_RATE} baud")
    print(f"🎯 Target Server: {API_URL}")
    print(f"=======================================================\n")

    try:
        ser = serial.Serial(port_name, BAUD_RATE, timeout=1)
        time.sleep(2)
        print(f"✅ Serial connection established! Listening for door crossings...\n")
    except Exception as e:
        print(f"❌ Failed to open port {port_name}: {e}")
        print("Please ensure the ESP32 is plugged in and not opened in another Serial Monitor.")
        return

    while True:
        try:
            if ser.in_waiting > 0:
                raw_line = ser.readline().decode('utf-8', errors='ignore').strip()
                if not raw_line:
                    continue

                if raw_line.startswith("{") and raw_line.endswith("}"):
                    try:
                        payload = json.loads(raw_line)
                        event = payload.get("event", "UNKNOWN")
                        occupancy = payload.get("netOccupancy", 0)
                        d1 = payload.get("dist1", 0)
                        d2 = payload.get("dist2", 0)

                        icon = "🟢 [ENTRY]" if event == "ENTRY" else "🔴 [EXIT]"
                        print(f"{icon} Net Occupancy: {occupancy} | Dist1: {d1}mm | Dist2: {d2}mm")

                        # Forward to DELTA Engine Server
                        try:
                            res = requests.post(API_URL, json=payload, timeout=2)
                            if res.status_code == 200:
                                data = res.json()
                                if data.get("surgeTriggered"):
                                    print(f"🔥 [DELTA SELF-HEALING TRIGGERED] Capacity overshoot detected! Reallocating room...")
                        except Exception as req_err:
                            print(f"⚠️ Server sync notice: DELTA Engine offline or unreachable ({req_err})")

                    except json.JSONDecodeError:
                        pass
                else:
                    # Print setup / debug messages from ESP32
                    print(f"[ESP32 Debug]: {raw_line}")

        except KeyboardInterrupt:
            print("\nBridge stopped by user.")
            break
        except Exception as loop_err:
            print(f"Error reading serial: {loop_err}")
            time.sleep(1)

if __name__ == "__main__":
    run_bridge()
