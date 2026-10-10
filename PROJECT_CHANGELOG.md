# 📋 DELTA ENGINE — Master Changelog & Architectural Updates Ledger

> **Document Purpose**: Complete, granular ledger of every addition, modification, removal, and performance optimization across the DELTA Engine codebase.  
> **Repository**: [aryanpandeyspec-cyber/DELTAengine](https://github.com/aryanpandeyspec-cyber/DELTAengine)  
> **Maintained By**: Lead Coordinator Aryan Pandey & Antigravity  

---

## 📑 Table of Contents
1. [Overview & Change Policy](#1-overview--change-policy)
2. [Component-by-Component Change Ledger](#2-component-by-component-change-ledger)
3. [Chronological Release History](#3-chronological-release-history)
   - [v3.6.2 (October 2026) — Comprehensive UI Decluttering & Zero-Lag Performance Optimization](#v362-october-2026--comprehensive-ui-decluttering--zero-lag-performance-optimization)
   - [v3.6.1 (October 2026) — Clean Dev Terminal Streamlining & High-Frequency Telemetry Throttling](#v361-october-2026--clean-dev-terminal-streamlining--high-frequency-telemetry-throttling)
   - [v3.6 (October 2026) — Autonomous Crowd Operations Engine, Three.js PBR 3D Twin & NVIDIA NIM](#v36-october-2026--autonomous-crowd-operations-engine-threejs-pbr-3d-twin--nvidia-nim)
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

### Frontend & UI Layer (`frontend/`)
- [`frontend/components/customCursor.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/customCursor.js):
  - **Removed**: Dynamic `window.addEventListener('mouseover')` style injector that forced continuous inline style mutations and layout thrashing across all hovered DOM elements.
  - **Performance Impact**: Restored native 60–120 FPS cursor tracking smoothness across complex cards without CPU spikes.
- [`frontend/components/cctvPerception.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/cctvPerception.js):
  - **Added**: Dirty-checking state cache (`lastCachedMetrics`) in `updateDensityMetrics()` to eliminate 12 querySelector lookups and destructive `innerHTML` re-renders 13 times/sec on steady-state frames.
  - **Added**: Element content and class cache guards for `#cctv-optical-detection-tag` during `processVideoFrame()`, preventing 60 FPS style invalidations.
- [`frontend/components/roomSpatialModel.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/roomSpatialModel.js):
  - **Added**: Zero-lag GPU idle guard in `animate()` loop (`if (!isVisible) setTimeout(...)`) sleeping 60 FPS WebGL PBR loop when canvas is hidden, off-DOM, or tab is backgrounded.
  - **Added**: Explicit `destroy()` method disposing WebGLRenderer and OrbitControls to eliminate WebGL memory leaks.
- [`frontend/components/contentPipeline.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/contentPipeline.js):
  - **Added**: Clean disposal call to `activeModalSpatialRenderer.destroy()` on modal close, freeing GPU resources immediately.
- [`frontend/app.css`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/app.css):
  - **Performance**: Promoted 8 floating `.doodle-img` elements to dedicated GPU compositor layers (`will-change: transform; transform: translateZ(0); backface-visibility: hidden;`) and reduced opacity to 0.14 for reduced paint recomposition load.
  - **Decluttering**: Added dedicated layout classes `.cctv-header-cluster`, `.widget-ingress-body`, `.ingress-kpi-top`, `.ingress-kpi-subbar`, `.ingress-kpi-actions`, `.spatial-actions-row`, `.spatial-sample-btn-lab`, `.spatial-sample-btn-hall`, `.spatial-config-bar`, and `.spatial-select-field`.
- [`frontend/index.html`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/index.html):
  - **Decluttering (CCTV Top Hub)**: Grouped 7 disjointed header controls into 3 semantic clusters (`.cctv-cluster-source`, `.cctv-cluster-stream`, `.cctv-cluster-modes`) with preserved IDs and actions.
  - **Decluttering (Ingress KPI Card)**: Cleaned up `widget-ingress-kpi`, removing cramped inline styles and awkward `transform: scale(0.85)` in favor of a crisp native flex layout matching Cards 1–3.
  - **Decluttering (Console Card)**: Relocated `.sentiment-ticker` ("ATTENDEE REACTION STREAM") beneath `.terminal-container` so agent incident logs read without interruption.
  - **Decluttering (3D Spatial Builder)**: Standardized toolbar and config controls using clean semantic CSS classes instead of repetitive inline styling blobs.

### Backend Services (`backend/`)
- [`backend/components/operationsEngine.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/operationsEngine.js) *(New Component)*:
  - **Added**: Real-time deterministic operations mitigation engine executing in 1.02ms (<5ms SLA) without LLM hot-path blocking.
  - **Added**: Multi-incident safety solvers for overcrowding, bottlenecking, perimeter breach, and medical egress.
- [`backend/components/scenarioManager.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/scenarioManager.js) *(New Component)*:
  - **Added**: Generalized 5-domain scenario engine (Conference, Public Rally, Large Gathering / Mela, Movie Promotion, Religious Festival).
  - **Added**: Zone topology, physical boundaries, marshal coordinator rosters, and dynamic telemetry mapping.
- [`backend/components/incidentModel.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/incidentModel.js) *(New Component)*:
  - **Added**: Telemetry requirements abstraction matrix defining "Data We Have", "Data We Need", "Actions We Can Take", and "Actions We Cannot Take".
- [`backend/components/volunteerRouter.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/volunteerRouter.js) *(New Component)*:
  - **Added**: Hall-aware targeted volunteer dispatch engine routing task alerts based on zone proximity.
  - **Added**: Anti-spam rate shielding preventing duplicated volunteer notification fatigue.
- [`backend/components/spatial3dEngine.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/spatial3dEngine.js) *(New Component)*:
  - **Added**: NVIDIA Nemotron NIM spatial construction engine with Gemini Vision integration for zero-boilerplate 3D venue layout synthesis.
- [`tests/runAllTests.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/tests/runAllTests.js) *(New Test Suite)*:
  - **Added**: 64-test automated regression suite covering baseline state, self-healing, multi-scenario registries, deterministic speed, agent swarms, 500-scenario stress testing, and visual lock integrity. All 64/64 tests pass with 100% success rate.

---

## 3. Chronological Release History

### v3.6.2 (October 2026) — Comprehensive UI Decluttering & Zero-Lag Performance Optimization
- **Objective**: Eliminate frontend UI/render lag, frame drops, and visual clutter across cursor movement, video perception, Three.js 3D rendering, and dashboard layouts, while guaranteeing 100% feature preservation across all 14 required DOM control IDs.
- **Key Deliverables**:
  1. **Zero-Lag Cursor & Perception Optimization**: Eliminated mouseover style mutation bottlenecks in `customCursor.js`, introduced dirty-checking state cache in `cctvPerception.js` to stop continuous DOM layout thrashing, and cached HUD tag updates.
  2. **WebGL Resource Leak & Idle Pause**: Added idle visibility detection in `roomSpatialModel.js` sleeping Three.js render loops when canvases are hidden or off-screen, plus full WebGL context destruction on modal dismissal in `contentPipeline.js`.
  3. **GPU Layer Promotion**: Upgraded levitating decorative elements to dedicated GPU compositor layers with `will-change: transform` and reduced opacity for smooth viewport rendering.
  4. **CCTV Header Action Clustering**: Grouped 7 disparate header controls into logical, visually appealing segmented clusters (`.cctv-cluster-source`, `.cctv-cluster-stream`, `.cctv-cluster-modes`).
  5. **Ingress KPI Card Refactor**: Transformed cramped, inline-styled `widget-ingress-kpi` into a clean, balanced card matching Cards 1–3 without artificial scale hacks.
  6. **Agent Console Terminal Flow**: Docked `.sentiment-ticker` underneath `.terminal-container` so self-healing logs read continuously from the incident bar without disruption.
  7. **Spatial Reconstruction Toolbar Polish**: Extracted repetitive inline styles in `#card-spatial-builder` into unified, reusable CSS classes.
  8. **100% Test Suite Verification**: Verified all 14 core DOM IDs and 64/64 comprehensive unit/integration test cases remain green with 0 failures and $<1.3$ms deterministic solver speed.

### v3.6.1 (October 2026) — Clean Dev Terminal Streamlining & High-Frequency Telemetry Throttling
- **Objective**: Eliminate high-volume terminal logging clutter produced during `npm run dev` and live sensor execution, creating a clean, professional, and readable developer console while guaranteeing 100% feature preservation and zero regressions.
- **Key Deliverables**:
  1. **Clean Dev Startup Screen**: Configured ANSI clear codes (`\x1B[2J\x1B[3J\x1B[H`) and clean ASCII status banner displaying web app, admin console, and digital signage URLs.
  2. **Silenced Dotenv Injection Banners**: Enforced `process.env.DOTENV_CONFIG_QUIET = 'true'` and `{ quiet: true }` across all entry points, eliminating promotional banner injection noise.
  3. **High-Frequency Telemetry Throttling**: Implemented `TELEMETRY_LOG_COOLDOWN_MS = 6000` cooldown for routine `/api/sensors/door` and `/api/sensors/face-passage` events while instantly emitting critical state transitions (barricade pressure release $>8.5\text{ PSI}$, occupancy $\ge 80\%$, room full $\ge 95\%$).
  4. **Twilio WhatsApp Simulation Aggregation**: Aggregated simulated notification logs into compact batch summaries, preventing 100+ line floods during multi-person emergency alerts.
  5. **Agent Swarm & Mailer Resiliency Logging**: Replaced verbose Groq 429 candidate retry warnings with a single clean fallback transition; silenced local schema cache notices.
  6. **Compact Module Output**: Streamlined multi-line logs in `volunteerRouter.js` and `spatial3dEngine.js` into concise single-line entries.
  7. **Full Test Suite Integrity**: Verified 64/64 tests passing (100% pass rate).

### v3.6 (October 2026) — Autonomous Crowd Operations Engine, Three.js PBR 3D Twin & NVIDIA NIM
- **Objective**: Merge and unify `aryan` branch updates with `main`: generalized crowd safety operations across 5 event domains, high-precision Three.js PBR 3D venue renderer with directional soft shadows, NVIDIA Nemotron NIM spatial engine, targeted volunteer router, and comprehensive 64-test regression runner.
- **Key Deliverables**:
  1. Merged `origin/aryan` branch cleanly with fast-forward into `main`.
  2. Activated `tests/runAllTests.js`: 64/64 automated tests passing (100% pass rate).
  3. Integrated Three.js PBR spatial room model with timber stage, soft shadows, laser tripwires, and live sensor bindings.
  4. Deployed targeted volunteer routing with anti-spam shielding and Twilio/WhatsApp integration.
  5. Verified deterministic operations response time at 1.022ms (<5ms SLA).

### v3.5 (October 2026) — Multimodal Room Blueprint Ingestion & 3D Spatial Twin
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
  - **Added**: Global Cross-Origin Resource Sharing (CORS) headers middleware (`Access-Control-Allow-Origin: *`, `Methods`, `Headers`) enabling requests from any dev environment, Live Server, or host.
  - **Updated**: Route `/api/upload-slides` hardened with top-level `try...catch` block, null-safe file buffers, defensive self-healing agent wrappers, and support for calibrating room plans without requiring a physical file re-upload.
  - **Updated**: Defensive speaker fallback initialization and `try...catch` wrapper on `runSelfHealingAgent()` to eliminate unhandled crash hangs.
- [`backend/components/security.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/security.js):
  - **Updated**: `validateSlideFile()` now accepts images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) alongside document formats (`.pdf`, `.pptx`, `.ppt`, `.txt`), with `isOptional` flag for room calibrations.
  - **Updated**: `rateLimiter` updated to exempt localhost loopback (`127.0.0.1`, `::1`) and upload endpoints (`/api/upload*`, `/api/spatial*`) from strict 100 req/min rate limits during testing.
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
  - **Added**: 1-Click Mock Sample Feed Handlers (`#btn-feed-sample-blueprint`, `#btn-feed-sample-photo`, `#btn-feed-sample-slides`) that load mock files asynchronously into the review pipeline with instant local in-memory fallbacks.
  - **Refined**: Eliminated artificial 2.4-second delay in `executeIngestion`: uploads now dispatch immediately with smooth non-blocking micro-stage animations.
  - **Refined**: Replaced generic network error toasts with descriptive, actionable error reporting and safe JSON extraction.
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
