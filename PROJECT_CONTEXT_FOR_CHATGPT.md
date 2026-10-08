# ⚡ DELTA ENGINE — MASTER PROJECT CONTEXT FILE FOR CHATGPT & LLMs

> **INSTRUCTION FOR CHATGPT / LLM**:
> You are the Lead Architect and Co-Founder of **DELTA Engine**. This document contains the complete, unabridged technical, architectural, operational, and commercial context of the DELTA Engine project. Use this context to answer technical questions, write code extensions, debug hardware/firmware/software, pitch to investors, or generate documentation accurately without hallucination.

---

## 📌 1. EXECUTIVE SUMMARY & IDENTITY

- **Project Name**: DELTA Engine (Autonomous Self-Healing Spatial & Event Operating System)
- **Genesis**: Conceived and built for *HackIndia Spark 2026 (South Central Region, Hyderabad)* and expanding into a commercial MICE (Meetings, Incentives, Conferences & Exhibitions) crowd-safety platform.
- **Repository**: `https://github.com/aryanpandeyspec-cyber/DELTAengine`
- **Core Team & Contacts**:
  - **Aryan Pandey**: Lead Event Coordinator & Systems Commander (`aryan.pandey777hyd@gmail.com` | `+91 91542 76178`)
  - **Suryansh**: Crowd Safety & Entrance Door Specialist (`suryansh@delta-engine.in` | `+91 83030 09159`)
  - **Shahid**: Stage & Hall Operations Coordinator (`shahid@delta-engine.in` | `+91 63035 70916`)

### What is DELTA Engine?
DELTA Engine is an **autonomous, physical-first operating system for live venues** (convention halls, arenas, college fests, trade expos, and auditoriums). 
Think of it as **"Kubernetes for physical event venues"**:
1. It ingests physical headcount telemetry from **$10 ESP32 Time-of-Flight laser doorway sensors** and **in-browser edge computer vision**.
2. It tracks room capacities in an **in-memory spatial graph database**.
3. When a hall experiences an overcrowding breach (>100% capacity) or an unexpected speaker delay, a **multi-agent Groq LLaMA-3 AI Swarm autonomously self-heals the schedule** — swapping halls, recalculating room allocations, updating attendee calendars, and dispatching instant WhatsApp and Email alerts to volunteers and speakers without human panic.

---

## ⚠️ 2. CORE PROBLEMS SOLVED

1. **Unannounced Crowd Crushes & Safety Breaches**:
   - In venues across India and globally, popular keynote sessions routinely exceed fire code capacity (e.g. 280 people packing into a 150-seat room).
   - Organizers only notice when doors get blocked, leading to stampede risks and fire marshal shutdowns.
2. **Cascading Event Schedule Delays**:
   - When a speaker is late or a room overflows, organizers scramble on walkie-talkies or WhatsApp groups. Rescheduling one talk manually takes 20–40 minutes and creates cascading room conflicts.
3. **Bandwidth & Privacy Bottlenecks of Traditional Video Systems**:
   - Traditional crowd systems stream high-res RTSP video feeds to cloud GPUs. This requires massive local Wi-Fi bandwidth, incurs exorbitant GPU cloud bills, and violates attendee facial privacy (GDPR / Indian DPDP Act).
4. **Communication Friction**:
   - In live events, attendees and stage coordinators do not read emails in real time. Static schedules printed on banners or hosted as static PDFs become obsolete the moment a delay occurs.

---

## 🏛️ 3. HIGH-LEVEL ARCHITECTURAL TOPOLOGY

DELTA Engine operates on a **3-tier decoupled intelligence fabric**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: ULTRA-LOW LATENCY EDGE SENSING (<10ms, $0 Cloud Cost, 100% Private) │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Dual Laser Time-of-Flight (VL53L0X)  │ In-Browser Edge Vision (pico.js)    │
│ ESP32 Microcontroller (Dual I2C)    │ WebAssembly Frontal Face Cascade     │
│ 50-byte JSON telemetry @ 115200 baud │ Zero video upload; 100% local frames │
└──────────────────────────────────┬───┴──────────────────────────────────────┘
                                   │ HTTP POST / WebSockets
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 2: REAL-TIME EVENT FABRIC & SPATIAL GRAPH ENGINE (Node.js / Express)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ • In-Memory Spatial Dependency Graph (graphDb.js)                           │
│ • Real-Time WebSocket Pub/Sub Server (ws)                                   │
│ • Live Dynamic Ticking Clock & Dynamic Slot Highlighter                     │
│ • Neubrutalist Public & Admin Portals (index.html / admin.html)             │
│ • Anti-Spam Coordinator & Speaker Email Dispatcher (Node/Supabase)          │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ Anomaly Trigger (Occupancy > 100%)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 3: AUTONOMOUS AGENTIC SWARM (Groq Cloud LLaMA-3.3-70B / 3.1-8B)        │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Liaison Agent: Parses physical sensor telemetry & evaluates breach state  │
│ • Scheduler Agent: Recalculates graph nodes, detects conflicts, swaps halls │
│ • Logistics Agent: Routes volunteers & dispatches targeted tasks via WA/Mail│
│ • Marketing Agent: Broadcasts live schedule rewrite to attendee feeds/iCal  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔌 4. HARDWARE & IOT SUBSYSTEM

