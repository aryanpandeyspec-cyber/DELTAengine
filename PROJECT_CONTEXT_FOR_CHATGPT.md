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
2. It tracks room capacities in an **in-memory spatial topological graph database**.
3. When a hall experiences an overcrowding breach (>100% capacity) or an unexpected speaker delay, a **multi-agent Groq LLaMA-3 AI Swarm autonomously self-heals the schedule** — swapping halls, recalculating room allocations, updating attendee calendars, and dispatching instant WhatsApp and Email alerts to volunteers and speakers without human panic.
4. An **autonomous voice announcer** (modeled after *Nico Robin* from One Piece) synthesizes serene, intellectual PA voice broadcasts over venue speakers to maintain composure during crowd redistributions.
5. **2-Way Volunteer WhatsApp Webhook** allows field coordinators to text commands (`GATE CLEAR`, `OVERFLOW OPEN`, `AUTOPILOT ON/OFF`) straight from WhatsApp to orchestrate venue operations.

---

## ⚠️ 2. CORE PROBLEMS SOLVED

1. **Unannounced Crowd Crushes & Safety Breaches**:
   - In venues across India and globally, popular keynote sessions routinely exceed fire code capacity (e.g. 240+ people packing into a 150-seat room).
   - Organizers only notice when doors get blocked, leading to stampede risks and fire marshal shutdowns.
2. **Cascading Event Schedule Delays**:
   - When a speaker is late or a room overflows, organizers scramble on walkie-talkies or WhatsApp groups. Rescheduling one talk manually takes 20–40 minutes and creates cascading room conflicts.
3. **Bandwidth & Privacy Bottlenecks of Traditional Video Systems**:
   - Traditional crowd systems stream high-res RTSP video feeds to cloud GPUs. This requires massive local Wi-Fi bandwidth, incurs exorbitant GPU cloud bills, and violates attendee facial privacy (GDPR / Indian DPDP Act).
   - DELTA Engine runs computer vision 100% locally in the browser via WebAssembly (`pico.js`), transmitting only lightweight numerical telemetry.
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
│ ESP32 Microcontroller (Dual I2C)    │ Eulerian Flow & Stampede Risk HUD    │
│ 50-byte JSON telemetry @ 115200 baud │ Zero video upload; 100% local frames │
└──────────────────────────────────┬───┴──────────────────────────────────────┘
                                   │ HTTP POST / WebSockets
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 2: REAL-TIME EVENT FABRIC & SPATIAL GRAPH ENGINE (Node.js / Express)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ • In-Memory Spatial Dependency Graph (graphDb.js)                           │
│ • Real-Time WebSocket Pub/Sub Server with requestAnimationFrame Debounce    │
│ • Kinetic-Sleeping Force-Directed Graph Visualizer (0% idle CPU)            │
│ • Nico Robin Autonomous PA Voice Announcer (ElevenLabs Flash v2.5 / Cache)  │
│ • Google Gemini 3.8 Flash Crowd Reasoning & Safety Auditor                  │
│ • 2-Way Volunteer WhatsApp Webhook & Twilio Cloud Dispatcher                │
│ • Neubrutalist Portals: Coordinator, Super Admin, Signage TV, Presentation  │
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

---

## 📹 5. COMPUTER VISION & CROWD DYNAMICS ENGINE

Located in `frontend/components/cctvPerception.js`:
1. **Edge Facial & Crowd Tracking**: Powered by WebAssembly `pico.js` and `facefinder.js` for on-device processing.
2. **Eulerian Optical Flow & Crowd Vectors**: Divides video into a 16x12 grid to measure crowd directional velocity, identifying corridor bottlenecks and opposing flow collision hazards.
3. **Stampede & Crush Risk Index ($0–100\%$)**: Mathematical risk model evaluating density, turbulence, mean speed, and chokepoints.
4. **Barricade Pressure PSI**: Simulated physical pressure metric. If pressure $\ge 8.5\text{ PSI}$, fires automated gate release pulse to `/api/sensors/door` disengaging mag-locks on Gates A & B.
5. **Decoupled Zero-Lag Pipeline**: Video canvas renders at a silky 60 FPS, while heavy vision analysis (`getImageData()`, cascades, vector math) runs on a 75ms throttled tick with cached bounding boxes.

