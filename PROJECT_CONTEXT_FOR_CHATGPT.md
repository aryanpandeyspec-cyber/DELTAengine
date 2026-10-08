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
2. It ingests **photos and PDFs of room plans and blueprints**, enables live review/editing, computes mathematical safe people capacity, and builds an interactive **3D Spatial Digital Twin** with 2-hour ephemeral storage.
3. It tracks room capacities in an **in-memory spatial topological graph database**.
4. When a hall experiences an overcrowding breach (>100% capacity) or an unexpected speaker delay, a **multi-agent Groq LLaMA-3 AI Swarm autonomously self-heals the schedule** — swapping halls, recalculating room allocations, updating attendee calendars, and dispatching instant WhatsApp and Email alerts to volunteers and speakers without human panic.
5. An **autonomous voice announcer** (modeled after *Nico Robin* from One Piece) synthesizes serene, intellectual PA voice broadcasts over venue speakers to maintain composure during crowd redistributions.
6. **2-Way Volunteer WhatsApp Webhook** allows field coordinators to text commands (`GATE CLEAR`, `OVERFLOW OPEN`, `AUTOPILOT ON/OFF`) straight from WhatsApp to orchestrate venue operations.

---

## 🏛️ 2. HIGH-LEVEL ARCHITECTURAL TOPOLOGY

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
│ • Multimodal 3D Room Blueprint Engine & 2-Hour Ephemeral Storage Cleaner    │
│ • Interactive 3D Spatial Room Model Engine (roomSpatialModel.js)            │
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

## 📐 3. MULTIMODAL 3D ROOM BLUEPRINT INGESTION & CAPACITY MODEL

Implemented to satisfy **Point 1 of the DELTA Engine Roadmap**:
1. **Multimodal Ingestion**: Accepts photos (`.png, .jpg, .jpeg, .webp`) and PDFs of room plans, floor sketches, or venue pictures.
2. **Review & Edit Modal (`#modal-upload-review`)**:
   - Live visual thumbnail or document stream preview.
   - AI Classification switch (🏛️ 3D Room Blueprint vs 📄 Presentation Talk).
   - Editable floor dimensions: Width ($m$), Length ($m$), Height ($m$), and Doors (Gates).
   - Live in-modal 3D spatial room model preview canvas with interactive yaw/tilt rotation.
   - Mathematical people quantity calculation:
     - Safe Fire Cap: $\text{round}(\text{Area} / 1.8\text{ m}^2)$
     - Dense Seating: $\text{round}(\text{Area} / 1.4\text{ m}^2)$
     - Standing Reception: $\text{round}(\text{Area} / 0.75\text{ m}^2)$
     - Egress Flow: $\text{Doors} \times 60\text{ pax/min}$
3. **Interactive 3D Spatial Room Model Engine (`roomSpatialModel.js`)**:
   - Pure HTML5 Canvas 2D isometric projection (zero external 3D library overhead).
   - Raised architectural walls, floor meter grid, elevated 3D stage with presenter podium.
   - Individual attendee seating array color-coded dynamically based on live sensor occupancy.
   - Entrance Gate A (linked to physical ESP32 dual laser tripwire) and Exit Gate B.
   - Kinetic idle sleep (0% CPU when static).
4. **2-Hour Ephemeral Storage (DPDP / GDPR Compliance)**:
   - Blueprint buffers stored in RAM with expiration timestamp: $\text{Date.now}() + 2 \times 3600 \times 1000$.
   - Automated 15-minute background cleaner purges expired data.
5. **Continuous Review & Edit**:
   - Operators can click `✏️ Review & Edit Ingested Data` at any time to recalibrate hall specs without re-uploading.

---

## 🔌 4. HARDWARE & IOT SUBSYSTEM

- **Microcontroller**: ESP32 NodeMCU-32S (Dual Tensilica Xtensa 240MHz).
- **Dual Laser Sensors**: 2x VL53L0X Time-of-Flight (940nm VCSEL) sensors.
- **Dual Hardware I2C Architecture**:
  - Sensor 1 (Entry): Bound to `Wire` on **GPIO 21 (SDA) / GPIO 22 (SCL)**.
  - Sensor 2 (Exit): Bound to `Wire1` on **GPIO 16 (RX2 SDA) / GPIO 17 (TX2 SCL)**.
  - Both operate concurrently at default factory I2C address `0x29` without `XSHUT` remapping.
- **Directional State Machine**: Detects entry ($S_1 \rightarrow S_2$) and exit ($S_2 \rightarrow S_1$) with 2-second timeout reset.
- **Noise Filter**: Rejects readings $<35\text{mm}$ (eliminates door frame crosstalk).

---

## ⚡ 5. PERFORMANCE ENGINEERING & ZERO-LAG ARCHITECTURE

1. **Graph Physics Simulation Auto-Sleep**: In `graphVisualizer.js`, kinetic energy is monitored (`totalMotion < 0.12`). Loop sleeps at 0% CPU once nodes stabilize.
2. **Persistent SVG Element In-Place Caching**: Replaced `svg.innerHTML = ''` with persistent element maps (`domLinkMap`, `domNodeMap`), eliminating ~4,800 DOM allocations per second and preventing V8 GC freeze spikes.
3. **Decoupled Vision Throttling**: 60 FPS video draw separated from 75ms throttled computer vision calculations.
4. **WebSocket Render Debouncing**: Wrapped `safeSyncUI()` in `requestAnimationFrame` debouncing to coalesce multi-message sensor bursts into a single render tick.
5. **Custom Cursor Comet Tail Sleep**: In `customCursor.js`, the particle canvas loop sleeps when the mouse stops moving.

---

## 📂 6. REPOSITORY FILE STRUCTURE

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
│   └── server.js                          # Express app, WebSocket server, 3D spatial & REST routes
├── frontend/
│   ├── components/
│   │   ├── app.js                         # Core UI event orchestrator
│   │   ├── auth.js                        # Client-side session and role management
│   │   ├── cctvPerception.js              # Edge computer vision, camera switching & HUD (decoupled)
│   │   ├── customCursor.js                # Electric Blue hardware-locked cursor & comet tail canvas
│   │   ├── graphVisualizer.js             # Kinetic-sleeping force-directed SVG graph visualizer
│   │   ├── roomSpatialModel.js            # Interactive 3D/Isometric spatial room twin engine
│   │   ├── contentPipeline.js             # Ingestion review/edit modal & 3D room plan calibrator
│   │   ├── dragdrop.js                    # HTML5 schedule drag-and-drop controller
│   │   ├── websockets.js                  # Real-time WebSocket pub/sub client with debounce
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

## 🚀 7. QUICKSTART & VERIFICATION RUNBOOK

### Start the Engine
```powershell
npm start
# Server boots at: http://localhost:3000
```

### Access Portals
- **Coordinator Dashboard & 3D Room Twin**: `http://localhost:3000/index.html`
- **Super Admin Command Center**: `http://localhost:3000/admin.html`
- **Digital Signage TV Kiosk**: `http://localhost:3000/signage.html`
- **Presentation Deck**: `http://localhost:3000/presentation.html`