### Hardware Components
1. **ESP32 NodeMCU-32S / ESP32-WROOM-32D** (Dual-core Tensilica Xtensa 240MHz, Wi-Fi, BLE).
2. **2x VL53L0X Time-of-Flight (ToF) Laser Distance Sensors** (STMicroelectronics):
   - Laser: 940nm VCSEL (invisible, eye-safe).
   - Range: 30mm – 1200mm.
   - Operating principle: Measures photon travel time (speed of light), immune to ambient lighting or clothing color.

### Dual Hardware I2C Architecture
Both VL53L0X breakout boards ship with the **same fixed default I2C address (`0x29`)**. To read two sensors simultaneously without extra I2C multiplexer chips:
- The ESP32's **two independent hardware I2C peripherals** are utilized:
  - **Sensor 1 (Entry)**: Attached to `Wire` on **SDA = GPIO 21, SCL = GPIO 22**.
  - **Sensor 2 (Exit)**: Attached to `Wire1` on **SDA = GPIO 16 (RX2), SCL = GPIO 17 (TX2)**.
- *Single-Sensor Fallback Mode*: If Sensor 1 is disconnected or absent, the firmware automatically falls back to single-sensor pulse counting on Sensor 2.

### Directional State Machine
- When a person enters: Sensor 1 triggers first ($<150\text{mm}$), followed by Sensor 2 $\rightarrow$ Emits `ENTRY` (`netOccupancy + 1`).
- When a person exits: Sensor 2 triggers first ($<150\text{mm}$), followed by Sensor 1 $\rightarrow$ Emits `EXIT` (`netOccupancy - 1`).
- Laser Radar noise filter ignores objects closer than 35mm (eliminates self-reflection from door frames).

### Hardware Wiring Matrix
| Sensor Board Pin | Sensor 1 (Entry) ESP32 Pin | Sensor 2 (Exit) ESP32 Pin |
| :--- | :--- | :--- |
| **VCC** | 3.3V (or 5V if board has LDO) | 3.3V (or 5V) |
| **GND** | GND (Common ground) | GND (Common ground) |
| **SDA** | **GPIO 21** | **GPIO 16 (RX2)** |
| **SCL** | **GPIO 22** | **GPIO 17 (TX2)** |

### Firmware Source File
- Location: `hardware/DELTA_Door_Counter/DELTA_Door_Counter.ino`
- Serial Baud Rate: `115200`
- Flashing Speed: `921600` via Arduino IDE on port `COM7`.

---

## 📹 5. EDGE CCTV & COMPUTER VISION SUBSYSTEM

- **Frontend Component**: `frontend/components/cctvPerception.js`
- **Vision Engine**: **pico.js** (Ultra-fast face detection cascade running via client-side JavaScript / WebAssembly).
- **Zero Cloud Streaming**: 
  - Video from the webcam or room camera is ingested via `navigator.mediaDevices.getUserMedia()`.
  - Frames are drawn to an off-screen HTML5 `<canvas>`.
  - Grayscale pixel transforms and frontal cascade evaluations occur **locally at 30 FPS**.
  - No video stream ever leaves the browser! Only the computed integer head count (`peopleDetected`) is transmitted over `/api/sensors/camera`.
- **Queue & Density Analytics**:
  - Calculates real-time room occupancy percentage against configured hall capacity.
  - Classifies density status:
    - `< 60%`: `NORMAL` (Green)
    - `60% - 79%`: `MODERATE` (Blue)
    - `80% - 94%`: `HIGH DENSITY` (Orange - triggers warning)
    - `≥ 95%`: `CRITICAL OVERCROWDING` (Red - triggers emergency self-healing)
- **Camera Device Switching**: Full dynamic enumeration of connected USB/webcam inputs with instant hot-swapping.
- **On-Screen Security HUD**: Renders real-time bounding boxes around detected heads, live FPS, active timecode, and density gauges.

---

## 🧠 6. AUTONOMOUS AGENTIC SWARM & SELF-HEALING ENGINE

- **Backend Component**: `backend/components/engine.js`
- **LLM Provider**: **Groq Cloud** (Ultra-fast LPU inference: ~500 tokens/sec).
- **Models Used**:
  - `llama-3.3-70b-versatile` (Deep spatial reasoning, conflict resolution, schedule graph recalculation)
  - `llama-3.1-8b-instant` (Fast telemetry parsing, broadcast message drafting, coordinator task assignment)

