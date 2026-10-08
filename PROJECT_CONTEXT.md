# ⚡ DELTA ENGINE — Master Technical Context & Architecture Dossier

> **Project**: DELTA ENGINE (Autonomous Self-Healing Spatial & Event Operating System)  
> **Hackathon**: HackIndia Spark 2026 — South Central Region (Hyderabad, Telangana)  
> **Repository**: [aryanpandeyspec-cyber/DELTAengine](https://github.com/aryanpandeyspec-cyber/DELTAengine)  
> **Core Leadership**: Aryan Pandey (Lead Coordinator), Suryansh (Crowd & Safety Lead), Shahid (Stage & Ops Lead)  
> **Last Updated**: October 2026 (Zero-Lag Performance Hardening & Multi-Modal Perception Release)

---

## 📋 Table of Contents
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Physical IoT Edge Perception System](#3-physical-iot-edge-perception-system)
   - [Hardware Bill of Materials (BOM)](#hardware-bill-of-materials-bom)
   - [Electrical Pinout & Wiring Matrix](#electrical-pinout--wiring-matrix)
   - [Dual Hardware I2C Architecture](#dual-hardware-i2c-architecture)
   - [Firmware Implementation (`DELTA_Door_Counter.ino`)](#firmware-implementation-delta_door_counterino)
4. [Hardware Troubleshooting Chronicle & Gotchas (Full Engineering Log)](#4-hardware-troubleshooting-chronicle--gotchas)
   - [Issue 1: Blank Serial Monitor on Boot](#issue-1-blank-serial-monitor-on-boot)
   - [Issue 2: Pin Misplacement (D23 vs D21 silkscreen trap)](#issue-2-pin-misplacement-d23-vs-d21-silkscreen-trap)
   - [Issue 3: The Split Breadboard Power Rail Trap](#issue-3-the-split-breadboard-power-rail-trap)
   - [Issue 4: ESP32 Guru Meditation Error Crash Loop](#issue-4-esp32-guru-meditation-error-crash-loop)
   - [Issue 5: The 2 cm (20 mm) Laser Self-Reflection Trap](#issue-5-the-2-cm-20-mm-laser-self-reflection-trap)
5. [IoT Serial-to-Web Bridge (`door_serial_bridge.py`)](#5-iot-serial-to-web-bridge-door_serial_bridgepy)
6. [Multi-Modal CCTV Room Perception & Crowd Dynamics Engine](#6-multi-modal-cctv-room-perception--crowd-dynamics-engine)
   - [Optical Metrics & Eulerian Flow Physics](#optical-metrics--eulerian-flow-physics)
   - [Barricade Pressure PSI & Automated Emergency Gate Release](#barricade-pressure-psi--automated-emergency-gate-release)
   - [Decoupled Vision Throttling & 60 FPS Zero-Lag Pipeline](#decoupled-vision-throttling--60-fps-zero-lag-pipeline)
7. [Autonomous Voice Announcer Subsystem (`voiceAnnouncer.js`)](#7-autonomous-voice-announcer-subsystem-voiceannouncerjs)
   - [Nico Robin Character Persona & ElevenLabs Flash v2.5](#nico-robin-character-persona--elevenlabs-flash-v25)
   - [Low-Latency Caching & Multi-Tier Fallbacks](#low-latency-caching--multi-tier-fallbacks)
8. [Google Gemini 3.8 Flash Venue Reasoning Auditor (`geminiAuditor.js`)](#8-google-gemini-38-flash-venue-reasoning-auditor-geminiauditorjs)
9. [Multi-Agent Groq Self-Healing Swarm](#9-multi-agent-groq-self-healing-swarm)
10. [Communications Fabric & 2-Way Volunteer WhatsApp Webhook](#10-communications-fabric--2-way-volunteer-whatsapp-webhook)
11. [Frontend Portals, Neomorphic UI & Precision Custom Cursor](#11-frontend-portals-neomorphic-ui--precision-custom-cursor)
    - [Electric Blue Hardware-Locked Cursor & Comet Tail Canvas](#electric-blue-hardware-locked-cursor--comet-tail-canvas)
    - [Interactive Portals: Coordinator, Admin, Signage TV & Slides](#interactive-portals-coordinator-admin-signage-tv--slides)
12. [Zero-Lag Hardening & Performance Engineering (October 2026)](#12-zero-lag-hardening--performance-engineering-october-2026)
    - [Graph Visualizer Kinetic Energy Sleep](#graph-visualizer-kinetic-energy-sleep)
    - [Persistent SVG Element In-Place Caching](#persistent-svg-element-in-place-caching)
    - [WebSocket Event Render Debouncing](#websocket-event-render-debouncing)
13. [Complete Backend REST & WebSocket API Catalog](#13-complete-backend-rest--websocket-api-catalog)
14. [Complete Codebase File Tree](#14-complete-codebase-file-tree)
15. [End-to-End Live Demo Execution Guide](#15-end-to-end-live-demo-execution-guide)
16. [Master Changelog & Engineering History](#16-master-changelog--engineering-history)

---

## 1. Executive Summary & Problem Statement

### The Problem in Large-Scale Event Management
Conferences, trade summits, and hackathons frequently suffer from catastrophic room dynamics:
- **Unannounced Capacity Breaches & Stampede Hazards**: High-demand keynote sessions routinely exceed hall fire ratings (e.g. 240+ attendees cramming into a 150-seat room).
- **Delayed Intervention**: Coordinators rely on manual badge scans, walkie-talkies, or attendee complaints, reacting 20–40 minutes after fire hazards or door blocking occur.
- **Manual Rescheduling Bottlenecks**: Swapping halls requires manual calendar re-coordination, contacting AV staff, updating attendees, and changing signage—causing cascading delays across the entire venue.
- **Privacy & Bandwidth Bottlenecks**: Traditional video systems require expensive RTSP camera installations streaming high-res footage to cloud GPUs, violating attendee facial privacy (GDPR / Indian DPDP Act) and choking local Wi-Fi.

### The DELTA ENGINE Solution
DELTA ENGINE is an autonomous, physical-first operating system for live event venues:
1. **Physical IoT Laser Tripwire**: Dual laser Time-of-Flight sensors on doorways track bi-directional human passage (Entry $+1$, Exit $-1$) with millimeter precision at under 15ms latency.
2. **Edge Computer Vision HUD**: In-browser edge facial and crowd motion tracking computes room occupancy, Eulerian crowd flux, and stampede risks with 100% on-device privacy (no raw video leaves the client).
3. **Autonomous Self-Healing Swarm**: When live physical occupancy exceeds room capacity, a heterogeneous Groq LLM agent swarm instantly detects the breach, negotiates venue reallocation, shifts schedules, and dispatches automated WhatsApp, email, and live voice alerts.
4. **Studio-Grade PA Voice Announcer**: An autonomous voice announcer with a calm, intellectual "Nico Robin" (One Piece) character persona broadcasts reassuring safety notices over the venue sound system.
5. **2-Way Volunteer WhatsApp Webhook**: Volunteers can text status commands (`GATE CLEAR`, `OVERFLOW OPEN`, `AUTOPILOT ON/OFF`) directly from WhatsApp to control the venue command center in real time.

---

## 2. End-to-End System Architecture

```
                                  PHYSICAL WORLD
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
     [VL53L0X Laser 1]                                     [VL53L0X Laser 2]
     (Entry Sensor - D21/D22)                              (Exit Sensor - RX2/TX2)
             │                                                     │
             └──────────────────────────┬──────────────────────────┘
                                        ▼
                           [ESP32 Microcontroller]
                  - Directional State Machine (Entry vs Exit)
                  - Real-Time Laser Radar (15ms cycle)
                  - Noise Filter (3.5cm - 15cm trigger zone)
                  - Clean JSON Serial Stream @ 115200 baud
                                        │ (USB Virtual COM / COM7)
                                        ▼
                        [door_serial_bridge.py Bridge]
                  - Reads USB Serial JSON
                  - POSTs to http://localhost:3000/api/sensors/door
                                        │ (HTTP REST)
                                        ▼
                           [DELTA Engine Backend Server]
                  - Node.js + Express.js + WebSocket Server
                  - Updates live hall occupancy state in In-Memory Graph
                  - Broadcasts ROOM_OCCUPANCY_UPDATE to clients
                  - Checks: Is Occupancy > Hall Capacity?
                                        │
                   ┌────────────────────┴────────────────────┐
                   │ (If Capacity Exceeded: e.g. >150 pax)   │ (Normal)
                   ▼                                         ▼
         [runSelfHealingAgent()]                    [WebSocket Broadcast]
                   │                                         │
                   ▼                                         ▼
        [Groq Multi-Agent Swarm]                    [Live Coordinator UI]
   - Liaison Agent (llama-3.1-8b)                   - Turing Hall turns RED
   - Scheduler Agent (llama-3.3-70b)                - Real-time Headcount HUD
   - Logistics Agent (llama-3.3-70b)                - Audible Alarm Modal Pops
   - Marketing Agent (llama-3.1-8b)                 - Custom Electric Blue Cursor
                   │                                         │
                   ├─────────────────────────────────────────┤
                   ▼                                         ▼
       [Automated Reallocation]                 [Multi-Modal Dispatch]
   - Swaps Talk to Lovelace Suite (250 cap)    - Automated WhatsApp Alert (Twilio)
   - Updates In-Memory Graph Database          - Supabase HTML Email Alert
   - Emits RESOLUTION_REPORT to UI             - iCal .ics Calendar Feed Update
   - Nico Robin PA Voice Announcement          - Gemini 3.8 Flash Risk Audit
   - 2-Way Volunteer WhatsApp Control          - Digital Signage TV Screen Update
```

---

## 3. Physical IoT Edge Perception System

### Hardware Bill of Materials (BOM)
| Component | Specification | Function |
| :--- | :--- | :--- |
| **Microcontroller** | ESP32-WROOM-32 (30-pin DevKit V1) | Core edge compute, dual I2C controllers, USB serial |
| **Laser Distance Sensor 1** | STMicroelectronics VL53L0X (GY-530) | Entry optical trigger (Time-of-Flight 940nm laser) |
| **Laser Distance Sensor 2** | STMicroelectronics VL53L0X (GY-530) | Exit optical trigger (Time-of-Flight 940nm laser) |
| **Breadboard** | Half-size 400-point solderless breadboard | Power and signal distribution rail |
| **Jumpers** | 10x Female-to-Male Dupont wires | Connections between ESP32 and breadboard |
| **USB Cable** | Micro-USB to USB-A Data Sync Cable | Power supply and 115200 baud serial communication |
| **USB-UART Driver** | Silicon Labs CP210x Driver (`COM7`) | Serial interface bridge to Windows OS |

### Electrical Pinout & Wiring Matrix

```
       ESP32 Dev Module (COM7)
       ┌─────────────────────┐
       │                 3V3 ├────────► Breadboard RED (+) Rail ────┬──► Sensor 1 VIN
       │                 GND ├────────► Breadboard BLUE (-) Rail ───┼──► Sensor 1 GND
       │                     │                                      ├──► Sensor 2 VIN
       │        (I2C-0)      │                                      └──► Sensor 2 GND
       │         GPIO 22 SCL ├─────────────────────────────────────────► Sensor 1 SCL
       │         GPIO 21 SDA ├─────────────────────────────────────────► Sensor 1 SDA
       │                     │
       │        (I2C-1)      │
       │    GPIO 17 [TX2] SCL├─────────────────────────────────────────► Sensor 2 SCL
       │    GPIO 16 [RX2] SDA├─────────────────────────────────────────► Sensor 2 SDA
       │                     │
       │              GPIO 2 ├──[Onboard Blue Indicator LED]
       └─────────────────────┘
```

#### Detailed Pin Connection Table
| Device | Pin Label | Connected To | Description |
| :--- | :--- | :--- | :--- |
| **ESP32** | `3V3` (Pin 15) | Breadboard Red Rail (`+`) | 3.3V Regulated DC Power Supply |
| **ESP32** | `GND` (Pin 14) | Breadboard Blue Rail (`-`) | Ground Reference |
| **Sensor 1 (Entry)** | `VIN` | Breadboard Red Rail (`+`) | Sensor Power (3.3V) |
| **Sensor 1 (Entry)** | `GND` | Breadboard Blue Rail (`-`) | Sensor Ground |
| **Sensor 1 (Entry)** | `SCL` | ESP32 `D22` (GPIO 22) | Hardware I2C Bus 0 Clock |
| **Sensor 1 (Entry)** | `SDA` | ESP32 `D21` (GPIO 21) | Hardware I2C Bus 0 Data |
| **Sensor 2 (Exit)** | `VIN` | Breadboard Red Rail (`+`) | Sensor Power (3.3V) |
| **Sensor 2 (Exit)** | `GND` | Breadboard Blue Rail (`-`) | Sensor Ground |
| **Sensor 2 (Exit)** | `SCL` | ESP32 `TX2` (GPIO 17) | Hardware I2C Bus 1 Clock |
| **Sensor 2 (Exit)** | `SDA` | ESP32 `RX2` (GPIO 16) | Hardware I2C Bus 1 Data |

### Dual Hardware I2C Architecture
- **The Address Conflict Problem**: All STMicroelectronics VL53L0X breakout boards ship hardcoded with factory I2C address `0x29`. Standard microcontrollers with only one I2C bus cannot address two identical sensors without toggling their physical `XSHUT` pins sequentially on boot.
- **The ESP32 Advantage**: The ESP32 contains **two independent hardware I2C peripherals**:
  - `Wire` (I2C Controller 0): Bound to GPIO 21 (`SDA`) and GPIO 22 (`SCL`).
  - `Wire1` (I2C Controller 1): Bound to GPIO 16 (`RX2`) and GPIO 17 (`TX2`).
- **Result**: Both sensors operate simultaneously at default address `0x29` on separate buses without requiring any `XSHUT` control pins or address remapping routines.

### Firmware Implementation (`DELTA_Door_Counter.ino`)
The firmware located at [`hardware/DELTA_Door_Counter/DELTA_Door_Counter.ino`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/hardware/DELTA_Door_Counter/DELTA_Door_Counter.ino) implements:
1. **Directional Passage State Machine**:
   - **Entry**: Sensor 1 triggered first $\rightarrow$ Sensor 2 triggered within 2 seconds = `ENTRY` (+1 headcount).
   - **Exit**: Sensor 2 triggered first $\rightarrow$ Sensor 1 triggered within 2 seconds = `EXIT` (-1 headcount).
   - **Timeout**: If an attendee steps halfway and walks back, the state resets to `IDLE` after 2000 ms.
2. **Crash-Proof Guards & Fallback**:
   - Stores boolean flags `sensor1Online` and `sensor2Online`.
   - Never invokes `rangingTest()` on an uninitialized sensor (preventing NULL pointer dereferences).
   - If only one sensor is detected, it operates in **Single-Sensor Mode** as a passage detector.
3. **Auto-Pin Scanning Matrix**:
   - Automatically scans pin permutations `(21, 22)`, `(22, 21)`, `(21, 23)`, `(23, 21)`, `(22, 23)` to accommodate wire swaps automatically.
4. **Tuned Optics & Noise Floor**:
   - `DISTANCE_THRESHOLD_MM = 150` (15 cm trigger zone).
   - `MIN_DISTANCE_MM = 35` (3.5 cm crosstalk suppression).
   - 15 ms ultra-low latency sampling loop (~60 Hz).
5. **Telemetry Stream**:
   - Serial output at `115200 baud`.
   - Continuous ASCII Radar visualization every 200 ms.
   - Clean JSON packets on crossing events:
     ```json
     {"event":"ENTRY","hallId":"hall-1","netOccupancy":1,"entries":1,"exits":0,"dist1":112,"dist2":98}
     ```

---

## 4. Hardware Troubleshooting Chronicle & Gotchas

During the bring-up of the physical hardware, five distinct electrical, firmware, and optical challenges were solved:

### Issue 1: Blank Serial Monitor on Boot
- **Symptom**: Arduino IDE successfully flashed the ESP32, but opening the Serial Monitor resulted in a blank black screen.
- **Root Cause**: The ESP32 reboots immediately upon flash completion via the RTS pin. By the time the user opens the Serial Monitor tab, the boot sequence has already executed. Because the code only prints on door crossings, the terminal remains silent.
- **Fix**: Press the physical **`EN`** (or **`RST`**) button on the ESP32 while the Serial Monitor is open to replay the boot diagnostic report.

### Issue 2: Pin Misplacement (D23 vs D21 silkscreen trap)
- **Symptom**: Serial Monitor reported: `Initializing Sensor 1 (Entry - GPIO 21/22)... ❌ FAILED! Check wiring on D21/D22.` while Sensor 2 was `✅ ONLINE`.
- **Root Cause**: On standard 30-pin ESP32 boards, the top-right pins are ordered:  
  `[D23] [D22] [TX0] [RX0] [D21]`.  
  The user had plugged the red wire into `D23` (corner pin) thinking it was adjacent to `D21`. In reality, `D22` was empty, and `D21` was four pins lower down. The ESP32 was driving clock signals into an empty pin.
- **Fix**: Relocated the red wire to `D22` and added an auto-pin scanner into the firmware that checks pin pairs dynamically.

### Issue 3: The Split Breadboard Power Rail Trap
- **Symptom**: Sensor 1 refused to respond on any pin combination (`❌ SENSOR 1 NOT RESPONDING ON ANY PINS (21, 22, 23)`).
- **Root Cause**: Inspection of user photos revealed that the ESP32's power input was plugged into the right side of the breadboard where Sensor 2 was mounted. Sensor 1 was mounted on the far left side. Half-size and full-size breadboards frequently have their **power rails physically split in the middle** without electrical continuity. Sensor 1 had 0.0 Volts.
- **Fix**: Moved Sensor 1's `VIN` and `GND` jumpers to the right side of the breadboard directly adjacent to Sensor 2's power terminals.

### Issue 4: ESP32 Guru Meditation Error Crash Loop
- **Symptom**: The ESP32 threw `Guru Meditation Error: Core 1 panic'ed (LoadProhibited) EXCVADDR: 0x00000040` every second, boot-looping continuously.
- **Root Cause**: When Sensor 1 failed initialization, the internal pointer in the `Adafruit_VL53L0X` library remained null (`0x00000000`). When `loop()` executed `sensor1.rangingTest(&measure1, false)`, the firmware attempted to read member offset `0x40` of a null object, crashing the RTOS kernel.
- **Fix**: Wrapped all measurement calls in boolean safety checks:
  ```cpp
  if (sensor1Online) {
    sensor1.rangingTest(&measure1, false);
    dist1 = (measure1.RangeStatus != 4) ? measure1.RangeMilliMeter : 9999;
  }
  ```
  Added graceful single-sensor mode fallback if one sensor is unplugged.

### Issue 5: The 2 cm (20 mm) Laser Self-Reflection Trap
- **Symptom**: Serial Monitor output showed Sensor 2 constantly reading `20 mm` (2 cm), triggering non-stop entry counts and beeping without any hand present.
- **Root Cause**: Two contributing factors:
  1. Factory protective optical film: VL53L0X sensors ship with an ultra-thin yellow/clear peel-off plastic film over the dual laser lenses. The 940nm laser bounced directly off the plastic 0.1mm away and saturated the SPAD receiver array.
  2. Dangling wires: Arched jumper wires hung directly in the sensor's 25-degree field-of-view cone.
- **Fix**:
  1. Peeled off the factory protective sticker from the tiny black sensor aperture.
  2. Routed jumper wires behind the sensor body.
  3. Added `#define MIN_DISTANCE_MM 35` to ignore any reading $<3.5$ cm as physical crosstalk.
  4. Tuned the target trigger zone to 3.5 cm – 15.0 cm (`#define DISTANCE_THRESHOLD_MM 150`).

---

## 5. IoT Serial-to-Web Bridge (`door_serial_bridge.py`)

The bridge script at [`hardware/door_serial_bridge.py`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/hardware/door_serial_bridge.py) establishes bidirectional communication between the microcontroller and the web operating system:

```python
# Core logic snippet
PORT = "COM7"
BAUD_RATE = 115200
API_URL = "http://localhost:3000/api/sensors/door"

# Automatic COM port discovery matching CP210x UART
def find_esp32_port():
    ports = serial.tools.list_ports.comports()
    for p in ports:
        if "CP210" in p.description or "UART" in p.description or "COM7" in p.device:
            return p.device
    return PORT
```

### Operational Capabilities
- Filters debug lines from structured JSON payloads.
- Automatically handles reconnection if the USB cord is cycled.
- Emits terminal alerts when capacity breaches trigger self-healing:
  ```text
  🟢 [ENTRY] Net Occupancy: 151 | Dist1: 85mm | Dist2: 92mm
  🔥 [DELTA SELF-HEALING TRIGGERED] Capacity overshoot detected! Reallocating room...
  ```

---

## 6. Multi-Modal CCTV Room Perception & Crowd Dynamics Engine

DELTA ENGINE features a complete in-browser computer vision pipeline located in [`frontend/components/cctvPerception.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/cctvPerception.js), designed to operate with standard webcams and USB cameras (e.g. Zebronics ZEB-CRYSTAL PRO 480p):

### Optical Metrics & Eulerian Flow Physics
- **Headcount Detection**: Uses WebAssembly `pico.js` (`facefinder.js`) for frontal facial detection and person tracking.
- **Eulerian Crowd Motion Vectors**: Splits video frames into a 16x12 spatial grid to calculate optical velocity vectors ($\vec{v} = (\Delta x, \Delta y)$), identifying directional flow across aisles.
- **Counter-Flow Stream Collision Detection**: Detects opposing crowd streams traveling against each other in narrow corridors, triggering pre-crush alerts.
- **Stampede & Crowd Crush Risk Index ($0–100\%$)**:
  $$\text{Risk} = f(\text{Density}, \text{Turbulence}, \text{Mean Velocity}, \text{Chokepoint Saturation})$$
  Evaluated dynamically in real time.

### Barricade Pressure PSI & Automated Emergency Gate Release
- Measures simulated physical crowd pressure at exit barricades and gates.
- When barricade pressure reaches **$\ge 8.5\text{ PSI}$**, the vision engine fires an automated emergency pulse to `/api/sensors/door` with action `EMERGENCY_RELEASE`, disengaging magnetic door locks on Gates A & B and playing an emergency audible tone.

### Decoupled Vision Throttling & 60 FPS Zero-Lag Pipeline
- **Problem**: Calling `ctx.getImageData()` synchronously on 320x240 canvases at 60 FPS saturated the browser's UI thread with 307KB GPU readbacks every 16ms, creating cursor lag.
- **Solution**: The video canvas rendering remains locked at a buttery 60 FPS, while heavy vision analysis (Pico cascades, Eulerian matrix math, DOM writes) is throttled to run every **75 ms (~13.3 FPS)**. Results are cached and rendered between ticks, completely eliminating main-thread freezing.

---

## 7. Autonomous Voice Announcer Subsystem (`voiceAnnouncer.js`)

Located in [`backend/components/voiceAnnouncer.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/voiceAnnouncer.js), this subsystem provides venue-wide public address voice broadcasting:

### Nico Robin Character Persona & ElevenLabs Flash v2.5
- Modeled after **Nico Robin** from *One Piece*—a calm, composed, elegant, and intellectual female voice that reassures attendees during emergencies rather than causing panic.
- Uses ElevenLabs `eleven_flash_v2_5` with voice ID `EXAVITQu4vr4xnSDxMaL` (Sarah), tuned with:
  - `stability: 0.72` (serene, composed delivery)
  - `similarity_boost: 0.85` (velvety vocal resonance)
  - `style: 0.20` (intellectual, unhurried cadence)
- Phrases announcements with archaeological and composed intellectual phrasing (e.g., *"Attention scholars and attendees. A gentle room reallocation is now in progress..."*).

### Low-Latency Caching & Multi-Tier Fallbacks
1. **MD5 Audio Cache**: Hashes `voiceId + cleanText` to serve repetitive venue alerts in **$<1\text{ ms}$** from `frontend/audio_announcements/cache_{hash}.mp3`.
2. **Local Audio Fallback**: If ElevenLabs API key is absent or offline, instantly serves `frontend/announcement_test.mp3`.
3. **Web Speech API Client Fallback**: Client-side synthesis triggers if audio files cannot play.

---

## 8. Google Gemini 3.8 Flash Venue Reasoning Auditor (`geminiAuditor.js`)

Located in [`backend/components/geminiAuditor.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/geminiAuditor.js):
- Ingests real-time multi-hall occupancy telemetry, door passage rates, and active conflict flags.
- Employs **Google Gemini 3.8 Flash** (`gemini-3.8-flash` / `gemini-3.5-flash`) via REST API to perform a cognitive audit of crowd dynamics.
- Returns structured JSON containing:
  - `safetyRating`: `A+`, `A`, `B`, `C`, or `CRITICAL`
  - `riskLevel`: `LOW`, `ELEVATED`, `HIGH`, `CRITICAL`
  - `bottleneckIdentified`: Detailed description of the crowd chokepoint
  - `aiSummary`: Executive reasoning behind current venue conditions
  - `recommendedActions`: Bulleted list of immediate operational mitigations
  - `paAnnouncementScript`: Script composed dynamically for the Nico Robin PA voice announcer.
- Includes `auditVisualSceneWithGemini()` to analyze captured base64 CCTV camera frames and autonomously verify room states.

---

## 9. Multi-Agent Groq Self-Healing Swarm

When a capacity threshold is breached, DELTA ENGINE invokes a specialized 4-agent swarm powered by Groq's low-latency inference:

```
                          [Disruption Detected]
                         (Occupancy: 151 / 150)
                                    │
                                    ▼
                      ┌───────────────────────────┐
                      │    🗣️ Liaison Agent       │
                      │  (llama-3.1-8b-instant)   │
                      └─────────────┬─────────────┘
                                    │ Assesses urgency & synthesizes incident telemetry
                                    ▼
                      ┌───────────────────────────┐
                      │    ⏱️ Scheduler Agent     │
                      │ (llama-3.3-70b-versatile) │
                      └─────────────┬─────────────┘
                                    │ Evaluates hall capacities & speaker dependencies
                                    ▼
                      ┌───────────────────────────┐
                      │    🏛️ Logistics Agent     │
                      │ (llama-3.3-70b-versatile) │
                      └─────────────┬─────────────┘
                                    │ Selects Lovelace Suite (Cap: 250); adjusts AV/HVAC
                                    ▼
                      ┌───────────────────────────┐
                      │    📢 Marketing Agent     │
                      │  (llama-3.1-8b-instant)   │
                      └─────────────┬─────────────┘
                                    │ Composes attendee notices & updates calendar feeds
                                    ▼
                      [Self-Healing Resolution Dispatched]
```

### Self-Healing Swarm Output Example
- **Initial State**: Topic "Quantum Computing Frontiers" scheduled in *Turing Auditorium* (Capacity: 150).
- **Physical Ingress**: IoT Door sensor reaches 151 attendees.
- **Swarm Resolution**:
  - Reallocates "Quantum Computing Frontiers" to *Lovelace Suite* (Capacity: 250).
  - Shifts low-density talk "Intro to WebAssembly" (Occupancy: 42) into *Turing Auditorium*.
  - Generates updated `.ics` calendar invite with revised room metadata.
  - Sends automated WhatsApp notification to stage coordinators.
  - Triggers the Nico Robin PA voice announcement.

---

## 10. Communications Fabric & 2-Way Volunteer WhatsApp Webhook

### Real-Time WhatsApp Integration (`twilioDispatcher.js`)
- Supports **Twilio Programmable Messaging API** for automated alerts.
- If live credentials are in sandbox mode, gracefully provides one-click `https://wa.me/` direct chat intents.
- Direct recipient routing for key leads:
  - **Aryan Pandey** (Lead Coordinator): `+91 91542 76178`
  - **Suryansh** (Crowd & Safety Lead): `+91 83030 09159`
  - **Shahid** (Stage & Ops Lead): `+91 63035 70916`

### 2-Way Volunteer Control Webhook (`/api/whatsapp/incoming`)
Volunteers on the floor can text commands straight to the DELTA Engine WhatsApp number to control the system without opening a browser:
- **`GATE CLEAR`**: Clears chokepoint alerts, resetting hall alert status to `NOMINAL`.
- **`OVERFLOW OPEN`**: Activates overflow lounge and adjusts hall capacity limits.
- **`AUTOPILOT ON` / `AUTOPILOT OFF`**: Toggles Tesla-style autonomous self-healing mode.
- **`STATUS`**: Receives an instant headcount and capacity telemetry report.

---

## 11. Frontend Portals, Neomorphic UI & Precision Custom Cursor

### Electric Blue Hardware-Locked Cursor & Comet Tail Canvas
Located in [`frontend/components/customCursor.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/customCursor.js):
- **Precision Apex Anchor**: SVG pointer position is offset by `(-2px, -2px)` so the click target perfectly aligns with the tip of the arrow.
- **Suppression of Duplicate Pointers**: Sets `pointer-events: none` and handles all hoverables without showing default browser fingers beside the custom cursor.
- **Interactive Micro-Interactions**: Scales smoothly (`scale(1.25)`) and enhances glow with `box-shadow` when hovering over buttons, cards, and links.
- **Comet Tail Canvas with Kinetic Idle Sleep**: A high-speed canvas draws fading meteor comet particles behind the cursor. When the mouse stops moving for 80ms, the particles decay and the loop **shuts down completely** (0% CPU/GPU idle usage), waking instantly on `mousemove`.

### Interactive Portals
1. **Coordinator Command Center (`index.html`)**: Live schedule grid, dynamic hall occupancy bars, drag-and-drop talk rearrangement (`dragdrop.js`), force-directed graph visualizer, and live multi-agent chat stream.
2. **Super Admin Dashboard (`admin.html`)**: Token usage counters, AI circuit breakers, database freeze toggles, 500-scenario concurrency stress tester (`stressTester.js`), and live dispatch telemetry.
3. **Digital Signage TV Screen (`signage.html`)**: Full-screen kiosk layout with ambient video backdrop (`SIGNAGE_TV.mp4`), real-time session timetables, and emergency banner overrides.
4. **Presentation Deck (`presentation.html`)**: Pitch deck engineered directly in HTML/CSS for hackathon judging.

---

## 12. Zero-Lag Hardening & Performance Engineering (October 2026)

To guarantee that DELTA ENGINE maintains a solid 60 FPS and zero mouse stutter under high load:

### Graph Visualizer Kinetic Energy Sleep
- **Previous Bottleneck**: `physicsTick()` in `graphVisualizer.js` ran an infinite 60 FPS animation loop, recalculating repulsion and attraction physics indefinitely.
- **Optimization**: Implemented kinetic energy monitoring:
  ```javascript
  const totalMotion = nodes.reduce((sum, n) => sum + Math.abs(n.vx) + Math.abs(n.vy), 0);
  if (totalMotion < 0.12) {
    isPhysicsRunning = false;
    physicsAnimFrameId = null;
    return; // Sleep!
  }
  ```
  The simulation automatically sleeps when nodes settle into equilibrium (0% CPU). It wakes up only when a node is dragged or the graph structure updates (`wakePhysicsSimulation()`).

### Persistent SVG Element In-Place Caching
- **Previous Bottleneck**: `drawGraphSVG()` executed `svg.innerHTML = ''` every 16ms, creating and destroying ~4,800 DOM nodes per second. This triggered massive V8 Garbage Collector stop-the-world pauses (100–300ms freeze spikes).
- **Optimization**: Built persistent element caches (`domLinkMap`, `domNodeMap`). Nodes and lines are updated in-place via `setAttribute('x1', ...)`, `setAttribute('transform', ...)`. Stale nodes are culled only when removed from data. Result: **0 DOM allocations per second during rendering**.

### WebSocket Event Render Debouncing
- **Previous Bottleneck**: Rapid back-to-back WebSocket events (IoT door crossing + CCTV update + self-healing trigger) triggered multiple full UI re-renders within milliseconds.
- **Optimization**: Debounced `safeSyncUI()` using `requestAnimationFrame`, coalescing burst updates into a single render tick.

---

## 13. Complete Backend REST & WebSocket API Catalog

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/state` | Returns full event state (graph, schedule, volunteers, limits, uptime) |
| `POST` | `/api/sensors/door` | Primary IoT door crossing ingress (VL53L0X ToF laser telemetry) |
| `GET` | `/api/sensors/doors/mesh` | Returns status of all sensor tripwires across venue doorways |
| `POST` | `/api/sensors/camera` | Ingress for external Python OpenCV camera telemetry |
| `GET` | `/api/sensors/camera/latest` | Latest CCTV camera density and headcount readings |
| `POST` | `/api/sensors/face-passage` | Ingress for in-browser edge face detection crossing events |
| `POST` | `/api/voice/announce` | Triggers Nico Robin ElevenLabs venue audio synthesis or local fallback |
| `POST` | `/api/gemini/audit` | Invokes Google Gemini 3.8 Flash for crowd reasoning & safety rating |
| `POST` | `/api/cctv/gemini-scene-audit` | Audits captured camera base64 frames via Gemini Vision |
| `POST` | `/api/notify/whatsapp` | Sends single WhatsApp notification via Twilio API / Click-to-Chat |
| `POST` | `/api/notify/whatsapp-all` | Broadcasts WhatsApp alert to Aryan, Suryansh, and Shahid |
| `POST` | `/api/whatsapp/incoming` | 2-Way volunteer WhatsApp webhook (`GATE CLEAR`, `AUTOPILOT ON/OFF`) |
| `POST` | `/api/notify/speaker-email` | Dispatches transactional schedule update email to speaker |
| `POST` | `/api/notify/email` | Dispatches transactional alert email to coordinator |
| `POST` | `/api/schedule/move` | Moves or swaps talk slots across halls in the graph database |
| `POST` | `/api/schedule/set-date` | Sets active conference day (Day 1 / Day 2 / Day 3) |
| `POST` | `/api/reset` | Resets schedule and graph database to initial pristine state |
| `POST` | `/api/simulate/delay` | Simulates a speaker delay in a designated hall |
| `POST` | `/api/simulate/capacity` | Simulates a sudden capacity surge in a designated hall |
| `POST` | `/api/sim/mass-disruption` | Simulates simultaneous cascading failures across all 3 halls |
| `POST` | `/api/simulate/sentiment` | Simulates attendee sentiment fluctuations |
| `POST` | `/api/upload-slides` | Multi-part upload for speaker PPTX/PDF presentation slides |
| `GET` | `/api/calendar/feed.ics` | Dynamically generated iCalendar `.ics` live subscription feed |
| `GET` | `/api/groq/status` | Checks Groq LLM API connectivity and latency |
| `POST` | `/api/groq/set-key` | Dynamically updates Groq API key at runtime |
| `POST` | `/api/admin/toggle-autopilot` | Toggles autonomous self-healing mode |
| `POST` | `/api/admin/toggle-limiter` | Toggles database write freeze or AI token circuit breaker |
| `POST` | `/api/admin/stress-test-500` | Executes 500-scenario micro-benchmark conflict resolution in $<30$ms |
| `GET` | `/api/system/integrations` | Checks operational status of Supabase, Twilio, ElevenLabs, Gemini |

---

## 14. Complete Codebase File Tree

```
DELTAengine-main/
├── .env                                # API keys (GROQ, ELEVENLABS, GEMINI, TWILIO, SUPABASE)
├── .env.example                        # Template environment variables
├── .gitignore                          # Standard git ignore definitions
├── package.json                        # Root package manifest & scripts
├── README.md                           # Primary GitHub repository overview
├── PROJECT_CONTEXT.md                  # THIS FILE — Master technical dossier
├── PROJECT_CONTEXT_FOR_CHATGPT.md      # Compact LLM prompt context file
├── PROJECT_CHANGELOG.md                # Exhaustive changelog of every addition and modification
├── generate_deck.py                    # Script generating presentation assets
├── backend/
│   ├── server.js                       # Express app, WebSocket server, IoT door & REST routes
│   └── components/
│       ├── agentSwarm.js               # Groq LLM Swarm (Liaison, Scheduler, Logistics, Marketing)
│       ├── selfHealing.js              # Deterministic conflict solver & swarm orchestrator
│       ├── graphDb.js                  # In-memory topological graph for halls, topics, speakers
│       ├── voiceAnnouncer.js           # Nico Robin PA voice announcer (ElevenLabs + Web Speech)
│       ├── geminiAuditor.js            # Google Gemini 3.8 Flash venue reasoning auditor
│       ├── twilioDispatcher.js         # Twilio WhatsApp & SMS dispatcher
│       ├── security.js                 # Rate limiter, HTML escaping, file validation
│       ├── supabaseDb.js               # Supabase persistence loader
│       └── supabaseEmailIntegrator.js  # Transactional email dispatcher with anti-spam
├── frontend/
│   ├── index.html                      # Coordinator Dashboard (Schedule, Matrix, Graph, Chat)
│   ├── admin.html                      # Super Admin Command Center (Circuit breakers, Stress test)
│   ├── login.html                      # Auth Landing Page with 1-Click fast-track bypass
│   ├── signage.html                    # Fullscreen digital signage TV kiosk portal
│   ├── presentation.html               # Live interactive presentation slide deck
│   ├── app.css                         # Neomorphic & Neubrutalist design stylesheet
│   ├── announcement_test.mp3           # Local audio fallback for PA voice announcements
│   ├── audio_announcements/            # Cached Nico Robin voice MP3 files
│   └── components/
│       ├── app.js                      # Core UI orchestrator & event listeners
│       ├── auth.js                     # Authentication & role-based access management
│       ├── cctvPerception.js           # Decoupled 60 FPS vision engine & crowd HUD
│       ├── customCursor.js             # Electric Blue hardware-locked cursor & comet tail canvas
│       ├── graphVisualizer.js          # Kinetic-sleeping force-directed SVG graph visualizer
│       ├── dragdrop.js                 # HTML5 schedule drag-and-drop controller
│       ├── tourGuide.js                # Interactive docked sidebar walkthrough
│       ├── websockets.js               # Real-time WebSocket pub/sub client with debounce
│       ├── contentPipeline.js          # Presentation slide upload & metadata parser
│       ├── stressTester.js             # 500-scenario micro-benchmark concurrency runner
│       ├── pico.js                     # WebAssembly frontal face detection cascade
│       └── facefinder.js               # Face cascade runtime weights
└── hardware/
    ├── DELTA_Door_Counter/
    │   └── DELTA_Door_Counter.ino      # ESP32 Dual VL53L0X firmware with auto-pin scanner
    ├── drivers/
    │   ├── CP210x_Windows_Driver/      # Silicon Labs CP210x USB-to-UART driver files
    │   └── install_cp210x_driver.bat   # 1-Click driver installer
    ├── door_serial_bridge.py           # USB Serial COM7 -> HTTP REST API bridge
    └── cctv_occupancy_vision.py        # Python OpenCV camera density perception script
```

---

## 15. End-to-End Live Demo Execution Guide

### Step 1: Start the Backend Server
```powershell
npm start
```
*Expected Output*: `[DELTA ENGINE] Running on http://localhost:3000`

### Step 2: Open the Dashboard
Navigate to `http://localhost:3000/index.html` in your browser.
- Verify the Electric Blue cursor glides smoothly with a glowing comet tail.
- Notice *Turing Auditorium* shows `Occupancy: 0 / 150`.

### Step 3: Trigger Autonomous Self-Healing Demo
Simulate 152 people entering Turing Hall (capacity 150):
```powershell
curl -X POST http://localhost:3000/api/sensors/door `
  -H "Content-Type: application/json" `
  -d '{\"event\":\"ENTRY\",\"hallId\":\"hall-1\",\"netOccupancy\":152,\"entries\":155,\"exits\":3}'
```
**Instant Results**:
1. Central modal pops with audible alert tone.
2. Nico Robin PA voice announces: *"Attention attendees. A gentle room reallocation is now in progress..."*
3. Groq Swarm executes in $<2.5$ seconds, moving the talk to *Lovelace Suite*.
4. WhatsApp notice dispatches to Aryan, Suryansh, and Shahid.
5. The graph visualizer updates and automatically goes to sleep once nodes settle.

---

## 16. Master Changelog & Engineering History

### Version 3.4 (October 2026) — Zero-Lag Hardening & Perception Optimization
- **Added**: Kinetic energy sleep check (`totalMotion < 0.12`) in [`graphVisualizer.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/graphVisualizer.js). Graph physics simulation sleeps at 0% CPU once nodes stabilize.
- **Added**: In-place SVG element caching (`domLinkMap`, `domNodeMap`) replacing destructive `svg.innerHTML = ''`, completely eliminating V8 Garbage Collection lag freezes.
- **Added**: Decoupled computer vision tick in [`cctvPerception.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/cctvPerception.js). Heavy `getImageData()`, Pico cascades, and Eulerian crowd calculations now run on a 75ms throttled tick while video canvas renders at 60 FPS.
- **Added**: WebSocket render debouncing in [`websockets.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/websockets.js) using `requestAnimationFrame`.
- **Added**: Idle sleep state in [`customCursor.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/components/customCursor.js) for the comet tail canvas when the mouse is stationary.
- **Fixed**: Eliminated browser double-pointer displaying default hand cursor alongside custom pointer on card hovers.
- **Fixed**: Aligned custom cursor click anchor to top apex (`top: -2px, left: -2px`).

### Version 3.3 (October 2026) — Multi-Modal Audio & AI Auditor
- **Added**: [`voiceAnnouncer.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/voiceAnnouncer.js) with ElevenLabs Flash v2.5 synthesis, "Nico Robin" (One Piece) character persona, local MD5 caching, and browser Web Speech fallback.
- **Added**: [`geminiAuditor.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/geminiAuditor.js) with Google Gemini 3.8 Flash real-time venue crowd reasoning and automated PA script composition.
- **Added**: [`twilioDispatcher.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/components/twilioDispatcher.js) and 2-way volunteer command webhook at `/api/whatsapp/incoming` (`GATE CLEAR`, `OVERFLOW OPEN`, `AUTOPILOT ON/OFF`).
- **Added**: Digital Signage TV portal at [`frontend/signage.html`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/frontend/signage.html).

### Version 3.2 (September 2026) — Zebronics 480p CCTV Perception & Crowd Physics
- **Added**: Barricade pressure PSI sensor model with automated emergency gate release pulse.
- **Added**: Eulerian crowd motion vector matrix and counter-flow collision detection.
- **Added**: Mega-crowd stampede risk index ($0–100\%$).

### Version 3.1 (September 2026) — Physical IoT Hardware & Dual I2C
- **Added**: Dual VL53L0X ToF laser doorway counter on ESP32 (`Wire` on D21/D22, `Wire1` on RX2/TX2).
- **Added**: Single-sensor fallback mode and auto-pin scanner matrix.
- **Added**: Python serial-to-REST bridge (`door_serial_bridge.py`).

---
*Authored & Maintained by Antigravity for Team DELTA • HackIndia Spark 2026*
