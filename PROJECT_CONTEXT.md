# ⚡ DELTA ENGINE — Complete Technical Context & Architecture Dossier

> **Project**: DELTA ENGINE (Autonomous Self-Healing Event Operating System)  
> **Hackathon**: HackIndia Spark 2026 — South Central Region (Hyderabad, Telangana)  
> **Repository**: [aryanpandeyspec-cyber/DELTAengine](https://github.com/aryanpandeyspec-cyber/DELTAengine)  
> **Last Updated**: September 2026  

---

## 📋 Table of Contents
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Physical IoT Edge Perception System](#3-physical-iot-edge-perception-system)
   - [Hardware Bill of Materials (BOM)](#hardware-bill-of-materials-bom)
   - [Electrical Pinout & Wiring Matrix](#electrical-pinout--wiring-matrix)
   - [Dual Hardware I2C Architecture](#dual-hardware-i2c-architecture)
   - [Firmware Implementation (`DELTA_Door_Counter.ino`)](#firmware-implementation-delta_door_counterino)
4. [Hardware Troubleshooting Chronicle & Gotchas (Full Chat Log Record)](#4-hardware-troubleshooting-chronicle--gotchas)
   - [Issue 1: Blank Serial Monitor on Boot](#issue-1-blank-serial-monitor-on-boot)
   - [Issue 2: Pin Misplacement (D23 vs D21 silkscreen trap)](#issue-2-pin-misplacement-d23-vs-d21-silkscreen-trap)
   - [Issue 3: The Split Breadboard Power Rail Trap](#issue-3-the-split-breadboard-power-rail-trap)
   - [Issue 4: ESP32 Guru Meditation Error Crash Loop](#issue-4-esp32-guru-meditation-error-crash-loop)
   - [Issue 5: The 2 cm (20 mm) Laser Self-Reflection Trap](#issue-5-the-2-cm-20-mm-laser-self-reflection-trap)
5. [IoT Serial-to-Web Bridge (`door_serial_bridge.py`)](#5-iot-serial-to-web-bridge-door_serial_bridgepy)
6. [Backend API & Autonomous Self-Healing Pipeline (`server.js`)](#6-backend-api--autonomous-self-healing-pipeline-serverjs)
7. [Multi-Model Groq Agentic Swarm](#7-multi-model-groq-agentic-swarm)
8. [Frontend Portals & Neomorphic UI](#8-frontend-portals--neomorphic-ui)
9. [Complete Codebase File Tree](#9-complete-codebase-file-tree)
10. [End-to-End Live Demo Execution Guide](#10-end-to-end-live-demo-execution-guide)

---

## 1. Executive Summary & Problem Statement

### The Problem in Large-Scale Event Management
Conferences and hackathons suffer from chaotic room dynamics:
- **Unannounced Capacity Breaches**: Keynote sessions frequently exceed hall fire capacities (e.g. 180 people crowding into a 150-seat hall).
- **Stale Information**: Coordinators rely on manual badge scans, walkie-talkies, or attendee complaints, reacting 20–40 minutes after fire hazards or overcrowding occur.
- **Manual Rescheduling Bottlenecks**: Swapping halls requires manual calendar re-coordination, contacting AV staff, updating attendees, and changing signage—causing cascading delays.

### The DELTA ENGINE Solution
DELTA ENGINE bridges physical space with an agentic AI operating system:
1. **Physical IoT Laser Tripwire**: Dual laser Time-of-Flight sensors on doorways track bi-directional human passage (Entry $+1$, Exit $-1$) with millimeter precision.
2. **Edge-to-Cloud Telemetry**: A high-speed Python serial bridge relays real-time headcounts to the DELTA Engine server via WebSockets.
3. **Autonomous Self-Healing Swarm**: When live physical occupancy exceeds room capacity, a heterogeneous Groq LLM agent swarm instantly detects the breach, negotiates venue reallocation, shifts schedules, and dispatches automated WhatsApp and email alerts.

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
                  - Updates live hall occupancy state
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
   - Marketing Agent (llama-3.1-8b)                          │
                   │                                         │
                   ├─────────────────────────────────────────┤
                   ▼                                         ▼
       [Automated Reallocation]                 [Multi-Channel Dispatch]
   - Swaps Talk to Lovelace Suite (250 cap)    - Automated WhatsApp Alert
   - Updates In-Memory Graph Database          - Supabase HTML Email Alert
   - Emits RESOLUTION_REPORT to UI             - iCal .ics Calendar Feed Update
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

## 6. Backend API & Autonomous Self-Healing Pipeline (`server.js`)

Located in [`backend/server.js`](file:///d:/DESKTOP/Desktop/HACKATHONS/DELTAengine-main/backend/server.js), the `/api/sensors/door` endpoint handles real-time IoT ingress:

### Request Schema
```http
POST /api/sensors/door
Content-Type: application/json

{
  "event": "ENTRY",
  "hallId": "hall-1",
  "netOccupancy": 151,
  "entries": 154,
  "exits": 3,
  "dist1": 85,
  "dist2": 92
}
```

### Ingress & Breach Handler Logic
```javascript
app.post('/api/sensors/door', async (req, res) => {
  const { event, hallId, netOccupancy, entries, exits } = req.body;
  const targetHallId = hallId || 'hall-1';
  const hall = db.graph.halls[targetHallId] || { name: 'Turing Auditorium', capacity: 150 };
  const occupancy = parseInt(netOccupancy, 10) || 0;

  // 1. Broadcast real-time telemetry to all connected WebSocket clients
  broadcast({
    type: 'ROOM_OCCUPANCY_UPDATE',
    data: {
      hallId: targetHallId,
      hallName: hall.name,
      capacity: hall.capacity,
      occupancy: occupancy,
      entries: entries || 0,
      exits: exits || 0,
      event: event || 'ENTRY',
      timestamp: new Date().toLocaleTimeString()
    }
  });

  // 2. Autonomous Breach Evaluation
  if (occupancy > hall.capacity) {
    const activeTopicId = db.schedule['slot-1'][targetHallId];
    if (activeTopicId && db.graph.topics[activeTopicId]) {
      const topic = db.graph.topics[activeTopicId];
      topic.interest = occupancy; // Dynamically scale topic weight to live headcount

      const eventDesc = `⚡ IoT Door Sensor: "${hall.name}" capacity breached! Live headcount ${occupancy} exceeds hall limit of ${hall.capacity}.`;
      
      // 3. Trigger Groq Multi-Agent Swarm
      const healingReport = await runSelfHealingAgent(eventDesc, db, broadcast);
      return res.json({ success: true, surgeTriggered: true, healingReport });
    }
  }

  res.json({ success: true, surgeTriggered: false });
});
```

---

## 7. Multi-Model Groq Agentic Swarm

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

---

## 8. Frontend Portals & Neomorphic UI

The web interface is engineered using Neubrutalist and Neomorphic aesthetics, high-contrast typography, and live WebSocket subscriptions:

1. **Login Portal (`login.html`)**:
   - Supabase OAuth integration (`signInWithOAuth`).
   - 1-Click Fast Track buttons for demonstration (`👤 Coordinator Demo`, `👑 Super Admin Demo`).
2. **Coordinator Command Center (`index.html`)**:
   - Live Event Matrix showing real-time hall occupancy bars (Green $\rightarrow$ Amber $\rightarrow$ Red Pulsing).
   - Drag-and-Drop interactive schedule re-ordering (`dragdrop.js`).
   - Dynamic Neo4j/In-Memory Graph Visualizer (`graphVisualizer.js`).
   - Real-Time Multi-Agent Swarm Chat feed with transparent reasoning chains.
   - Pop-up modal with audio siren upon autonomous self-healing events.
3. **Super Admin Command Center (`admin.html`)**:
   - Infrastructure Health & Telemetry Dashboard.
   - AI Token Circuit Breaker / Kill-Switch.
   - Database Write Freeze Toggle.
   - 500-Scenario Concurrency Stress Tester (executes in $<30$ ms).
   - Live WhatsApp & Email communication dispatch log.
4. **Live Presentation Deck (`presentation.html` & `generate_deck.py`)**:
   - Interactive slide deck built for hackathon judging panels.

---

## 9. Complete Codebase File Tree

```
DELTAengine/
├── .env                                # API keys (GROQ_API_KEY, SUPABASE_URL, PORT)
├── .gitignore                          # Ignores node_modules, logs, .env, mp4 files
├── package.json                        # Dependencies (express, ws, @supabase/supabase-js)
├── README.md                           # Primary HackIndia documentation & summary
├── PROJECT_CONTEXT.md                  # Comprehensive Technical Architecture & Hardware Dossier
├── generate_deck.py                    # Script generating presentation assets
├── backend/
│   ├── server.js                       # Express & WebSocket server, IoT door endpoint
│   ├── components/
│   │   ├── agentSwarm.js               # Groq LLM Swarm (Liaison, Scheduler, Logistics, Marketing)
│   │   ├── selfHealing.js              # Conflict solver & deterministic fallback engine
│   │   ├── graphEngine.js              # In-memory graph model for halls, topics, speakers
│   │   └── notificationService.js      # WhatsApp & Supabase email dispatch routines
│   └── data/
│       └── initialSchedule.json        # Default conference schedule & hall capacities
├── frontend/
│   ├── index.html                      # Coordinator Dashboard (Matrix, Chat, Graph)
│   ├── admin.html                      # Super Admin Command Center (Circuit breakers, Stress test)
│   ├── login.html                      # Supabase Auth Landing Page
│   ├── presentation.html               # Live interactive presentation slides
│   ├── app.css                         # Neomorphic / Neubrutalist design system
│   └── components/
│       ├── app.js                      # Core UI event orchestrator
│       ├── websockets.js               # Client WebSocket client & live occupancy listeners
│       ├── graphVisualizer.js          # Interactive canvas rendering of topic/hall graph
│       ├── dragdrop.js                 # HTML5 schedule drag-and-drop mechanics
│       └── tourGuide.js                # Docked 90-degree sidebar interactive walkthrough
└── hardware/
    ├── DELTA_Door_Counter/
    │   └── DELTA_Door_Counter.ino      # ESP32 Dual VL53L0X firmware with auto-pin detection
    └── door_serial_bridge.py           # USB Serial COM7 -> HTTP REST API bridge
```

---

## 10. End-to-End Live Demo Execution Guide

Follow these steps to demonstrate the complete IoT-to-AI self-healing workflow:

### Step 1: Start the Backend Server
```powershell
cd d:\DESKTOP\Desktop\HACKATHONS\DELTAengine-main
node backend/server.js
```
*Expected Output*: `[DELTA ENGINE] Running on http://localhost:3000`

### Step 2: Connect Hardware & Run the Serial Bridge
1. Plug the ESP32 into USB (`COM7`).
2. Close any open Serial Monitor windows in Arduino IDE (to free `COM7`).
3. Run the bridge:
```powershell
python hardware/door_serial_bridge.py
```
*Expected Output*:  
`📡 Connecting to ESP32 on: COM7 at 115200 baud`  
`✅ Serial connection established! Listening for door crossings...`

### Step 3: Open the Dashboard
Navigate to `http://localhost:3000/index.html` in your browser.
- Observe *Turing Auditorium* currently shows `Occupancy: 0 / 150`.

### Step 4: Trigger the Door Crossings
1. Wave your hand across **Sensor 1 $\rightarrow$ Sensor 2** (or Sensor 2 in Single-Sensor Mode) within the 15 cm zone.
2. The terminal will log:
   `🟢 [ENTRY] Net Occupancy: 1 | Dist1: 110mm | Dist2: 95mm`
3. The dashboard occupancy gauge updates in real time over WebSockets!

### Step 5: Trigger Autonomous Self-Healing Demo
To simulate an overflow breach during a pitch:
- Either continue crossing until occupancy exceeds 150, or run a test curl:
```powershell
curl -X POST http://localhost:3000/api/sensors/door -H "Content-Type: application/json" -d '{\"event\":\"ENTRY\",\"hallId\":\"hall-1\",\"netOccupancy\":152,\"entries\":155,\"exits\":3}'
```
- **Instant Result**:
  1. The central warning modal pops with an audible siren.
  2. Groq Swarm executes in $<2.5$ seconds.
  3. The talk in *Turing Auditorium* is dynamically relocated to *Lovelace Suite*.
  4. WhatsApp dispatch logs appear in the Super Admin console (`admin.html`).

---
*Authored by Antigravity for Team DELTA • HackIndia Spark 2026*