---

## 🎙️ 6. VOICE ANNOUNCER & GEMINI 3.8 FLASH AUDITOR

### Voice Announcer (`backend/components/voiceAnnouncer.js`)
- Persona: **Nico Robin** from One Piece (calm, intellectual, composed female voice).
- Powered by **ElevenLabs Flash v2.5** (`voice_id: EXAVITQu4vr4xnSDxMaL` - Sarah).
- MD5 caching serves repetitive announcements in $<1\text{ms}$.
- Multi-tier fallbacks: Local audio file (`announcement_test.mp3`) $\rightarrow$ Browser Web Speech API.

### Google Gemini 3.8 Flash Auditor (`backend/components/geminiAuditor.js`)
- Models: `gemini-3.8-flash`, `gemini-3.5-flash`.
- Evaluates real-time hall telemetry and returns structured safety ratings (`A+`, `A`, `B`, `C`, `CRITICAL`), risk levels, executive summaries, operational recommendations, and auto-generated PA announcement scripts.
- Visual Scene Auditing: Inspects base64 camera frames for visual verification of hall congestion.

---

## ⚡ 7. PERFORMANCE ENGINEERING & ZERO-LAG ARCHITECTURE

Implemented in October 2026 to ensure the interface never drops frames or stutters:
1. **Graph Physics Simulation Auto-Sleep**: In `graphVisualizer.js`, kinetic energy is monitored (`totalMotion < 0.12`). As soon as nodes settle into place, the 60 FPS simulation loop **completely sleeps** (0% CPU). Wakes only on node drag or graph updates.
2. **Persistent SVG Element In-Place Caching**: Replaced destructive `svg.innerHTML = ''` with persistent element maps (`domLinkMap`, `domNodeMap`). Nodes and lines update in-place, eliminating ~4,800 DOM allocations per second and preventing V8 Garbage Collector 100–300ms freeze spikes.
3. **Decoupled Vision Throttling**: 60 FPS video draw separated from 75ms throttled computer vision calculations.
4. **WebSocket Render Debouncing**: Wrapped `safeSyncUI()` in `requestAnimationFrame` debouncing to coalesce multi-message sensor bursts into a single render tick.
5. **Custom Cursor Comet Tail Sleep**: In `customCursor.js`, the particle canvas loop automatically puts itself to sleep when the mouse stops moving.
6. **Precision Cursor Hotspot**: Click hotspot anchored at top-left apex (`top: -2px; left: -2px`) with suppression of native double-finger pointers on cards.

---

## 📂 8. REPOSITORY FILE STRUCTURE

