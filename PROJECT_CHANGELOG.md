# 📋 DELTA ENGINE — Master Changelog & Architectural Updates Ledger

> **Document Purpose**: Complete, granular ledger of every addition, modification, removal, and performance optimization across the DELTA Engine codebase.  
> **Repository**: [aryanpandeyspec-cyber/DELTAengine](https://github.com/aryanpandeyspec-cyber/DELTAengine)  
> **Maintained By**: Lead Coordinator Aryan Pandey & Antigravity  

---

## 📑 Table of Contents
1. [Overview & Change Policy](#1-overview--change-policy)
2. [Component-by-Component Change Ledger](#2-component-by-component-change-ledger)
3. [Chronological Release History](#3-chronological-release-history)
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
  - **Added**: Route `/api/voice/announce` connecting to ElevenLabs Nico Robin voice engine.
  - **Added**: Route `/api/gemini/audit` and `/api/cctv/gemini-scene-audit` for Google Gemini 3.8 Flash cognition.
  - **Added**: Route `/api/whatsapp/incoming` enabling 2-way volunteer command processing from WhatsApp (`GATE CLEAR`, `OVERFLOW OPEN`, `AUTOPILOT ON/OFF`, `STATUS`).
  - **Added**: Route `/api/notify/whatsapp-all` broadcasting simultaneously to Aryan, Suryansh, and Shahid.
  - **Added**: Route `/signage` and `/api/calendar/feed.ics` live endpoints.
  - **Updated**: Crash guard handlers (`uncaughtException`, `unhandledRejection`) to prevent server process termination.
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
- [`backend/components/agentSwarm.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/agentSwarm.js):
  - **Added**: Heterogeneous Groq agent swarm (Liaison, Scheduler, Logistics, Marketing).
  - **Added**: Runtime API key rotation (`setGroqApiKey`, `getGroqApiKey`).
- [`backend/components/selfHealing.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/selfHealing.js):
  - **Added**: Autonomous conflict solver with deterministic mathematical fallback engine.
- [`backend/components/graphDb.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/graphDb.js):
  - **Added**: In-memory topological spatial graph database for halls, topics, and speakers.

### Frontend Components (`frontend/components/`)
- [`frontend/components/graphVisualizer.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/graphVisualizer.js):
  - **Added**: Kinetic energy sleep condition (`totalMotion < 0.12`) to shut down the 60 FPS physics loop when nodes stabilize (0% CPU usage).
  - **Added**: `wakePhysicsSimulation()` helper to restart the loop on node drag or graph updates.
  - **Added**: Persistent in-place SVG element caching (`domLinkMap`, `domNodeMap`) for lines and node groups.
  - **Removed**: Destructive `svg.innerHTML = ''` wiping on every animation frame, eliminating ~4,800 DOM allocations per second and preventing V8 Garbage Collector freeze spikes.
- [`frontend/components/cctvPerception.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/cctvPerception.js):
  - **Added**: Decoupled rendering architecture: video canvas draws at 60 FPS while heavy computer vision (`getImageData()`, Pico cascades, Eulerian flow calculations) runs on a 75ms throttled tick (~13.3 FPS).
  - **Added**: Caching for detected bounding boxes (`cachedDetectedBoxes`) and Eulerian flow data (`cachedEulerianData`).
  - **Added**: Eulerian crowd motion optical velocity vectors and counter-flow collision alerts.
  - **Added**: Barricade pressure PSI calculations with automated gate release trigger at $\ge 8.5\text{ PSI}$.
  - **Added**: Mega-crowd stampede risk index calculation ($0–100\%$).
  - **Updated**: Modal canvas mirroring restricted to execute only when `#modal-cctv` is visible.
- [`frontend/components/customCursor.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/customCursor.js):
  - **Added**: Electric Blue precision cursor with hotspot locked at apex (`top: -2px; left: -2px`).
  - **Added**: Comet tail particle canvas with dynamic decay and kinetic idle sleep (`points.length === 0` puts loop to sleep at 0% CPU/GPU).
  - **Fixed**: Removed double-pointers (default browser finger cursor appearing beside the custom pointer on card hovers).
- [`frontend/components/websockets.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/websockets.js):
  - **Added**: `requestAnimationFrame` debouncing on `safeSyncUI()` to coalesce rapid bursts of incoming WebSocket messages into a single render tick.
- [`frontend/components/stressTester.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/stressTester.js):
  - **Added**: High-concurrency micro-benchmark executing 500 schedule conflict scenarios in $<30\text{ms}$.
- [`frontend/components/contentPipeline.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/contentPipeline.js):
  - **Added**: Presentation slide file validation and metadata parsing.

### Hardware & Firmware (`hardware/`)
- [`hardware/DELTA_Door_Counter/DELTA_Door_Counter.ino`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/hardware/DELTA_Door_Counter/DELTA_Door_Counter.ino):
  - **Added**: Dual hardware I2C support on ESP32 (`Wire` on D21/D22, `Wire1` on RX2/TX2).
  - **Added**: Directional passage state machine (Entry vs Exit) with 2000ms timeout reset.
  - **Added**: Auto-pin scanning permutation matrix `(21, 22)`, `(22, 21)`, `(21, 23)`, `(23, 21)`, `(22, 23)`.
  - **Added**: Single-sensor fallback mode if one sensor is disconnected.
  - **Added**: `#define MIN_DISTANCE_MM 35` noise filter to prevent self-reflection crosstalk.
  - **Added**: `#define DISTANCE_THRESHOLD_MM 150` for tuned 15 cm doorway detection.
  - **Fixed**: Protected against null pointer dereference crashes (`Guru Meditation Error EXCVADDR: 0x00000040`).
- [`hardware/door_serial_bridge.py`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/hardware/door_serial_bridge.py):
  - **Added**: Auto-discovery of Silicon Labs CP210x COM port (`COM7`).
  - **Added**: Auto-reconnection logic and JSON serial-to-REST HTTP POST forwarder.
- [`hardware/cctv_occupancy_vision.py`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/hardware/cctv_occupancy_vision.py):
  - **Added**: Python OpenCV HOG person detection script streaming to `/api/sensors/camera`.

---

## 3. Chronological Release History

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
| `svg.innerHTML = ''` | `frontend/components/graphVisualizer.js` | Caused ~4,800 dead SVG DOM nodes per second, triggering severe V8 Garbage Collection freezes. Replaced by persistent in-place element caching (`domLinkMap`, `domNodeMap`). |
| Unthrottled 60 FPS `getImageData()` | `frontend/components/cctvPerception.js` | Starved the main JavaScript UI thread with 307KB synchronous GPU-to-CPU readbacks 60 times/sec. Replaced by a decoupled 75ms throttled vision loop with cached bounding boxes. |
| Continuous idle `renderCometTail()` | `frontend/components/customCursor.js` | Consumed CPU and GPU cycles continuously clearing and redrawing an empty canvas when the mouse was still. Replaced by a sleepable animation loop that exits when `points.length === 0`. |
| Un-debounced `safeSyncUI()` | `frontend/components/websockets.js` | Caused sequential WebSocket packets to trigger multiple heavy re-renders within milliseconds. Replaced by `requestAnimationFrame` render coalescing. |
| Native cursor duplication | `frontend/app.css` & `customCursor.js` | Native finger pointer appeared alongside the custom Electric Blue cursor on card elements. Suppressed via explicit CSS pointer-events and unified styling. |
| Single-I2C pin hardcoding | `hardware/DELTA_Door_Counter.ino` | Caused I2C address collisions (`0x29`). Replaced by dual hardware I2C peripheral assignment (`Wire` + `Wire1`) and auto-pin scanning. |

---
*Maintained by Antigravity for Team DELTA • Updated continuously on every commit.*
