/*
 * DELTA ENGINE - IoT Edge Room Perception System
 * Bi-Directional Door Passage Counter (Dual VL53L0X Laser ToF Sensors)
 * 
 * Hardware Connections:
 *   - ESP32 Development Board (ESP-WROOM-32 on COM7)
 *   - Sensor 1 (Entry): I2C 0 (SDA = GPIO 21, SCL = GPIO 22)
 *   - Sensor 2 (Exit):  I2C 1 (SDA = GPIO 16 [RX2], SCL = GPIO 17 [TX2])
 *   - Power: 3.3V & GND to breadboard rails
 * 
 * Outputs:
 *   - USB Serial at 115200 baud (Clean JSON stream for DELTA Engine)
 *   - Onboard Blue LED on GPIO 2 blinks on crossing
 */

#include <Wire.h>
#include <Adafruit_VL53L0X.h>

// I2C Pin Definitions for ESP32
#define SENSOR1_SDA 21
#define SENSOR1_SCL 22
#define SENSOR2_SDA 16  // RX2
#define SENSOR2_SCL 17  // TX2

#define ONBOARD_LED 2

// Distance threshold for hand/door passage detection (15 cm = 150 mm)
#define DISTANCE_THRESHOLD_MM 750
#define MIN_DISTANCE_MM 35 // Ignore anything under 3.5 cm (filters out close wires and surface crosstalk)

// Create two independent Adafruit_VL53L0X instances on separate I2C buses
Adafruit_VL53L0X sensor1 = Adafruit_VL53L0X();
Adafruit_VL53L0X sensor2 = Adafruit_VL53L0X();

// Directional State Machine
enum DirectionState {
  IDLE,
  ENTRY_STARTED,  // Sensor 1 triggered first
  EXIT_STARTED    // Sensor 2 triggered first
};

DirectionState currentState = IDLE;
unsigned long stateStartTime = 0;
const unsigned long STATE_TIMEOUT_MS = 2000; // Reset state if passage not completed within 2s

int totalEntries = 0;
int totalExits = 0;
int netOccupancy = 0;

bool testI2C(TwoWire &bus, int sda, int scl, uint8_t addr = 0x29) {
  pinMode(sda, INPUT_PULLUP);
  pinMode(scl, INPUT_PULLUP);
  delay(5);

  // If the line is shorted or unpowered (clamping to 0V), don't attempt transmission
  if (digitalRead(sda) == LOW || digitalRead(scl) == LOW) {
    return false;
  }

  bus.setTimeOut(30); // 30ms timeout - prevents hardware I2C hang
  bus.begin(sda, scl);
  bus.setClock(100000);
  bus.beginTransmission(addr);
  return (bus.endTransmission() == 0);
}

bool sensor1Online = false;
bool sensor2Online = false;