```
DELTAengine-main/
├── backend/
│   ├── components/
│   │   ├── agentSwarm.js                  # Groq LLaMA-3 multi-agent self-healing swarm
│   │   ├── selfHealing.js                  # Deterministic conflict solver & swarm orchestrator
│   │   ├── graphDb.js                     # In-memory spatial dependency graph & schedule matrix
│   │   ├── voiceAnnouncer.js              # Nico Robin PA voice announcer (ElevenLabs + Web Speech)
│   │   ├── geminiAuditor.js               # Google Gemini 3.8 Flash crowd reasoning auditor
│   │   ├── twilioDispatcher.js            # Twilio WhatsApp & SMS dispatcher
│   │   ├── security.js                    # Rate limiter, CORS, and sanitization middleware
│   │   ├── supabaseDb.js                  # Supabase database integration
│   │   └── supabaseEmailIntegrator.js     # Transactional anti-spam coordinator email dispatcher
│   ├── package.json                       # Backend dependencies
│   └── server.js                          # Express app, WebSocket server, sensor ingest endpoints
├── frontend/
│   ├── components/
│   │   ├── app.js                         # Core UI event orchestrator
│   │   ├── auth.js                        # Client-side session and role management
│   │   ├── cctvPerception.js              # Edge computer vision, camera switching & HUD (decoupled)
│   │   ├── customCursor.js                # Electric Blue hardware-locked cursor & comet tail canvas
│   │   ├── graphVisualizer.js             # Kinetic-sleeping force-directed SVG graph visualizer
│   │   ├── dragdrop.js                    # HTML5 schedule drag-and-drop controller
│   │   ├── websockets.js                  # Real-time WebSocket pub/sub client with debounce
│   │   ├── contentPipeline.js             # Presentation slide upload & metadata parser
│   │   ├── stressTester.js                # 500-scenario micro-benchmark concurrency runner
│   │   ├── tourGuide.js                   # Interactive docked sidebar walkthrough
│   │   ├── pico.js                        # WebAssembly frontal face detection cascade
│   │   └── facefinder.js                  # Face cascade runtime weights
│   ├── app.css                            # Neomorphic / Neubrutalist design system stylesheet
│   ├── admin.html                         # Super Admin Command Center
│   ├── index.html                         # Coordinator live schedule & crowd intelligence portal
│   ├── login.html                         # Authentication switchboard with 1-click bypass
│   ├── signage.html                       # Fullscreen digital signage TV kiosk portal
│   ├── presentation.html                  # Slide presentation viewer
│   ├── announcement_test.mp3              # Local fallback audio for PA announcements
│   └── audio_announcements/               # Cached Nico Robin voice MP3 files
├── hardware/
│   ├── DELTA_Door_Counter/
│   │   └── DELTA_Door_Counter.ino         # ESP32 dual I2C firmware (VL53L0X ToF lasers)
│   ├── drivers/                           # Silicon Labs CP210x USB-UART drivers
│   ├── door_serial_bridge.py              # Python USB Serial COM -> REST bridge
│   └── cctv_occupancy_vision.py           # Python OpenCV camera detection script
├── PROJECT_CONTEXT.md                     # Comprehensive technical architecture dossier
├── PROJECT_CONTEXT_FOR_CHATGPT.md         # THIS FILE (Comprehensive prompt context)
├── PROJECT_CHANGELOG.md                   # Exhaustive ledger of all additions, updates & removals
├── README.md                              # Primary GitHub repository overview
└── package.json                           # Root scripts and workspace config
```

---

## 🚀 9. QUICKSTART & VERIFICATION RUNBOOK

### Start the Engine
```powershell
npm start
# Server boots at: http://localhost:3000
```

### Access Portals
- **Coordinator Dashboard & CCTV HUD**: `http://localhost:3000/index.html`
- **Super Admin Command Center**: `http://localhost:3000/admin.html`
- **Digital Signage TV Kiosk**: `http://localhost:3000/signage.html`
- **Presentation Deck**: `http://localhost:3000/presentation.html`

### Simulate a Room Overflow Breach (Triggering AI Swarm)
Run this curl command in any terminal to simulate 152 people entering Turing Hall (capacity 150):
```powershell
curl -X POST http://localhost:3000/api/sensors/door `
  -H "Content-Type: application/json" `
  -d '{"event":"ENTRY","hallId":"hall-1","netOccupancy":152,"entries":155,"exits":3}'
```
**Result**:
- Warning siren and Nico Robin voice announcement trigger.
- Groq Swarm executes reallocation in $<2.5$ seconds.
- Turing Hall talk moves to Lovelace Suite on the live timetable.
- WhatsApp & Email logs dispatch to Aryan, Suryansh, and Shahid.
- Graph visualizer updates and enters kinetic sleep.