### The Swarm Trigger & Execution Flow
1. Anomaly Event occurs: Room headcount hits $\ge 100\%$ capacity (e.g. Turing Hall holds 150, current count reaches 152).
2. `server.js` triggers `runSelfHealingAgent(eventDetails)`.
3. **Liaison Agent**: Confirms breach severity, current occupancy, and affected topic.
4. **Scheduler Agent**: Queries the spatial graph in `graphDb.js`, identifies larger available halls (e.g., *Lovelace Suite*, capacity 250), verifies AV/tech constraints, and swaps the scheduled slot.
5. **Logistics Agent**: Assigns action items to the nearest on-duty coordinators:
   - *Suryansh*: Secure entrance & restrict further entry into Turing Hall.
   - *Shahid*: Guide overflow attendees along Corridor B to Lovelace Suite.
   - *Aryan Pandey*: Verify central AV broadcast and monitor stage transitions.
6. **Marketing/Broadcaster Agent**: Automatically constructs the public reschedule alert and broadcasts it to the attendee timetable, admin HUD, and WhatsApp channels.

---

## 💬 7. MULTI-CHANNEL DISPATCH & NOTIFICATIONS

### WhatsApp Coordination Directory
- Built into both `frontend/index.html` and `frontend/admin.html`.
- Allows 1-click individual dispatch or a universal **"SEND TO ALL COORDINATORS"** broadcast.
- Auto-compiles an emergency/logistics brief containing:
  - Incident type & affected venue
  - Real-time headcount vs capacity
  - Swapped hall destination
  - Custom assigned role instructions
- Direct WhatsApp API link generation: `https://wa.me/<phone>?text=<encoded_message>`.

### Anti-Spam Email Logistics System
- Backend file: `backend/components/supabaseEmailIntegrator.js`.
- Sender Identity: `aryan.pandey777hyd@gmail.com`.
- Formatted as clean, high-deliverability transactional logistics updates (anti-spam headers, plain text + clean CSS container, no spam trigger keywords) sent to speakers and lead coordinators.

### Live Dynamic Neubrutalist Clock & Slot Sync
- Top navigation features a real-time ticking clock pill (`#live-clock-pill`): `Day, DD Mon YYYY • HH:MM:SS AM/PM`.
- `graphDb.js` dynamically anchors schedules to today's date (`new Date().toISOString().split('T')[0]`).
- The schedule timetable automatically detects the current time and stamps the active time slot with an animated **`🔴 LIVE`** pulse indicator.

---

## 🎨 8. DESIGN SYSTEM & USER INTERFACE

- **Aesthetic**: **Neubrutalism** (High contrast, bold 2px–3px black borders `#000`, hard black drop-shadows `4px 4px 0px #000`, vibrant accent colors: Cyber Yellow `#fbbf24`, Signal Red `#ef4444`, Neon Green `#22c55e`, Royal Blue `#2563eb`).
- **Pages**:
  - `frontend/index.html`: Public attendee schedule, live capacity gauge, dynamic timetable, CCTV HUD, and coordinator contact drawer.
  - `frontend/admin.html`: Super Admin Command Portal with real-time hardware telemetry charts, manual override controls, AI self-healing simulation trigger, volunteer deployment panel, and WhatsApp broadcast center.
  - `frontend/login.html`: Role-based authentication portal (Admin vs Attendee vs Coordinator).
  - `frontend/presentation.html`: Hackathon & investor pitch deck slide viewer.
- **Audio Feedback**: Built-in synthesized sound effects (Web Audio API) for button clicks, alert sirens, and resolution chimes (toggleable via `🔊 SFX: ON/OFF`).

---

## 📈 9. SCALABILITY & ECONOMIC VIABILITY

### Technical Scalability
- **Decoupled Edge Compute**: ESP32 sensors emit ~50-byte event packets. 1,000 doors across a mega-convention center consume **$<100\text{ KB/sec}$** aggregate network bandwidth.
- **Event-Driven AI Ingestion**: Normal occupancy runs at **$0.00 cloud cost**. Groq LLM inference only fires during anomaly breaches, keeping operational costs negligible.
- **Privacy & Compliance**: 100% GDPR and Indian DPDP Act compliant because video frames are processed client-side and never saved or streamed to the cloud.

### Commercial Monetization (Tailored for India & Global Markets)
1. **B2B Event SaaS (Per-Event)**:
   - College Tech Fests & Hackathons (4,000+ colleges in India): **₹15,000 – ₹35,000** per event.
   - B2B Trade Shows & Summits (HITEX, Jio World, Bharat Mandapam, Yashobhoomi): **₹1.5 Lakh – ₹5 Lakh** per 3-day expo.