void setup() {
  Serial.begin(115200);
  pinMode(ONBOARD_LED, OUTPUT);
  digitalWrite(ONBOARD_LED, LOW);

  delay(500);
  Serial.println(F("\n=========================================="));
  Serial.println(F("DELTA ENGINE - IoT Door Passage Counter"));
  Serial.println(F("=========================================="));
  Serial.flush();

  struct PinPair { int sda; int scl; };

  // 1. Smart Auto-Detection for Sensor 2 (Exit) on Wire1
  Serial.println(F("Scanning pins for Sensor 2 (Exit)..."));
  int detectedSDA2 = -1;
  int detectedSCL2 = -1;
  PinPair pairs2[] = {
    {16, 17}, // Standard RX2 (GPIO 16) & TX2 (GPIO 17)
    {17, 16}, // Swapped TX2/RX2
    {4, 5},   // Alternative GPIO 4/5
    {18, 19}  // Alternative GPIO 18/19
  };

  for (auto &p : pairs2) {
    if (testI2C(Wire1, p.sda, p.scl, 0x29)) {
      detectedSDA2 = p.sda;
      detectedSCL2 = p.scl;
      break;
    }
  }

  if (detectedSDA2 != -1) {
    Serial.print(F("✅ Sensor 2 detected on SDA=GPIO "));
    Serial.print(detectedSDA2);
    Serial.print(F(", SCL=GPIO "));
    Serial.print(detectedSCL2);
    Serial.println(F("!"));

    Wire1.begin(detectedSDA2, detectedSCL2);
    Wire1.setClock(100000);
    delay(50); // Settling delay

    for (int attempt = 1; attempt <= 3; attempt++) {
      if (sensor2.begin(0x29, false, &Wire1)) {
        sensor2Online = true;
        break;
      }
      delay(60);
    }

    if (sensor2Online) {
      Serial.println(F("Initializing Sensor 2... ✅ ONLINE!"));
    } else {
      Serial.println(F("❌ Sensor 2 init failed (Try connecting VIN to 5V/VIN or check protective film)."));
    }
  } else {
    Serial.println(F("⚠️ Sensor 2 not responding on GPIO 16/17. Check wiring or power rail!"));
  }

  // 2. Smart Auto-Detection for Sensor 1 (Entry) on Wire
  Serial.println(F("Scanning pins for Sensor 1 (Entry)..."));
  int detectedSDA1 = -1;
  int detectedSCL1 = -1;
  PinPair pairs1[] = {
    {21, 22}, // Standard SENSOR1_SDA=21, SCL=22
    {22, 21}, // Swapped
    {21, 23}, // SDA=21, SCL=23
    {23, 21}, // SDA=23, SCL=21
    {22, 23}, // SDA=22, SCL=23
    {23, 22}  // SDA=23, SCL=22
  };

  for (auto &p : pairs1) {
    if (testI2C(Wire, p.sda, p.scl, 0x29)) {
      detectedSDA1 = p.sda;
      detectedSCL1 = p.scl;
      break;
    }
  }

  if (detectedSDA1 != -1) {
    Serial.print(F("✅ Sensor 1 detected on SDA=GPIO "));
    Serial.print(detectedSDA1);
    Serial.print(F(", SCL=GPIO "));
    Serial.print(detectedSCL1);
    Serial.println(F("!"));

    Wire.begin(detectedSDA1, detectedSCL1);
    Wire.setClock(100000);
    delay(50); // Settling delay

    for (int attempt = 1; attempt <= 3; attempt++) {
      if (sensor1.begin(0x29, false, &Wire)) {
        sensor1Online = true;
        break;
      }
      delay(60);
    }

    if (sensor1Online) {
      Serial.println(F("Initializing Sensor 1... ✅ ONLINE!"));
    } else {
      Serial.println(F("❌ Sensor 1 init failed (Try connecting VIN to 5V/VIN or check protective film)."));
    }
  } else {
    Serial.println(F("⚠️ Sensor 1 not responding on GPIO 21/22. Check wiring or power rail!"));
  }

  if (sensor1Online && sensor2Online) {
    Serial.println(F("\n🚀 DUAL-SENSOR MODE: Bi-directional Entry & Exit active!"));
  } else if (sensor2Online) {
    Serial.println(F("\n⚡ SINGLE-SENSOR MODE ACTIVE on Sensor 2! You can test passage right now!"));
  } else if (sensor1Online) {
    Serial.println(F("\n⚡ SINGLE-SENSOR MODE ACTIVE on Sensor 1! You can test passage right now!"));
  } else {
    Serial.println(F("\n❌ Neither sensor responded. Check 3.3V & GND power jumper rails!"));
  }
  Serial.println(F("Stand or wave hand in front of sensor to test...\n"));
  Serial.flush();
}

