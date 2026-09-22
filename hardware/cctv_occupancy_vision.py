"""
DELTA ENGINE - CCTV Room Occupancy & Density Perception Agent
Hardware: Zebronics ZEB-CRYSTAL PRO 480p USB Web Camera
Calculates % of Room Occupied vs % of Room Empty in real time.
Streams telemetry to DELTA Engine Server (http://localhost:3000/api/sensors/camera)
and alerts coordinators & volunteers when room is FULL or EMPTY.
"""

import sys
import os
import time
import argparse
import requests
import cv2
import numpy as np

DEFAULT_API_URL = "http://localhost:3000/api/sensors/camera"
DEFAULT_CAPACITY = 25  # Configurable capacity for room / demo stage
DEFAULT_HALL_ID = "hall-1"
DEFAULT_HALL_NAME = "Turing Hall"

def parse_args():
    parser = argparse.ArgumentParser(description="DELTA Engine CCTV Room Density Perception")
    parser.add_argument("--camera", type=int, default=0, help="Camera device index (default: 0)")
    parser.add_argument("--capacity", type=int, default=DEFAULT_CAPACITY, help="Room seat capacity (default: 25)")
    parser.add_argument("--hall", type=str, default=DEFAULT_HALL_ID, help="Hall ID (default: hall-1)")
    parser.add_argument("--api", type=str, default=DEFAULT_API_URL, help="Target DELTA server endpoint")
    parser.add_argument("--demo", action="store_true", help="Force synthetic demo test mode")
    return parser.parse_args()

def init_detector():
    """Initializes multi-model detector combining Haar Cascade Face, Upper Body, and HOG."""
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    upper_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_upperbody.xml')
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    return {
        'face': face_cascade,
        'upper': upper_cascade,
        'hog': hog
    }

