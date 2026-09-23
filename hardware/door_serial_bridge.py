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

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

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
    while True:
        port_name = find_esp32_port()
        print(f"\n=======================================================")
        print(f"⚡ DELTA ENGINE - IoT Door Passage Serial Bridge")
        print(f"📡 Connecting to ESP32 on: {port_name} at {BAUD_RATE} baud")
        print(f"🎯 Target Server: {API_URL}")
        print(f"=======================================================\n")

        try:
            ser = serial.Serial(port_name, BAUD_RATE, timeout=1)
            time.sleep(2)
            print(f"✅ Serial connection established on {port_name}! Listening for door crossings...\n")
        except PermissionError:
            print(f"⚠️ Port {port_name} is currently locked (Likely open in Arduino IDE Serial Monitor).")
            print("👉 Close the Serial Monitor in Arduino IDE to grant access to the bridge!")
            print("🔄 Retrying in 2 seconds...")
            time.sleep(2)
            continue
        except Exception as e:
            print(f"❌ Waiting for port {port_name}: {e}")
            time.sleep(3)
            continue

        try:
            while True:
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

                            icon = "🟢 [ENTRY]" if event == "ENTRY" else "🔴 [EXIT]" if event == "EXIT" else "⚡ [DOOR TRIGGER]"
                            print(f"{icon} Net: {occupancy} | Dist1: {d1}mm | Dist2: {d2}mm (Event: {event})")

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
                    elif any(k in raw_line for k in ["TARGET DETECTED", "PASSAGE IN PROGRESS", "LED BLINK", "Passage registered"]):
                        print(f"⚡ [ESP32 PASSAGE REGISTERED] {raw_line} -> Forwarding to DELTA Engine Counter...")
                        try:
                            res = requests.post(API_URL, json={
                                "event": "DOOR_TRIGGER",
                                "hallId": "hall-1",
                                "dist1": 80,
                                "dist2": 80
                            }, timeout=2)
                        except Exception as req_err:
                            print(f"⚠️ Server sync notice: {req_err}")
                    else:
                        # Print setup / debug messages from ESP32
                        print(f"[ESP32 Debug]: {raw_line}")

        except KeyboardInterrupt:
            print("\nBridge stopped by user.")
            break
        except Exception as loop_err:
            print(f"Serial disconnected or error: {loop_err}. Reconnecting...")
            try:
                ser.close()
            except Exception:
                pass
            time.sleep(2)

if __name__ == "__main__":
    run_bridge()
