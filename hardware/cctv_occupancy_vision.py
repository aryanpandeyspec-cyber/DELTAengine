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
    """Initializes multi-scale Haar Cascade face detectors tuned strictly for head area."""
    frontal = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    alt = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
    profile = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
    return {
        'frontal': frontal,
        'alt': alt,
        'profile': profile
    }

def compute_iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
    yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])
    inter = max(0, xB - xA) * max(0, yB - yA)
    union = (boxA[2] * boxA[3]) + (boxB[2] * boxB[3]) - inter
    return inter / float(union) if union > 0 else 0.0

def nms_boxes(boxes, scores, iou_thresh=0.30):
    if not boxes:
        return []
    idxs = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    keep = []
    while idxs:
        current = idxs.pop(0)
        keep.append(current)
        idxs = [i for i in idxs if compute_iou(boxes[current], boxes[i]) < iou_thresh]
    return [boxes[i] for i in keep]

def detect_heads(gray, detectors):
    """Detects heads across room with multi-scale frontal and profile cascades, strictly head area only."""
    raw_boxes = []
    scores = []

    # 1. Frontal face default (sensitive, finds distant heads down to 20x20)
    f1 = detectors['frontal'].detectMultiScale(
        gray, scaleFactor=1.06, minNeighbors=3, minSize=(20, 20), maxSize=(240, 240)
    )
    for (x, y, w, h) in f1:
        raw_boxes.append((int(x), int(y), int(w), int(h)))
        scores.append(1.0)

    # 2. Frontal face alt2 (high precision, confirms frontal attendees)
    if not detectors['alt'].empty():
        f2 = detectors['alt'].detectMultiScale(
            gray, scaleFactor=1.06, minNeighbors=3, minSize=(20, 20), maxSize=(240, 240)
        )
        for (x, y, w, h) in f2:
            raw_boxes.append((int(x), int(y), int(w), int(h)))
            scores.append(1.2)

    # 3. Profile face (for attendees turned towards screens or neighbors)
    if not detectors['profile'].empty():
        f3 = detectors['profile'].detectMultiScale(
            gray, scaleFactor=1.08, minNeighbors=3, minSize=(22, 22), maxSize=(240, 240)
        )
        for (x, y, w, h) in f3:
            raw_boxes.append((int(x), int(y), int(w), int(h)))
            scores.append(0.9)

    if not raw_boxes:
        return []

    # Apply NMS
    filtered = nms_boxes(raw_boxes, scores, iou_thresh=0.30)

    # Clamp strictly to head/face area: height = 1.20 * width, centered
    final_heads = []
    for (x, y, w, h) in filtered:
        head_w = w
        head_h = int(w * 1.20)
        head_x = max(0, x)
        head_y = max(0, y - int(head_h * 0.08))
        final_heads.append((head_x, head_y, head_w, head_h))

    return final_heads

class HeadCentroidTracker:
    def __init__(self, max_lost=4):
        self.tracks = {} # track_id -> {'box': [x,y,w,h], 'lost': 0, 'seen': 1}
        self.next_id = 1
        self.max_lost = max_lost

    def update(self, detected_boxes):
        updated = {}
        unmatched = list(range(len(detected_boxes)))

        for tid, track in list(self.tracks.items()):
            tx, ty, tw, th = track['box']
            tcx, tcy = tx + tw / 2.0, ty + th / 2.0
            best_dist = 60.0
            best_idx = -1

            for idx in unmatched:
                bx, by, bw, bh = detected_boxes[idx]
                bcx, bcy = bx + bw / 2.0, by + bh / 2.0
                dist = np.hypot(tcx - bcx, tcy - bcy)
                if dist < best_dist:
                    best_dist = dist
                    best_idx = idx

            if best_idx != -1:
                unmatched.remove(best_idx)
                bx, by, bw, bh = detected_boxes[best_idx]
                # Exponential smoothing
                nx = int(tx * 0.70 + bx * 0.30)
                ny = int(ty * 0.70 + by * 0.30)
                nw = int(tw * 0.70 + bw * 0.30)
                nh = int(th * 0.70 + bh * 0.30)
                updated[tid] = {'box': (nx, ny, nw, nh), 'lost': 0, 'seen': track['seen'] + 1}
            else:
                track['lost'] += 1
                if track['lost'] <= self.max_lost:
                    updated[tid] = track

        for idx in unmatched:
            updated[self.next_id] = {'box': detected_boxes[idx], 'lost': 0, 'seen': 1}
            self.next_id += 1

        self.tracks = updated
        return [t['box'] for t in self.tracks.values() if t['seen'] >= 2 or (t['seen'] >= 1 and t['lost'] == 0)]

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

    detectors = init_detector()
    tracker = HeadCentroidTracker()

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

            # Multi-scale Head Detection (strictly head/face area only)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            raw_heads = detect_heads(gray, detectors)
            tracked_boxes = tracker.update(raw_heads)

            total_people = len(tracked_boxes) + simulated_attendees

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

            # Draw bounding boxes (strictly head/face area only)
            for idx, (x, y, w, h) in enumerate(tracked_boxes):
                cv2.rectangle(frame, (x, y), (x + w, y + h), box_color, 2)
                # Corner reticles
                c_len = min(12, int(w * 0.25))
                cv2.line(frame, (x, y), (x + c_len, y), box_color, 3)
                cv2.line(frame, (x, y), (x, y + c_len), box_color, 3)
                cv2.line(frame, (x + w, y), (x + w - c_len, y), box_color, 3)
                cv2.line(frame, (x + w, y), (x + w, y + c_len), box_color, 3)
                cv2.line(frame, (x, y + h), (x + c_len, y + h), box_color, 3)
                cv2.line(frame, (x, y + h), (x, y + h - c_len), box_color, 3)
                cv2.line(frame, (x + w, y + h), (x + w - c_len, y + h), box_color, 3)
                cv2.line(frame, (x + w, y + h), (x + w, y + h - c_len), box_color, 3)

                cv2.putText(frame, f"HEAD #{idx+1} [INSIDE]", (x, max(14, y - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, box_color, 1, cv2.LINE_AA)

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
                tracker = HeadCentroidTracker()
                print("🧹 Cleared simulated attendees & head tracks.")

    finally:
        if cap and cap.isOpened():
            cap.release()
        cv2.destroyAllWindows()
        print("CCTV agent exited cleanly.")

if __name__ == "__main__":
    run_vision_loop()
