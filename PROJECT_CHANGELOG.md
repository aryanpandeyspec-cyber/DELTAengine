# 📋 DELTA ENGINE — Master Changelog & Architectural Updates Ledger

> **Document Purpose**: Complete, granular ledger of every addition, modification, removal, and performance optimization across the DELTA Engine codebase.  
> **Repository**: [aryanpandeyspec-cyber/DELTAengine](https://github.com/aryanpandeyspec-cyber/DELTAengine)  
> **Maintained By**: Lead Coordinator Aryan Pandey & Antigravity  

---

## 📑 Table of Contents
1. [Overview & Change Policy](#1-overview--change-policy)
2. [Component-by-Component Change Ledger](#2-component-by-component-change-ledger)
3. [Chronological Release History](#3-chronological-release-history)
   - [v3.5 (October 2026) — Multimodal Room Blueprint Ingestion & 3D Spatial Twin](#v35-october-2026--multimodal-room-blueprint-ingestion--3d-spatial-twin)
   - [v3.4 (October 2026) — Zero-Lag Hardening & Perception Throttling](#v34-october-2026--zero-lag-hardening--perception-throttling)
   - [v3.3 (October 2026) — Nico Robin Voice Announcer & Gemini 3.8 Auditor](#v33-october-2026--nico-robin-voice-announcer--gemini-38-auditor)
   - [v3.2 (September 2026) — Zebronics 480p CCTV Perception & Crowd Physics](#v32-september-2026--zebronics-480p-cctv-perception--crowd-physics)
   - [v3.1 (September 2026) — Physical IoT Hardware & Dual I2C Architecture](#v31-september-2026--physical-iot-hardware--dual-i2c-architecture)
   - [v3.0 (September 2026) — Groq Multi-Agent Swarm & Core OS Launch](#v30-september-2026--groq-multi-agent-swarm--core-os-launch)
4. [Removals & Deprecations Archive](#4-removals--deprecations-archive)

---

## 1. Overview & Change Policy

This ledger provides an unabridged audit trail for all engineering work on DELTA Engine. Every file addition, code refactor, bug resolution, and dependency update must be documented here alongside its rationale and operational impact.

---

## 2. Component-by-Component Change Ledger

### Backend Services (`backend/`)
- [`backend/server.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/server.js):
  - **Added**: Dual-branch ingestion pipeline in `/api/upload-slides` and dedicated alias `/api/upload-room-plan` supporting both 3D room blueprints and presentation documents.
  - **Added**: Ephemeral Spatial Storage in-memory map (`ephemeralSpatialPlans`) with configurable TTL (default 2 hours post-event per HackIndia specifications) and automatic 15-minute cleaner.
  - **Added**: Real-time capacity computation engine: Calculates safe fire capacity ($1.8\text{ m}^2/\text{pax}$), high-density seating ($1.4\text{ m}^2/\text{pax}$), standing reception ($0.75\text{ m}^2/\text{pax}$), and egress flow rates ($60\text{ pax/min}$ per door).
  - **Added**: Spatial query endpoints: `/api/spatial/room-models`, `/api/spatial/room-model/:hallId`, `/api/spatial/plan-preview/:planId`.
  - **Added**: WebSocket broadcast event `VENUE_SPATIAL_MODEL_UPDATE`.
  - **Added**: Route `/api/voice/announce` connecting to ElevenLabs Nico Robin voice engine.
  - **Added**: Route `/api/gemini/audit` and `/api/cctv/gemini-scene-audit` for Google Gemini 3.8 Flash cognition.
  - **Added**: Route `/api/whatsapp/incoming` enabling 2-way volunteer command processing from WhatsApp (`GATE CLEAR`, `OVERFLOW OPEN`, `AUTOPILOT ON/OFF`, `STATUS`).
  - **Added**: Route `/api/notify/whatsapp-all` broadcasting simultaneously to Aryan, Suryansh, and Shahid.
  - **Added**: Route `/signage` and `/api/calendar/feed.ics` live endpoints.
  - **Updated**: Defensive speaker fallback initialization and `try...catch` wrapper on `runSelfHealingAgent()` to eliminate unhandled crash hangs.
- [`backend/components/security.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/security.js):
  - **Updated**: `validateSlideFile()` now accepts images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) alongside document formats (`.pdf`, `.pptx`, `.ppt`, `.txt`).
- [`backend/components/selfHealing.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/selfHealing.js):
  - **Updated**: Added null safety guards for `speaker` and `hall` lookups in schedule auditing loops, preventing undefined member access exceptions (`Cannot read properties of undefined (reading 'delay')`).
- [`backend/components/voiceAnnouncer.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/voiceAnnouncer.js):
  - **Added**: Autonomous venue PA voice synthesizer featuring "Nico Robin" (One Piece) character persona (calm, elegant, intellectual female voice).
  - **Added**: ElevenLabs Flash v2.5 integration with voice ID `EXAVITQu4vr4xnSDxMaL` (Sarah).
  - **Added**: MD5-based persistent audio cache in `frontend/audio_announcements/cache_{hash}.mp3` for $<1\text{ms}$ repetitive announcements.
  - **Added**: Instant local fallback to `frontend/announcement_test.mp3` when API key is absent or unreachable.
- [`backend/components/geminiAuditor.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/geminiAuditor.js):
  - **Added**: Cognitive reasoning pipeline powered by Google Gemini 3.8 Flash (`gemini-3.8-flash` / `gemini-3.5-flash`).
  - **Added**: Automated JSON risk evaluation schema (`safetyRating`, `riskLevel`, `bottleneckIdentified`, `paAnnouncementScript`).
  - **Added**: Base64 scene visual auditing via Gemini Vision.
- [`backend/components/twilioDispatcher.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/twilioDispatcher.js):
  - **Added**: Twilio Programmable Messaging integration for automated WhatsApp alerts.
  - **Added**: Fallback click-to-chat web intents (`https://wa.me/`) for simulated mode.

### Frontend Components (`frontend/components/`)
- [`frontend/components/roomSpatialModel.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/roomSpatialModel.js) *(New Component)*:
  - **Added**: High-performance HTML5 Canvas 2D isometric 3D spatial room renderer.
  - **Added**: Architectural 3D elements: floor meter grid, 3D raised perimeter walls, elevated 3D stage with presenter podium, color-coded attendee seating array synced with live headcount, Entrance Gate A (with green ToF laser tripwire indicator), and Emergency Exit Gate B.
  - **Added**: Interactive rotation controls (yaw & tilt via mouse dragging or touch, zoom via scroll wheel) with kinetic idle sleep (0% CPU when stationary).
  - **Added**: Overlay HUD displaying real-time dimensions, floor area ($m^2$), safe fire capacity, and doorway egress rates.
- [`frontend/components/contentPipeline.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/contentPipeline.js):
  - **Added**: Pre-upload **Review & Edit Modal** (`#modal-upload-review`): opens on file selection/drop, displays image thumbnail or document stream preview.
  - **Added**: Document type auto-classification switch (🏛️ 3D Room Plan vs 📄 Presentation Slides).
  - **Added**: Real-time room dimension editing (Width, Length, Height, Doors) with dynamic recalculation of floor area ($m^2$), people quantity, safe fire cap, and door egress rate.
  - **Added**: In-modal interactive 3D spatial room model preview canvas updating live as dimensions change.
  - **Added**: Ephemeral storage toggle (2 hours post-event auto-purge).
  - **Added**: User-editable field overrides for talk titles, speakers, summaries, tags, halls, and slots.
  - **Added**: Post-upload action button `✏️ Review & Edit Ingested Data` allowing users to edit ingested data anytime without re-uploading.
  - **Added**: Post-upload `🏛️ Live 3D Spatial Digital Twin` dashboard card rendering the interactive room twin directly in the results view.
  - **Added**: 1-Click Mock Sample Feed Handlers (`#btn-feed-sample-blueprint`, `#btn-feed-sample-photo`, `#btn-feed-sample-slides`) that load mock files asynchronously via Fetch Blob API into the review pipeline.
- [`frontend/components/websockets.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/websockets.js):
  - **Added**: WebSocket handler for `VENUE_SPATIAL_MODEL_UPDATE` updating hall capacities and triggering safe UI re-renders.
- [`frontend/index.html`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/index.html):
  - **Added**: Ingestion Review & Calibration modal markup (`#modal-upload-review`).
  - **Added**: Live 3D Spatial Digital Twin result card (`#spatial-result-card`) and post-ingestion action container (`#pipeline-results-actions`).
  - **Added**: 1-Click Mock Sample Feed buttons in the content pipeline card.
  - **Added**: Script inclusion for `components/roomSpatialModel.js`.

### Test Assets & Synthetic Data Suite
- [`venue_room_plan_blueprint.pdf`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/venue_room_plan_blueprint.pdf) & [`frontend/venue_room_plan_blueprint.pdf`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/venue_room_plan_blueprint.pdf):
  - Architectural CAD vector blueprint mock data PDF (Turing Hall, $20\text{m} \times 30\text{m} = 600\text{ m}^2$, $5.5\text{m}$ ceiling, elevated keynote stage, 3-sector seating rows, Gate A with dual VL53L0X ToF laser tripwire symbol, Gate B emergency exit, NFPA/IBC fire capacity matrix: 333 safe / 429 theater / 800 standing, 180 pax/min egress discharge).
- [`venue_room_plan_blueprint.png`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/venue_room_plan_blueprint.png) & [`frontend/venue_room_plan_blueprint.png`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/venue_room_plan_blueprint.png):
  - High-resolution $1200 \times 900$ architectural blueprint PNG image for testing photo/pic blueprint upload and computer vision ingestion.
- [`sample_advanced_wasm_presentation.pdf`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/sample_advanced_wasm_presentation.pdf) & [`frontend/sample_advanced_wasm_presentation.pdf`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/sample_advanced_wasm_presentation.pdf):
  - Realistic multi-slide keynote presentation deck ("Advanced WebAssembly Runtimes & Edge Swarms" by Dr. Elena Rostova) for testing slide ingestion and automated schedule graph weaving.
- [`generate_mock_pdf.py`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/generate_mock_pdf.py):
  - Deterministic Python generator script leveraging ReportLab 5.0 and Pillow to synthesize all CAD blueprint PDFs, PNGs, and presentation decks.

---

## 3. Chronological Release History

### v3.5 (October 2026) — Multimodal Room Blueprint Ingestion & 3D Spatial Twin
- **Objective**: Implement Point 1 from the HackIndia Engineering Notebook: enable uploading photos or PDFs of venue room plans/pics, auto-detecting room structures, calculating people capacity, building an interactive 3D spatial room model, and providing pre/post-upload review and edit capabilities with 2-hour ephemeral storage.
- **Features Implemented**:
  1. Expanded drag-and-drop ingestion to support `.png, .jpg, .jpeg, .webp, .svg, .pdf, .pptx, .ppt, .txt`.
  2. Built the **Ingestion Review & Calibration Modal** (`#modal-upload-review`) with live visual preview, AI classification switcher, editable dimensions, seating density presets (1.8m², 1.4m², 0.75m²), door gate mapping, and 2-hour ephemeral storage controls.
  3. Built [`roomSpatialModel.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/roomSpatialModel.js): High-speed isometric 3D canvas engine rendering floor grid, walls, elevated stage, seating array, and dual laser tripwire gates with 0% idle CPU usage.
  4. Added post-ingestion `✏️ Review & Edit Ingested Data` action button and live 3D room twin card on the dashboard.
  5. Implemented backend spatial API routes (`/api/spatial/room-models`, `/api/spatial/room-model/:hallId`) and ephemeral storage with 15-minute background auto-cleanup.
  6. Fixed null pointer exceptions in `selfHealing.js` and `server.js` for custom topic/speaker insertions.

### v3.4 (October 2026) — Zero-Lag Hardening & Perception Throttling
- **Objective**: Permanently eliminate intermittent UI lag and mouse stutter during camera usage and post-update self-healing events.
- **Root Causes Addressed**:
  1. Synchronous `getImageData(0, 0, 320, 240)` readbacks (307KB) executed 60 times/sec on the main JS thread.
  2. Infinite 60 FPS physics simulation loop in `graphVisualizer.js` executing destructive `svg.innerHTML = ''` every 16ms, creating ~4,800 dead DOM nodes per second and triggering V8 GC freeze spikes (100–300ms).
  3. Burst WebSocket messages triggering back-to-back full UI re-renders without batching.
  4. Continuous 60 FPS canvas clearing on the custom cursor tail when mouse was stationary.
- **Fixes Applied**:
  - Implemented kinetic energy sleep in `graphVisualizer.js` (`totalMotion < 0.12`).
  - Implemented in-place persistent SVG DOM caching (`domLinkMap`, `domNodeMap`).
  - Decoupled video display (60 FPS) from computer vision processing (75ms tick) in `cctvPerception.js`.
  - Coalesced WebSocket UI renders using `requestAnimationFrame` debouncing in `websockets.js`.
  - Added idle sleep to custom cursor comet tail in `customCursor.js`.
  - Aligned custom cursor click anchor to top apex (`top: -2px; left: -2px`) and removed duplicate browser finger pointers on card hovers.

### v3.3 (October 2026) — Nico Robin Voice Announcer & Gemini 3.8 Auditor
- **Added**: Autonomous venue PA voice synthesizer featuring "Nico Robin" (One Piece) character persona (calm, intellectual, composed female voice).
- **Added**: ElevenLabs Flash v2.5 integration with voice ID `EXAVITQu4vr4xnSDxMaL` (Sarah), tuned for serenity and intellectual delivery.
- **Added**: Local MD5 audio cache (`frontend/audio_announcements/`) and local MP3 fallback (`announcement_test.mp3`).
- **Added**: Google Gemini 3.8 Flash cognitive auditor (`geminiAuditor.js`) for venue crowd dynamics and automated PA script generation.
- **Added**: 2-Way volunteer WhatsApp control webhook at `/api/whatsapp/incoming` supporting commands (`GATE CLEAR`, `OVERFLOW OPEN`, `AUTOPILOT ON/OFF`, `STATUS`).
- **Added**: Digital Signage TV kiosk display (`frontend/signage.html`).

### v3.2 (September 2026) — Zebronics 480p CCTV Perception & Crowd Physics
- **Added**: WebAssembly `pico.js` and `facefinder.js` frontal face cascade integration.
- **Added**: Eulerian crowd motion optical velocity vectors and chokepoint analysis.
- **Added**: Counter-flow corridor stream collision detection.
- **Added**: Barricade pressure PSI sensor model with automated emergency gate release pulse (`/api/sensors/door`).
- **Added**: Stampede & crowd crush risk index computation ($0–100\%$).
- **Added**: Support for external USB webcams including Zebronics ZEB-CRYSTAL PRO 480p.

### v3.1 (September 2026) — Physical IoT Hardware & Dual I2C Architecture
- **Added**: ESP32 firmware for dual VL53L0X Time-of-Flight laser distance sensors on independent I2C buses (`Wire` on D21/D22, `Wire1` on RX2/TX2).
- **Added**: Directional passage detection state machine (Entry vs Exit) with noise filtering.
- **Added**: Auto-pin permutation scanner matrix.
- **Added**: Python serial-to-REST bridge (`hardware/door_serial_bridge.py`).
- **Resolved**: Breadboard split power rail trap, 2cm laser optical self-reflection trap, and ESP32 Guru Meditation LoadProhibited crash.

### v3.0 (September 2026) — Groq Multi-Agent Swarm & Core OS Launch
- **Added**: Heterogeneous Groq LLM agent swarm (Liaison, Scheduler, Logistics, Marketing).
- **Added**: In-memory topological spatial graph database (`backend/components/graphDb.js`).
- **Added**: Dynamic schedule conflict solver (`backend/components/selfHealing.js`).
- **Added**: Coordinator Command Center (`frontend/index.html`) and Super Admin Console (`frontend/admin.html`).
- **Added**: Supabase authentication and anti-spam transactional email dispatcher (`supabaseEmailIntegrator.js`).
- **Added**: Presentation slide deck generator (`generate_deck.py` & `presentation.html`).

---

## 4. Removals & Deprecations Archive

| Removed Element | Prior Location | Rationale & Replacement |
| :--- | :--- | :--- |
| Blind Auto-Ingestion without Review | `frontend/components/contentPipeline.js` | Files were previously submitted directly upon drop without user preview or editing. Replaced by the Ingestion Review & Calibration modal (`#modal-upload-review`). |
| Document-Only Upload Limitation | `backend/components/security.js` | Restricted uploads to `.pdf,.pptx,.ppt,.txt`. Expanded to support `.png,.jpg,.jpeg,.webp,.svg` for architectural blueprints and room photos. |
| Unguarded Speaker Property Access | `backend/components/selfHealing.js` | Direct lookup `graph.speakers[topic.speakerId].delay` threw uncaught TypeError if speaker was uninitialized. Replaced by defensive fallback `{ name: 'Featured Speaker', delay: 0 }`. |
| `svg.innerHTML = ''` | `frontend/components/graphVisualizer.js` | Caused ~4,800 dead SVG DOM nodes per second, triggering severe V8 Garbage Collection freezes. Replaced by persistent in-place element caching (`domLinkMap`, `domNodeMap`). |
| Unthrottled 60 FPS `getImageData()` | `frontend/components/cctvPerception.js` | Starved the main JavaScript UI thread with 307KB synchronous GPU-to-CPU readbacks 60 times/sec. Replaced by a decoupled 75ms throttled vision loop with cached bounding boxes. |
| Continuous idle `renderCometTail()` | `frontend/components/customCursor.js` | Consumed CPU and GPU cycles continuously clearing and redrawing an empty canvas when the mouse was still. Replaced by a sleepable animation loop that exits when `points.length === 0`. |
| Un-debounced `safeSyncUI()` | `frontend/components/websockets.js` | Caused sequential WebSocket packets to trigger multiple heavy re-renders within milliseconds. Replaced by `requestAnimationFrame` render coalescing. |
| Native cursor duplication | `frontend/app.css` & `customCursor.js` | Native finger pointer appeared alongside the custom Electric Blue cursor on card elements. Suppressed via explicit CSS pointer-events and unified styling. |
| Single-I2C pin hardcoding | `hardware/DELTA_Door_Counter.ino` | Caused I2C address collisions (`0x29`). Replaced by dual hardware I2C peripheral assignment (`Wire` + `Wire1`) and auto-pin scanning. |

---
*Maintained by Antigravity for Team DELTA • Updated continuously on every commit.*
