"""
DELTA ENGINE - IoT Edge Room Perception Bridge (Multi-Gate Mesh Fusion)
Listens to ESP32 on USB Serial (e.g. COM7) or simulates multi-gate mesh passages
across Gate A (Main), Gate B (Emergency), Gate C (VIP), forwarding events
directly into the DELTA Engine server (http://localhost:3000/api/sensors/door).
"""

import sys
import json
import time
import argparse
import random
import requests
import serial
import serial.tools.list_ports

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

DEFAULT_PORT = "COM7"
BAUD_RATE = 115200
API_URL = "http://localhost:3000/api/sensors/door"

def parse_args():
    parser = argparse.ArgumentParser(description="DELTA Engine Multi-Gate Serial Bridge")
    parser.add_argument("--port", type=str, default=DEFAULT_PORT, help="Serial COM port (default: COM7)")
    parser.add_argument("--gate", type=str, default="gate-a", help="Gate ID (gate-a, gate-b, gate-c)")
    parser.add_argument("--hall", type=str, default="hall-1", help="Target Hall ID (default: hall-1)")
    parser.add_argument("--api", type=str, default=API_URL, help="Target DELTA server endpoint")
    parser.add_argument("--mesh-sim", action="store_true", help="Simulate multi-gate mesh sensor traffic across Gates A, B, and C")
    return parser.parse_args()

def find_esp32_port(preferred_port=DEFAULT_PORT):
    ports = serial.tools.list_ports.comports()
    for p in ports:
        if "CP210" in p.description or "UART" in p.description or preferred_port in p.device:
            return p.device
    return preferred_port

def run_mesh_simulation(api_url, hall_id):
    """Simulates realistic high-throughput multi-gate mesh sensor readings (Kumbh Mela / Large Hall)."""
    gates = [
        {"id": "gate-a", "name": "Gate A (Main Entrance)", "bias": 0.8},   # 80% entries
        {"id": "gate-b", "name": "Gate B (Emergency Egress)", "bias": 0.1}, # 90% exits
        {"id": "gate-c", "name": "Gate C (VIP Passage)", "bias": 0.5}       # balanced
    ]
    net_sim = 45

    print(f"\n=======================================================")
    print(f"🛰️ DELTA ENGINE - Multi-Gate Mesh Simulator Active")
    print(f"🏛️ Monitoring Hall: {hall_id}")
    print(f"🚪 Active Gates: Gate A (Main), Gate B (Egress), Gate C (VIP)")
    print(f"🎯 Target Server: {api_url}")
    print(f"=======================================================\n")

    try:
        while True:
            chosen_gate = random.choice(gates)
            is_entry = random.random() < chosen_gate["bias"]
            event_type = "ENTRY" if is_entry else "EXIT"
            if is_entry:
                net_sim += 1
            else:
                net_sim = max(0, net_sim - 1)

            payload = {
                "event": event_type,
                "hallId": hall_id,
                "gateId": chosen_gate["id"],
                "gateName": chosen_gate["name"],
                "netOccupancy": net_sim,
                "dist1": random.randint(30, 90),
                "dist2": random.randint(30, 90)
            }

            icon = "🟢" if event_type == "ENTRY" else "🔴"
            print(f"{icon} [{chosen_gate['name']}] {event_type} | Hall Net: {net_sim} Pax")

            try:
                res = requests.post(api_url, json=payload, timeout=2)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("surgeTriggered"):
                        print(f"🔥 [DELTA AUTOPILOT TRIGGERED] Capacity overshoot detected from {chosen_gate['name']}! Auto-reallocating...")
            except Exception as e:
                print(f"⚠️ Server sync notice: {e}")

            time.sleep(random.uniform(1.2, 3.5))
    except KeyboardInterrupt:
        print("\nMesh simulation terminated.")

def run_bridge():
    args = parse_args()
    if args.mesh_sim:
        run_mesh_simulation(args.api, args.hall)
        return

    gate_names = {
        "gate-a": "Gate A (Main Entrance)",
        "gate-b": "Gate B (Emergency Egress)",
        "gate-c": "Gate C (VIP Passage)"
    }
    gate_name = gate_names.get(args.gate, f"Gate ({args.gate})")

    while True:
        port_name = find_esp32_port(args.port)
        print(f"\n=======================================================")
        print(f"⚡ DELTA ENGINE - IoT Multi-Gate Serial Bridge")
        print(f"📡 Connecting to ESP32 on: {port_name} at {BAUD_RATE} baud")
        print(f"🚪 Gate: {gate_name} ({args.gate}) | Hall: {args.hall}")
        print(f"🎯 Target Server: {args.api}")
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

                            payload["gateId"] = args.gate
                            payload["gateName"] = gate_name
                            payload["hallId"] = args.hall

                            icon = "🟢 [ENTRY]" if event == "ENTRY" else "🔴 [EXIT]" if event == "EXIT" else "⚡ [DOOR TRIGGER]"
                            print(f"{icon} [{gate_name}] Net: {occupancy} | Dist1: {d1}mm | Dist2: {d2}mm (Event: {event})")

                            # Forward to DELTA Engine Server
                            try:
                                res = requests.post(args.api, json=payload, timeout=2)
                                if res.status_code == 200:
                                    data = res.json()
                                    if data.get("surgeTriggered"):
                                        print(f"🔥 [DELTA AUTOPILOT TRIGGERED] Capacity overshoot detected from {gate_name}! Reallocating room...")
                            except Exception as req_err:
                                print(f"⚠️ Server sync notice: DELTA Engine offline or unreachable ({req_err})")

                        except json.JSONDecodeError:
                            pass
                    elif any(k in raw_line for k in ["TARGET DETECTED", "PASSAGE IN PROGRESS", "LED BLINK", "Passage registered"]):
                        print(f"⚡ [ESP32 PASSAGE REGISTERED] {raw_line} -> Forwarding to DELTA Engine Counter...")
                        try:
                            res = requests.post(args.api, json={
                                "event": "DOOR_TRIGGER",
                                "hallId": args.hall,
                                "gateId": args.gate,
                                "gateName": gate_name,
                                "dist1": 80,
                                "dist2": 80
                            }, timeout=2)
                        except Exception as req_err:
                            print(f"⚠️ Server sync notice: {req_err}")
                    else:
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
