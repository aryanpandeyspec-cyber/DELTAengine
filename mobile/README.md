# 📱 DELTA Engine — Mobile Coordinator (Flutter)

> **Enterprise Real-Time Event OS & Crowd Safety Companion App**  
> Built with Flutter 3.x & Dart. Styled with DELTA Engine's signature Neubrutalist design language.

---

## ⚡ Overview

`delta_mobile` is the native mobile coordinator application designed for on-ground event managers, field safety marshals, gate personnel, and operational liaisons. It directly connects to DELTA Engine's live REST & WebSocket backend (`http://localhost:3000` or local network host).

### 🎨 Signature Neubrutalist Design System
- **Primary Color Tokens**:
  - 🔵 **Yale Blue** (`#094074`)
  - 🔷 **Baltic Blue** (`#3C6997`)
  - 🩵 **Sky Aqua** (`#5ADBFF`)
  - 🟡 **Mustard** (`#FFDD4A`)
  - 🟠 **Deep Saffron** (`#FE9000`)
- **Aesthetic Principles**:
  - High-contrast, tactile 2.5px solid borders (`Border.all(color: Colors.black, width: 2.5)`)
  - Hard-edge drop shadows (`BoxShadow(color: Colors.black, offset: Offset(3.5, 3.5), blurRadius: 0)`)
  - Modern geometric typography via Google Fonts: **Outfit** (headings), **Space Grotesk** (metrics, telemetry badges, labels), and **Josefin Sans** (accents).

---

## 🛠️ Key Features & Operational Decks

### 1. 📊 Zone Density Telemetry & 1-Tap Quick Action Grid
- **Real-Time Density Gauges**: Live telemetry for all monitored halls (Turing Grand Hall, Lovelace Auditorium, Von Neumann Hub, Shannon Workshop, Hopper Pavilion).
- **Color-Coded Risk Indicators**: Instant visual pills (`OPTIMAL <60%`, `ELEVATED 60-80%`, `CRITICAL >80%`).
- **1-Tap Quick Action Dispatch**:
  - 💧 *Restock Water Supplies* (`water_supply`)
  - 🛡️ *Deploy Security Detail* (`security_post`)
  - 🚪 *Open Overflow Gates* (`gate_release`)
  - ❄️ *Trigger Cooling Boost* (`hvac_boost`)
- **🚨 1-Tap Field Marshal SOS**: Immediate broadcast alert sent directly to the central command dashboard and incident log.

### 2. 📋 Live Incident Task Queue & Dispatch Board
- Direct integration with `/api/tasks`, `/api/tasks/create`, `/api/tasks/claim`, and `/api/tasks/resolve`.
- Severity badges (`URGENT`, `NORMAL`).
- Real-time updates pushed over WebSocket whenever a coordinator or marshal creates, claims, or resolves a task.
- Floating action button to dispatch new tactical directives from the field.

### 3. 📻 Tactical Walkie-Talkie Mesh HUD
- Direct integration with `/api/voice/broadcast`.
- Mesh channel switcher (`CH 1: OPS`, `CH 2: SEC`, `CH 3: MED`).
- Interactive tactile Push-to-Talk (PTT) broadcast button.
- Real-time transmission log with audio indicators and incoming radio alerts.

### 4. 🎫 Attendee Badge Verification & Access Control Deck
- Instant credential verification via `/api/attendees/verify-badge`.
- Holographic pass preview with attendee identity, ticket tier (`VIP`, `SPEAKER`, `DELEGATE`), and check-in timestamp.
- Cryptographic anti-tamper check validation.
- Zone clearance clearance readout (e.g. `All Common Zones`, `VIP Access`).

---

## 🚀 Getting Started

### Prerequisites
- Flutter SDK 3.x or higher
- DELTA Engine backend running (`npm run server` or `node backend/server.js` on port 3000)

### Installation & Run

```bash
# Navigate to mobile project directory
cd mobile

# Fetch Flutter dependencies
flutter pub get

# Run on Chrome / Web
flutter run -d chrome

# Run on Android Emulator (Auto-routes to http://10.0.2.2:3000)
flutter run -d android

# Run on Physical Device (connected via Wi-Fi)
# In app login screen, tap "HOST" and enter your workstation's LAN IP:
# http://192.168.1.xxx:3000
```

### Static Analysis
```bash
flutter analyze
```

---

## 📁 Architecture Directory Structure

```
mobile/
├── lib/
│   ├── main.dart                  # App bootstrap & theme initialization
│   ├── models/
│   │   └── models.dart            # Telemetry, Task, Operator, & Badge models
│   ├── services/
│   │   ├── api_service.dart       # REST client (Supabase Auth, tasks, rooms, voice, SOS)
│   │   └── websocket_service.dart # Real-time WebSocket connection & event streams
│   ├── theme/
│   │   └── neubrutalism.dart      # Design tokens, NeubrutalistCard, NeubrutalistButton
│   └── screens/
│       ├── login_screen.dart      # Operator authentication & host configuration
│       └── cockpit_screen.dart    # 4-deck operational coordinator cockpit
├── test/
│   └── widget_test.dart           # Automated smoke test for DeltaMobileApp
└── pubspec.yaml                   # Dependencies (http, web_socket_channel, google_fonts, etc.)
```