2. **Hardware-as-a-Service (HaaS) Rental Kits**:
   - Turnkey "DELTA Box" with 10 magnetic door sensor clips rented to event managers for **₹2,000 – ₹5,000/day**.
   - Hardware BOM is only **~₹800 ($9.50) per unit** $\rightarrow$ 85%+ gross profit margin.
3. **Sponsor Footfall & Dwell-Time Heatmaps**:
   - Verified footfall analytics reports sold to corporate booth sponsors (e.g. *"Booth B had 2,100 visitors with an avg dwell time of 7.2 mins"*) for **₹15,000 – ₹25,000** per sponsor.
4. **Permanent Venue Safety Subscriptions**:
   - Convention centers and coworking spaces (WeWork, Awfis) pay **₹25,000 – ₹50,000/month** for automated fire code compliance and HVAC energy optimization.
5. **Non-Dilutive Indian Grants**:
   - Qualifies for **NIDHI-PRAYAS** (₹10 Lakh prototype grant), **MeitY TIDE 2.0** (₹4–₹7 Lakh), and **Startup India Seed Fund Scheme (SISFS)** (up to ₹20 Lakhs grant).

---

## 📂 10. REPOSITORY FILE STRUCTURE

```
DELTAengine-main/
├── backend/
│   ├── components/
│   │   ├── engine.js                      # Groq LLaMA-3 multi-agent self-healing swarm
│   │   ├── graphDb.js                     # In-memory spatial dependency graph & schedule matrix
│   │   ├── security.js                    # Rate limiter, CORS, and sanitization middleware
│   │   ├── supabaseClient.js              # Supabase DB & auth client initialization
│   │   └── supabaseEmailIntegrator.js     # Transactional anti-spam coordinator email dispatcher
│   ├── package.json                       # Backend dependencies (express, ws, @groq/groq-sdk)
│   └── server.js                          # Express app, WebSocket server, sensor ingest endpoints
├── frontend/
│   ├── components/
│   │   ├── auth.js                        # Client-side session and role management
│   │   └── cctvPerception.js              # pico.js edge computer vision, camera switching & HUD
│   ├── css/
│   │   └── style.css                      # Neubrutalist design system stylesheet
│   ├── admin.html                         # Super Admin Command Center
│   ├── index.html                         # Public live schedule & crowd intelligence portal
│   ├── login.html                         # Authentication switchboard
│   ├── presentation.html                  # Slide presentation viewer
│   └── pico.js                            # WebAssembly frontal face detection cascade
├── hardware/
│   ├── DELTA_Door_Counter/
│   │   └── DELTA_Door_Counter.ino         # ESP32 dual I2C firmware (VL53L0X ToF lasers)
│   ├── drivers/                           # Silicon Labs CP210x USB-UART drivers
│   ├── door_serial_bridge.py              # Optional Python USB Serial COM -> REST bridge
│   └── cctv_occupancy_vision.py           # Optional Python OpenCV camera detection script
├── PROJECT_CONTEXT.md                     # Technical architecture dossier
├── PROJECT_CONTEXT_FOR_CHATGPT.md         # THIS FILE (Comprehensive prompt context)
├── README.md                              # GitHub repository overview
└── package.json                           # Root scripts and workspace config
```

---

## 🚀 11. QUICKSTART & VERIFICATION RUNBOOK

### Run Backend & Frontend Locally
```powershell
# 1. Install dependencies
npm install

# 2. Start the local server
npm run dev
# Server boots at: http://localhost:3000
```

### Access Portals
- **Public Schedule & CCTV HUD**: `http://localhost:3000/index.html`
- **Super Admin Command Center**: `http://localhost:3000/admin.html`
- **Presentation Deck**: `http://localhost:3000/presentation.html`

### Flash ESP32 Hardware
1. Connect ESP32 via USB (CP2102 driver).
2. Ensure no background script is using the COM port (`COM7`).
3. Open `hardware/DELTA_Door_Counter/DELTA_Door_Counter.ino` in Arduino IDE.
4. Select Board: `ESP32 Dev Module`, Port: `COM7`.
5. Upload at baud `921600`. Open Serial Monitor at `115200`.

### Simulate a Room Overflow Breach (Triggering AI Swarm)
Run this curl command in any terminal to simulate 152 people entering Turing Hall (capacity 150):
```powershell
curl -X POST http://localhost:3000/api/sensors/door `
  -H "Content-Type: application/json" `
  -d '{"event":"ENTRY","hallId":"hall-1","netOccupancy":152,"entries":155,"exits":3}'
```
**Result**:
- Warning siren sounds on all open dashboards.
- Groq Swarm executes reallocation in $<2.5$ seconds.
- Turing Hall talk moves to Lovelace Suite on the live timetable.
- WhatsApp & Email logs dispatch to Aryan, Suryansh, and Shahid.
