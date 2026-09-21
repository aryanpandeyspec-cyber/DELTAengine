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
#define DISTANCE_THRESHOLD_MM 150
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

  delay(1000);
  Serial.println(F("\n=========================================="));
  Serial.println(F("⚡ DELTA ENGINE - IoT Door Passage Counter"));
  Serial.println(F("=========================================="));

  // Initialize Hardware I2C Bus 1 for Sensor 2 (GPIO 16/17)
  Wire1.begin(SENSOR2_SDA, SENSOR2_SCL);
  Wire1.setClock(100000);

  Serial.print(F("Initializing Sensor 2 (Exit - GPIO 16/17)... "));
  if (!sensor2.begin(0x29, false, &Wire1)) {
    Serial.println(F("❌ FAILED! Check wiring on RX2/TX2."));
  } else {
    sensor2Online = true;
    Serial.println(F("✅ ONLINE!"));
  }

  // Smart Auto-Detection for Sensor 1 across possible pin combinations
  Serial.println(F("Scanning pins for Sensor 1..."));
  int detectedSDA = -1;
  int detectedSCL = -1;

  struct PinPair { int sda; int scl; };
  PinPair pairs[] = {
    {21, 22}, // Standard SENSOR1_SDA=21, SCL=22
    {22, 21}, // Swapped
    {21, 23}, // SDA=21, SCL=23
    {23, 21}, // SDA=23, SCL=21
    {22, 23}, // SDA=22, SCL=23
    {23, 22}  // SDA=23, SCL=22
  };

  for (auto &p : pairs) {
    if (testI2C(Wire, p.sda, p.scl, 0x29)) {
      detectedSDA = p.sda;
      detectedSCL = p.scl;
      break;
    }
  }

  if (detectedSDA != -1) {
    Serial.print(F("✅ Sensor 1 detected on SDA=GPIO "));
    Serial.print(detectedSDA);
    Serial.print(F(", SCL=GPIO "));
    Serial.print(detectedSCL);
    Serial.println(F("!"));

    Wire.begin(detectedSDA, detectedSCL);
    Wire.setClock(100000);
    if (!sensor1.begin(0x29, false, &Wire)) {
      Serial.println(F("❌ Init failed after detection."));
    } else {
      sensor1Online = true;
      Serial.println(F("Initializing Sensor 1... ✅ ONLINE!"));
    }
  } else {
    Serial.println(F("❌ SENSOR 1 NOT RESPONDING ON ANY PINS (21, 22, 23)!"));
    Serial.println(F("⚠️  CRITICAL DIAGNOSIS:"));
    Serial.println(F("   Sensor 1 has NO POWER (0 Volts)."));
    Serial.println(F("   Move Sensor 1's VIN & GND wires to the RIGHT side of the breadboard next to Sensor 2!"));
  }

  if (sensor1Online && sensor2Online) {
    Serial.println(F("\n🚀 DUAL-SENSOR MODE: Bi-directional Entry & Exit active!"));
  } else if (sensor2Online) {
    Serial.println(F("\n⚡ SINGLE-SENSOR MODE ACTIVE on Sensor 2! You can test passage right now!"));
  }
  Serial.println(F("Stand or wave hand in front of sensor to test...\n"));
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

  // Live Radar visualization printed to Serial Monitor every 200ms
  static unsigned long lastRadarPrint = 0;
  if (now - lastRadarPrint > 200) {
    lastRadarPrint = now;
    if (sensor1Online && sensor2Online) {
      Serial.print(F("[RADAR] S1: "));
      Serial.print(dist1);
      Serial.print(F(" mm | S2: "));
      Serial.print(dist2);
      Serial.print(F(" mm | Status: "));
      if (triggered1 || triggered2) {
        Serial.println(F("🎯 [PASSAGE IN PROGRESS]"));
      } else {
        Serial.println(F("⚪ [Clear >15cm]"));
      }
    } else if (sensor2Online) {
      Serial.print(F("[RADAR] S2: "));
      Serial.print(dist2);
      Serial.print(F(" mm ("));
      Serial.print(dist2 / 10);
      Serial.print(F(" cm) | "));
      if (triggered2) {
        Serial.println(F("🎯 [TARGET DETECTED in 3.5cm - 15cm zone!]"));
      } else if (dist2 < MIN_DISTANCE_MM) {
        Serial.println(F("⚠️ [OBJECT TOUCHING SENSOR (<3.5cm)! Peel off protective film or move dangling wires!]"));
      } else {
        Serial.println(F("⚪ [Clear - hand outside 15cm]"));
      }
    }
  }

  // If only Sensor 2 is online, operate in ultra-responsive single-sensor mode
  if (!sensor1Online && sensor2Online) {
    static bool s2WasTriggered = false;
    if (triggered2 && !s2WasTriggered) {
      s2WasTriggered = true;
      totalEntries++;
      netOccupancy++;
      sendEvent("ENTRY", 0, dist2);
      blinkLed();
      delay(150); // Fast debounce
    } else if (!triggered2) {
      s2WasTriggered = false;
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
  digitalWrite(ONBOARD_LED, HIGH);
  delay(80);
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
}