def draw_hud(frame, people_count, capacity, occupied_pct, empty_pct, status, source_name):
    """Draws rich Neubrutalist HUD with % Occupied and % Empty metrics directly on frame."""
    h, w = frame.shape[:2]

    # Top overlay header banner
    cv2.rectangle(frame, (0, 0), (w, 85), (17, 24, 39), -1) # Dark charcoal background
    cv2.rectangle(frame, (0, 83), (w, 87), (37, 99, 235), -1) # Blue accent line

    # Title & source
    cv2.putText(frame, "DELTA ENGINE - CCTV ROOM OCCUPANCY", (16, 26),
                cv2.FONT_HERSHEY_DUPLEX, 0.72, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, f"CAM: {source_name} (480p) | VENUE: Turing Hall", (16, 48),
                cv2.FONT_HERSHEY_SIMPLEX, 0.44, (156, 163, 175), 1, cv2.LINE_AA)

    # Status color logic
    if status == "ROOM_FULL":
        status_color = (68, 68, 239)     # Red
        status_bg = (30, 20, 180)
        badge_text = "CRITICAL: ROOM FULL (100%)"
    elif status == "NEAR_CAPACITY":
        status_color = (11, 158, 245)    # Amber/Yellow
        status_bg = (20, 100, 180)
        badge_text = f"WARNING: NEAR FULL ({occupied_pct}%)"
    elif status == "EMPTY":
        status_color = (200, 200, 200)   # Light Gray
        status_bg = (60, 60, 60)
        badge_text = "NOTICE: ROOM EMPTY (0%)"
    else:
        status_color = (129, 185, 16)    # Green
        status_bg = (20, 120, 30)
        badge_text = f"OPTIMAL: {occupied_pct}% OCCUPIED"

    # Status badge pill top-right
    badge_x = w - 260
    cv2.rectangle(frame, (badge_x, 14), (w - 16, 46), status_color, -1)
    cv2.putText(frame, badge_text, (badge_x + 10, 35),
                cv2.FONT_HERSHEY_DUPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)

    # Bottom HUD panel for % Occupied vs % Empty bars
    panel_y = h - 90
    cv2.rectangle(frame, (0, panel_y), (w, h), (17, 24, 39), -1)
    cv2.rectangle(frame, (0, panel_y), (w, panel_y + 3), (245, 158, 11), -1)

    # Metrics text
    cv2.putText(frame, f"HEADCOUNT: {people_count} / {capacity} PAX", (16, panel_y + 26),
                cv2.FONT_HERSHEY_DUPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
    
    cv2.putText(frame, f"OCCUPIED: {occupied_pct}%", (240, panel_y + 26),
                cv2.FONT_HERSHEY_DUPLEX, 0.55, status_color, 2, cv2.LINE_AA)

    cv2.putText(frame, f"EMPTY: {empty_pct}%", (410, panel_y + 26),
                cv2.FONT_HERSHEY_DUPLEX, 0.55, (230, 200, 100), 2, cv2.LINE_AA)

    # Dual Occupancy Bar
    bar_x = 16
    bar_y = panel_y + 44
    bar_w = w - 32
    bar_h = 16

    # Empty background bar
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (55, 65, 81), -1)

    # Occupied segment
    fill_w = int(bar_w * (occupied_pct / 100.0))
    if fill_w > 0:
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), status_color, -1)

    # Outer border
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (255, 255, 255), 1)

    # Hotkey hint
    cv2.putText(frame, "Hotkeys: [+] Increase Cap | [-] Decrease Cap | [T] Inject Attendee | [Q] Quit",
                (16, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (156, 163, 175), 1, cv2.LINE_AA)

    return frame

def run_vision_loop():
    args = parse_args()
    capacity = args.capacity
    hall_id = args.hall
    api_url = args.api
    camera_idx = args.camera

    print("=================================================================")
    print("⚡ DELTA ENGINE — CCTV ROOM OCCUPANCY PERCEPTION")
    print(f"📹 Hardware Device: Zebronics ZEB-CRYSTAL PRO (Index: {camera_idx})")
    print(f"🎯 Target Venue: {DEFAULT_HALL_NAME} ({hall_id}) | Capacity: {capacity} pax")
    print(f"📡 API Endpoint: {api_url}")
    print("=================================================================\n")

    hog = init_detector()

    # Try opening webcam
    cap = None
    use_synthetic = args.demo

    if not use_synthetic:
        cap = cv2.VideoCapture(camera_idx, cv2.CAP_DSHOW if sys.platform == 'win32' else cv2.CAP_ANY)
        if not cap.isOpened():
            print(f"⚠️ Could not access camera index {camera_idx}. Trying index 1...")
            cap = cv2.VideoCapture(1)
        
        if not cap.isOpened():
            print("⚠️ No physical camera found on index 0 or 1. Starting in High-Fidelity Synthetic Simulation Mode...")
            use_synthetic = True
        else:
            # Set Zebronics 480p resolution (640x480)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            print("✅ Zebronics ZEB-CRYSTAL PRO 480p stream initialized at 640x480!")

    last_post_time = 0
    POST_INTERVAL_SEC = 1.0  # Stream telemetry to server every 1s
    simulated_attendees = 0
    last_status = None

    window_name = "DELTA ENGINE - CCTV Room Perception (Zebronics Crystal Pro 480p)"
    cv2.namedWindow(window_name, cv2.WINDOW_AUTOSIZE)

    try:
        while True:
            if not use_synthetic and cap and cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.05)
                    continue
                # Ensure 640x480
                frame = cv2.resize(frame, (640, 480))
            else:
                # Generate realistic simulation backdrop
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                frame[:] = (32, 28, 25) # Dark room
                # Grid room rows
                for row_y in range(120, 360, 50):
                    cv2.line(frame, (40, row_y), (600, row_y), (50, 45, 40), 2)
                    for col_x in range(60, 600, 60):
                        cv2.rectangle(frame, (col_x - 15, row_y - 20), (col_x + 15, row_y + 10), (70, 60, 50), 1)

            # Multi-cue Person Detection (Face + Upper Body + HOG)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            detected_boxes = []

            # 1. Frontal & Profile Face Detection
            faces = hog['face'].detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(36, 36))
            for (fx, fy, fw, fh) in faces:
                detected_boxes.append((fx, fy, fw, fh, "FACE"))

            # 2. Upper Body Detection (for seated attendees)
            uppers = hog['upper'].detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(60, 60))
            for (ux, uy, uw, uh) in uppers:
                # Deduplicate if overlapping with face
                overlap = False
                for (bx, by, bw, bh, _) in detected_boxes:
                    if abs((ux + uw//2) - (bx + bw//2)) < max(uw, bw) * 0.6 and abs((uy + uh//2) - (by + bh//2)) < max(uh, bh) * 0.6:
                        overlap = True
                        break
                if not overlap:
                    detected_boxes.append((ux, uy, uw, uh, "ATTENDEE"))

            # 3. HOG Pedestrian Detector
            rects, _ = hog['hog'].detectMultiScale(gray, winStride=(8, 8), padding=(8, 8), scale=1.05)
            for (hx, hy, hw, hh) in rects:
                overlap = False
                for (bx, by, bw, bh, _) in detected_boxes:
                    if abs((hx + hw//2) - (bx + bw//2)) < max(hw, bw) * 0.6 and abs((hy + hh//2) - (by + bh//2)) < max(hh, bh) * 0.6:
                        overlap = True
                        break
                if not overlap:
                    detected_boxes.append((hx, hy, hw, hh, "PERSON"))

            total_people = len(detected_boxes) + simulated_attendees

            # Calculate metrics
            occupied_pct = min(100, int((total_people / capacity) * 100)) if capacity > 0 else 0
            empty_pct = max(0, 100 - occupied_pct)

            if occupied_pct >= 95:
                status = "ROOM_FULL"
                box_color = (68, 68, 239)
            elif occupied_pct >= 80:
                status = "NEAR_CAPACITY"
                box_color = (11, 158, 245)
            elif occupied_pct <= 10:
                status = "EMPTY"
                box_color = (200, 200, 200)
            else:
                status = "OPTIMAL"
                box_color = (129, 185, 16)

            # Draw bounding boxes
            for (x, y, w, h, label) in detected_boxes:
                cv2.rectangle(frame, (x, y), (x + w, y + h), box_color, 2)
                cv2.putText(frame, f"{label} #{detected_boxes.index((x,y,w,h,label))+1}", (x, y - 6),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, box_color, 1, cv2.LINE_AA)

            # Render simulated attendee avatars if any
            if simulated_attendees > 0:
                for i in range(simulated_attendees):
                    sx = 80 + (i % 8) * 65
                    sy = 140 + (i // 8) * 60
                    cv2.circle(frame, (sx, sy), 18, box_color, -1)
                    cv2.circle(frame, (sx, sy + 30), 24, box_color, -1)
                    cv2.putText(frame, f"P#{i+1}", (sx - 12, sy + 5), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 0), 1)

            # Draw HUD
            frame = draw_hud(frame, total_people, capacity, occupied_pct, empty_pct, status, "Zebronics Crystal Pro")

            # Display frame
            cv2.imshow(window_name, frame)

            # Telemetry dispatch to DELTA Engine Server
            now = time.time()
            if now - last_post_time >= POST_INTERVAL_SEC or status != last_status:
                last_post_time = now
                last_status = status
                payload = {
                    "hallId": hall_id,
                    "peopleDetected": total_people,
                    "capacity": capacity,
                    "occupiedPercent": occupied_pct,
                    "emptyPercent": empty_pct,
                    "status": status,
                    "source": "Zebronics ZEB-CRYSTAL PRO 480p CCTV"
                }
                try:
                    res = requests.post(api_url, json=payload, timeout=0.8)
                    if res.status_code == 200:
                        icon = "🔴" if status == "ROOM_FULL" else "⚪" if status == "EMPTY" else "🟢"
                        print(f"{icon} [CCTV POST] Occupied: {occupied_pct}% | Empty: {empty_pct}% | Count: {total_people}/{capacity} | Status: {status}")
                except Exception as e:
                    # Non-blocking if server temporarily offline
                    pass

            # Key handling
            key = cv2.waitKey(15) & 0xFF
            if key == ord('q') or key == 27: # 'q' or ESC
                print("\nShutting down CCTV Perception Agent...")
                break
            elif key == ord('+') or key == ord('='):
                capacity += 5
                print(f"🔼 Room Capacity increased to: {capacity}")
            elif key == ord('-') or key == ord('_'):
                if capacity > 5:
                    capacity -= 5
                    print(f"🔽 Room Capacity decreased to: {capacity}")
            elif key == ord('t') or key == ord('T'):
                simulated_attendees += 1
                print(f"👤 Added attendee: Total count = {total_people + 1}")
            elif key == ord('c') or key == ord('C'):
                simulated_attendees = 0
                print("🧹 Cleared simulated attendees.")

    finally:
        if cap and cap.isOpened():
            cap.release()
        cv2.destroyAllWindows()
        print("CCTV agent exited cleanly.")

if __name__ == "__main__":
    run_vision_loop()
