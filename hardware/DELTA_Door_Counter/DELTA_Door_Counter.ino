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
#define MIN_DISTANCE_MM 35 // Ignore anything under 3.5 cm (filters close noise/reflection)

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

  // Initialize Hardware I2C Bus 0 for Sensor 1
  Wire.begin(SENSOR1_SDA, SENSOR1_SCL);
  Wire.setClock(100000);

  // Initialize Hardware I2C Bus 1 for Sensor 2
  Wire1.begin(SENSOR2_SDA, SENSOR2_SCL);
  Wire1.setClock(100000);

  Serial.print(F("Initializing Sensor 1 (Entry - GPIO 21/22)... "));
  if (!sensor1.begin(0x29, false, &Wire)) {
    Serial.println(F("❌ FAILED! Check wiring on D21/D22."));
  } else {
    sensor1Online = true;
    Serial.println(F("✅ ONLINE!"));
  }

  Serial.print(F("Initializing Sensor 2 (Exit - GPIO 16/17)... "));
  if (!sensor2.begin(0x29, false, &Wire1)) {
    Serial.println(F("❌ FAILED! Check wiring on RX2/TX2."));
  } else {
    sensor2Online = true;
    Serial.println(F("✅ ONLINE!"));
  }

  if (sensor1Online && sensor2Online) {
    Serial.println(F("🚀 DUAL-SENSOR MODE: Bi-directional Entry & Exit active!"));
  } else if (sensor1Online) {
    Serial.println(F("⚡ SINGLE-SENSOR MODE ACTIVE on Sensor 1 (Entry)!"));
  } else if (sensor2Online) {
    Serial.println(F("⚡ SINGLE-SENSOR MODE ACTIVE on Sensor 2 (Exit)!"));
  } else {
    Serial.println(F("⚠️ Both sensors offline. Check power and I2C wiring."));
  }

  Serial.println(F("Door counter ready. Stand or wave hand in front of sensors to test...\n"));
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

  // Single-Sensor Mode fallback if only one sensor is plugged in
  if (sensor1Online && !sensor2Online) {
    static bool s1WasTriggered = false;
    if (triggered1 && !s1WasTriggered) {
      s1WasTriggered = true;
      totalEntries++;
      netOccupancy++;
      sendEvent("ENTRY", dist1, 0);
      blinkLed();
      delay(250);
    } else if (!triggered1) {
      s1WasTriggered = false;
    }
    delay(20);
    return;
  }

  if (!sensor1Online && sensor2Online) {
    static bool s2WasTriggered = false;
    if (triggered2 && !s2WasTriggered) {
      s2WasTriggered = true;
      totalEntries++;
      netOccupancy++;
      sendEvent("ENTRY", 0, dist2);
      blinkLed();
      delay(250);
    } else if (!triggered2) {
      s2WasTriggered = false;
    }
    delay(20);
    return;
  }

  // Dual-Sensor Directional State Machine
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
        delay(250);
      }
      break;

    case EXIT_STARTED:
      if (triggered1) {
        totalExits++;
        if (netOccupancy > 0) netOccupancy--;
        sendEvent("EXIT", dist1, dist2);
        blinkLed();
        currentState = IDLE;
        delay(250);
      }
      break;
  }

  delay(20);
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