void loop() {
  uint16_t dist1 = 9999;
  uint16_t dist2 = 9999;

  if (sensor1Online) {
    VL53L0X_RangingMeasurementData_t measure1;
    sensor1.rangingTest(&measure1, false);
    dist1 = (measure1.RangeStatus != 4) ? measure1.RangeMilliMeter : 9999;
  }

  if (sensor2Online) {
    VL53L0X_RangingMeasurementData_t measure2;
    sensor2.rangingTest(&measure2, false);
    dist2 = (measure2.RangeStatus != 4) ? measure2.RangeMilliMeter : 9999;
  }

  bool triggered1 = (dist1 <= DISTANCE_THRESHOLD_MM && dist1 >= MIN_DISTANCE_MM);
  bool triggered2 = (dist2 <= DISTANCE_THRESHOLD_MM && dist2 >= MIN_DISTANCE_MM);

  unsigned long now = millis();

  // Print detection ONLY when a target is actually detected (NO spam when clear)
  static bool wasTriggered = false;
  bool isTriggeredNow = (triggered1 || triggered2);

  if (isTriggeredNow && !wasTriggered) {
    wasTriggered = true;
    if (sensor1Online && sensor2Online) {
      Serial.print(F("\n🎯 [PASSAGE IN PROGRESS] S1: "));
      Serial.print(dist1);
      Serial.print(F(" mm | S2: "));
      Serial.print(dist2);
      Serial.println(F(" mm"));
    } else {
      Serial.print(F("\n🎯 [TARGET DETECTED] Distance: "));
      Serial.print(sensor2Online ? dist2 : dist1);
      Serial.println(F(" mm in crossing zone!"));
    }
    Serial.flush();
  } else if (!isTriggeredNow && wasTriggered) {
    wasTriggered = false;
  }

  // If only Sensor 2 is online, operate in camera-fused single-sensor mode
  if (!sensor1Online && sensor2Online) {
    static bool s2HandHandled = false;
    if (triggered2 && !s2HandHandled) {
      s2HandHandled = true;
      sendEvent("DOOR_TRIGGER", 0, dist2);
      blinkLed();
      delay(250); // Clean debounce
    } else if (!triggered2) {
      s2HandHandled = false;
    }
    delay(15);
    return;
  }

  // If only Sensor 1 is online, operate in camera-fused single-sensor mode
  if (sensor1Online && !sensor2Online) {
    static bool s1HandHandled = false;
    if (triggered1 && !s1HandHandled) {
      s1HandHandled = true;
      sendEvent("DOOR_TRIGGER", dist1, 0);
      blinkLed();
      delay(250); // Clean debounce
    } else if (!triggered1) {
      s1HandHandled = false;
    }
    delay(15);
    return;
  }

  // Dual-sensor directional state machine
  if (currentState != IDLE && (now - stateStartTime > STATE_TIMEOUT_MS)) {
    currentState = IDLE;
  }

  switch (currentState) {
    case IDLE:
      if (triggered1 && !triggered2) {
        currentState = ENTRY_STARTED;
        stateStartTime = now;
      } else if (triggered2 && !triggered1) {
        currentState = EXIT_STARTED;
        stateStartTime = now;
      }
      break;

    case ENTRY_STARTED:
      if (triggered2) {
        totalEntries++;
        netOccupancy++;
        sendEvent("ENTRY", dist1, dist2);
        blinkLed();
        currentState = IDLE;
        delay(150);
      }
      break;

    case EXIT_STARTED:
      if (triggered1) {
        totalExits++;
        if (netOccupancy > 0) netOccupancy--;
        sendEvent("EXIT", dist1, dist2);
        blinkLed();
        currentState = IDLE;
        delay(150);
      }
      break;
  }

  delay(15);
}

void blinkLed() {
  Serial.print(F("💡 [LED BLINK] Passage registered | Live Occupancy: "));
  Serial.print(netOccupancy);
  Serial.println(F(" Pax"));
  Serial.flush();
  digitalWrite(ONBOARD_LED, HIGH);
  delay(100);
  digitalWrite(ONBOARD_LED, LOW);
}

void sendEvent(const char* eventType, uint16_t d1, uint16_t d2) {
  // Output clean JSON format directly to Serial (read by DELTA Engine Python bridge)
  Serial.print(F("{\"event\":\""));
  Serial.print(eventType);
  Serial.print(F("\",\"hallId\":\"hall-1\",\"netOccupancy\":"));
  Serial.print(netOccupancy);
  Serial.print(F(",\"entries\":"));
  Serial.print(totalEntries);
  Serial.print(F(",\"exits\":"));
  Serial.print(totalExits);
  Serial.print(F(",\"dist1\":"));
  Serial.print(d1);
  Serial.print(F(",\"dist2\":"));
  Serial.print(d2);
  Serial.println(F("}"));
  Serial.flush();
}
